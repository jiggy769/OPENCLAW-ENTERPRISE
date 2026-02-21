import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import Groq from 'groq-sdk';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '50mb' }));

// Serve static files (login.html, chat.html)
app.use(express.static(__dirname));

// Initialize services
const resend = new Resend(process.env.RESEND_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Storage
const codes = new Map();
const chats = new Map();
const sessions = new Map();
const MY_EMAIL = 'jamesarnold6608@gmail.com';

// ==========================================
// AGENT SYSTEM PROMPTS
// ==========================================

const AGENT_PROMPTS = {
  orchestrator: `You are the CEO of Open Claw Enterprise. Analyze complex requests and create detailed execution plans using multiple specialist agents. Break down requests into phases with specific agent assignments. Provide strategic guidance and priority ordering. Format with clear headers and actionable next steps.`,

  market_research: `You are a Senior Market Research Analyst with 10+ years at McKinsey/Bain. Provide deep competitive analysis with specific, current data. Research and cite real company names. Provide specific pricing data. Include market size metrics (TAM/SAM/SOM). Identify 3-5 direct competitors with strengths/weaknesses. Give actionable recommendations.`,

  product_design: `You are a Principal UX Designer at Airbnb/Stripe. Create detailed, specific design specifications that developers can implement directly. Provide exact layout specifications. Write actual copy for ALL text elements. Specify color values (hex codes) and typography. Include conversion optimization tactics.`,

  backend_engineer: `You are a Staff Backend Engineer at Netflix/Google. Provide production-ready architecture with complete, runnable code. Write complete SQL schemas. Define all API endpoints. Include authentication flows. Design caching strategies. Write error handling with specific HTTP status codes.`,

  frontend_engineer: `You are a Senior Frontend Architect at Vercel/Shopify. Generate complete, production-ready React/Next.js code. Write complete React components with TypeScript. Use modern hooks. Style with Tailwind CSS. Define all TypeScript interfaces. Ensure accessibility.`,

  communications: `You are a Communications Director at HubSpot/Salesforce. Write high-converting email sequences with actual copy, not templates. Write complete email subject lines. Write full email body copy with opening hooks, value propositions, and CTAs. Include personalization tokens.`,

  sales_marketing: `You are a Growth VP at Dropbox/Slack. Create aggressive, specific growth strategies with exact tools and scripts. Name specific tools with pricing. Write complete cold outreach scripts. Create landing page copy with conversion psychology. Design pricing strategies.`,

  devops_security: `You are a DevSecOps Lead at AWS/HashiCorp. Provide enterprise-grade, copy-pasteable infrastructure code. Write complete CI/CD pipeline configs. Create Dockerfiles with multi-stage builds. Write Kubernetes manifests. Include security scanning configs.`,

  data_analyst: `You are a Principal Data Scientist at Airbnb/Uber. Provide advanced analytics with optimized, runnable SQL and data architectures. Write complex SQL queries using CTEs, window functions, and optimizations. Create dashboard specifications. Perform statistical analysis.`,

  qa_documentation: `You are a QA Director + Technical Writer at Microsoft/Atlassian. Create comprehensive test suites and documentation. Write complete test plans. Generate unit/integration/E2E test code. Write complete API documentation. Create incident response runbooks.`
};

// ==========================================
// EMAIL API
// ==========================================

app.post('/api/send-code', async (req, res) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codes.set(MY_EMAIL, { code, time: Date.now() });
  
  console.log('🔐 CODE GENERATED:', code);

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [MY_EMAIL],
      subject: 'Your Open Claw Code: ' + code,
      html: `<div style="background:#0a0a0a; color:#dc2626; padding:40px; text-align:center; font-size:48px; border:3px solid #dc2626; font-family:Arial; border-radius:10px;">
        <div style="font-size:16px; color:#666; margin-bottom:20px;">🦅 OPEN CLAW ENTERPRISE</div>
        <div style="font-size:60px; font-weight:bold; letter-spacing:10px;">${code}</div>
        <div style="font-size:14px; color:#666; margin-top:20px;">Your verification code - expires in 10 minutes</div>
      </div>`
    });
    
    res.json({ success: true, code: code, message: 'Code sent to your email!', display: true });
  } catch (err) {
    console.log('Email error:', err.message);
    res.json({ success: true, code: code, message: 'Use this code:', display: true, fallback: true });
  }
});

app.post('/api/verify-code', (req, res) => {
  const { code } = req.body;
  const stored = codes.get(MY_EMAIL);
  
  if (!stored) return res.status(400).json({ error: 'No code found. Request new code.' });
  if (Date.now() - stored.time > 600000) {
    codes.delete(MY_EMAIL);
    return res.status(400).json({ error: 'Code expired. Request new code.' });
  }
  if (stored.code !== code) return res.status(400).json({ error: 'Invalid code. Try again.' });
  
  codes.delete(MY_EMAIL);
  const token = 'tok_' + Math.random().toString(36).substr(2, 16);
  const session = { email: MY_EMAIL, token, createdAt: new Date().toISOString() };
  chats.set(token, []);
  sessions.set(token, session);
  
  res.json({ success: true, message: 'Welcome to Open Claw Enterprise!', session });
});

// ==========================================
// AI CHAT API
// ==========================================

app.post('/api/chat', async (req, res) => {
  const { message, sessionToken, context } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided' });

  const msg = message.toLowerCase();
  let agentType = 'orchestrator';
  let agentEmoji = '🎯';
  let agentName = 'Orchestrator';

  if (msg.includes('market') || msg.includes('competitor') || msg.includes('research') || msg.includes('trend') || msg.includes('pricing') || msg.includes('industry')) {
    agentType = 'market_research'; agentEmoji = '🔍'; agentName = 'Market Research';
  } else if (msg.includes('design') || msg.includes('ui') || msg.includes('ux') || msg.includes('wireframe') || msg.includes('landing') || msg.includes('mockup')) {
    agentType = 'product_design'; agentEmoji = '🎨'; agentName = 'Product Design';
  } else if (msg.includes('database') || msg.includes('api') || msg.includes('backend') || msg.includes('server') || msg.includes('schema')) {
    agentType = 'backend_engineer'; agentEmoji = '⚙️'; agentName = 'Backend Engineer';
  } else if (msg.includes('react') || msg.includes('component') || msg.includes('frontend') || msg.includes('css') || msg.includes('html') || msg.includes('javascript') || msg.includes('typescript')) {
    agentType = 'frontend_engineer'; agentEmoji = '🎭'; agentName = 'Frontend Engineer';
  } else if (msg.includes('email') || msg.includes('notification') || msg.includes('sequence') || msg.includes('newsletter') || msg.includes('campaign')) {
    agentType = 'communications'; agentEmoji = '📧'; agentName = 'Communications';
  } else if (msg.includes('sales') || msg.includes('marketing') || msg.includes('lead') || msg.includes('growth') || msg.includes('outreach') || msg.includes('funnel')) {
    agentType = 'sales_marketing'; agentEmoji = '💰'; agentName = 'Sales & Marketing';
  } else if (msg.includes('deploy') || msg.includes('docker') || msg.includes('security') || msg.includes('cloud') || msg.includes('kubernetes') || msg.includes('aws')) {
    agentType = 'devops_security'; agentEmoji = '🔒'; agentName = 'DevOps & Security';
  } else if (msg.includes('sql') || msg.includes('data') || msg.includes('analytics') || msg.includes('dashboard') || msg.includes('query') || msg.includes('metric')) {
    agentType = 'data_analyst'; agentEmoji = '📊'; agentName = 'Data Analyst';
  } else if (msg.includes('test') || msg.includes('documentation') || msg.includes('docs') || msg.includes('tutorial') || msg.includes('readme')) {
    agentType = 'qa_documentation'; agentEmoji = '🧪'; agentName = 'QA & Documentation';
  }

  try {
    console.log(`🤖 ${agentEmoji} ${agentName} activated for: "${message.substring(0, 60)}..."`);

    let conversationContext = '';
    if (sessionToken && chats.has(sessionToken)) {
      const history = chats.get(sessionToken).slice(-6);
      conversationContext = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content.substring(0, 200)}`).join('\n');
    }

    const fullPrompt = context
      ? `PROJECT CONTEXT: ${context}\n\nTASK: ${message}`
      : conversationContext
        ? `CONVERSATION HISTORY:\n${conversationContext}\n\nCURRENT TASK: ${message}`
        : `TASK: ${message}`;

    const response = await groq.chat.completions.create({
      messages: [
        { role: "system", content: AGENT_PROMPTS[agentType] },
        { role: "user", content: `${fullPrompt}\n\nProvide a comprehensive, detailed response with specific examples and actionable next steps.` }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 4096,
    });

    const aiResponse = response.choices[0].message.content;

    if (sessionToken && chats.has(sessionToken)) {
      const history = chats.get(sessionToken);
      history.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
      history.push({ role: 'assistant', content: aiResponse, agent: agentType, timestamp: new Date().toISOString() });
      if (history.length > 50) chats.set(sessionToken, history.slice(-50));
    }

    const formattedResponse = `${agentEmoji} **${agentName} Agent** [${new Date().toLocaleTimeString()}]\n\n${aiResponse}\n\n---\n*Agent: ${agentType} | Model: llama-3.3-70b-versatile | Tokens: ${response.usage?.total_tokens || 'N/A'}*`;

    res.json({
      success: true,
      tool: agentType,
      agent: agentName,
      emoji: agentEmoji,
      result: formattedResponse,
      rawResponse: aiResponse,
      timestamp: new Date().toISOString(),
      usage: response.usage
    });

  } catch (error) {
    console.error('AI Error:', error);
    let errorMessage = 'AI service temporarily unavailable';
    if (error.status === 429) errorMessage = 'Rate limit exceeded. Please wait a moment.';
    else if (error.status === 401) errorMessage = 'API authentication failed. Check your GROQ_API_KEY.';
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    agents: Object.keys(AGENT_PROMPTS).length,
    groqConnected: !!process.env.GROQ_API_KEY,
    resendConnected: !!process.env.RESEND_API_KEY,
    model: 'llama-3.3-70b-versatile'
  });
});

// Serve login.html as default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});
app.get('/landing', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing.html'));
})
// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║           🦅 OPEN CLAW ENTERPRISE v3.0 🦅                ║
╠══════════════════════════════════════════════════════════╣
║  Status:  ✅ Running on port ${PORT}                       ║
║  AI:      🧠 Groq llama-3.3-70b-versatile                ║
║  Agents:  10 Specialist Agents Ready                     ║
║  Email:   ${process.env.RESEND_API_KEY ? '✅ Resend Connected' : '⚠️  No Resend Key'}                    ║
╚══════════════════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => { console.log('Shutting down...'); process.exit(0); });
process.on('SIGINT', () => { console.log('Shutting down...'); process.exit(0); });