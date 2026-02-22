import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { Resend } from 'resend';

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
app.use(express.static(__dirname));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Verify Resend configuration
const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';
console.log(`📧 Email configured to send from: ${emailFrom}`);

const codes = new Map();
const chats = new Map();
const sessions = new Map();

// Rate limiting map
const rateLimits = new Map();

const AGENT_PROMPTS = {
  orchestrator: `You are the CEO of Open Claw Enterprise. Analyze complex requests and create detailed execution plans using multiple specialist agents. Break down requests into phases with specific agent assignments. Provide strategic guidance and priority ordering. Format with clear headers and actionable next steps.`,
  market_research: `You are a Senior Market Research Analyst with 10+ years at McKinsey/Bain. Provide deep competitive analysis with specific, current data. Research and cite real company names. Provide specific pricing data. Include market size metrics (TAM/SAM/SOM). Identify 3-5 direct competitors with strengths/weaknesses. Give actionable recommendations.`,
  product_design: `You are a Principal UX Designer at Airbnb/Stripe. Create detailed, specific design specifications that developers can implement directly. Provide exact layout specifications. Write actual copy for ALL text elements. Specify color values (hex codes) and typography. Include conversion optimization tactics.`,
  backend_engineer: `You are a Staff Backend Engineer at Netflix/Google. Provide production-ready architecture with complete, runnable code. Write complete SQL schemas. Define all API endpoints. Include authentication flows. Design caching strategies. Write error handling with specific HTTP status codes.`,
  frontend_engineer: `You are a Senior Frontend Architect at Vercel/Shopify. Generate complete, production-ready HTML/CSS/JavaScript code. Write complete working pages that can be rendered directly in a browser. Make them visually stunning with modern design.`,
  communications: `You are a Communications Director at HubSpot/Salesforce. Write high-converting email sequences with actual copy, not templates. Write complete email subject lines. Write full email body copy with opening hooks, value propositions, and CTAs. Include personalization tokens.`,
  sales_marketing: `You are a Growth VP at Dropbox/Slack. Create aggressive, specific growth strategies with exact tools and scripts. Name specific tools with pricing. Write complete cold outreach scripts. Create landing page copy with conversion psychology. Design pricing strategies.`,
  devops_security: `You are a DevSecOps Lead at AWS/HashiCorp. Provide enterprise-grade, copy-pasteable infrastructure code. Write complete CI/CD pipeline configs. Create Dockerfiles with multi-stage builds. Write Kubernetes manifests. Include security scanning configs.`,
  data_analyst: `You are a Principal Data Scientist at Airbnb/Uber. Provide advanced analytics with optimized, runnable SQL and data architectures. Write complex SQL queries using CTEs, window functions, and optimizations. Create dashboard specifications. Perform statistical analysis.`,
  qa_documentation: `You are a QA Director + Technical Writer at Microsoft/Atlassian. Create comprehensive test suites and documentation. Write complete test plans. Generate unit/integration/E2E test code. Write complete API documentation. Create incident response runbooks.`
};

// Check rate limit
function checkRateLimit(email) {
  const now = Date.now();
  const userLimit = rateLimits.get(email);
  
  if (userLimit) {
    if (userLimit.count >= 3 && now - userLimit.firstAttempt < 300000) {
      const waitTime = Math.ceil((300000 - (now - userLimit.firstAttempt)) / 60000);
      return { allowed: false, waitTime };
    }
    
    if (now - userLimit.firstAttempt > 300000) {
      rateLimits.set(email, { count: 1, firstAttempt: now });
    } else {
      userLimit.count++;
    }
  } else {
    rateLimits.set(email, { count: 1, firstAttempt: now });
  }
  
  return { allowed: true };
}

// Generate HTML email template
function generateEmailTemplate(code) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Open Claw Verification</title>
    <style>
      body { margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
      .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%); border: 1px solid #dc2626; border-radius: 8px; overflow: hidden; }
      .header { background: linear-gradient(135deg, #dc2626, #991b1b); padding: 40px 20px; text-align: center; }
      .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; }
      .content { padding: 40px 30px; color: #ffffff; }
      .code-box { background: rgba(220,38,38,0.1); border: 2px solid #dc2626; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
      .code { font-family: 'Courier New', monospace; font-size: 48px; font-weight: 900; color: #dc2626; letter-spacing: 8px; text-shadow: 0 0 20px rgba(220,38,38,0.5); }
      .footer { background: #000000; padding: 20px; text-align: center; color: #666666; font-size: 12px; border-top: 1px solid #333; }
      .warning { color: #ff6b6b; font-size: 14px; margin-top: 20px; }
      .expire { color: #0d9488; font-size: 14px; margin-top: 15px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🦅 OPEN CLAW</h1>
      </div>
      <div class="content">
        <h2 style="color: #0d9488; margin-bottom: 20px;">Verification Code</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #cccccc;">
          You requested access to Open Claw Enterprise. Use the code below to complete your login:
        </p>
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        <p class="expire">
          ⏱️ This code expires in <strong>10 minutes</strong>
        </p>
        <p class="warning">
          🔒 If you didn't request this code, please ignore this email.
        </p>
      </div>
      <div class="footer">
        <p>Open Claw Enterprise v4.0 | AI Agent System</p>
        <p style="margin-top: 10px; color: #0d9488;">Powered by Groq AI + Llama 3.3</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

// SEND CODE - Email with fallback to on-screen display
app.post('/api/send-code', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  // Check rate limit
  const rateCheck = checkRateLimit(email);
  if (!rateCheck.allowed) {
    return res.status(429).json({ 
      error: `Too many attempts. Please wait ${rateCheck.waitTime} minutes.` 
    });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codes.set(email, { code, time: Date.now() });

  console.log(`🔐 CODE generated for ${email}: ${code}`);

  let emailSent = false;
  let emailError = null;

  // Try to send email via Resend if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const { data, error } = await resend.emails.send({
        from: emailFrom,
        to: email,
        subject: '🦅 Your Open Claw Verification Code',
        html: generateEmailTemplate(code),
        text: `Your Open Claw verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`
      });

      if (error) {
        console.error('❌ Resend error:', error);
        emailError = error.message;
      } else {
        console.log(`📧 Email sent: ${data.id}`);
        emailSent = true;
      }
    } catch (error) {
      console.error('❌ Email failed:', error.message);
      emailError = error.message;
    }
  } else {
    emailError = 'Resend not configured';
  }

  return res.json({
    success: true,
    code: code,
    emailSent: emailSent,
    display: true,
    fallback: !emailSent,
    message: emailSent 
      ? 'Verification code sent to your email' 
      : 'Use the code displayed on screen',
    emailError: process.env.NODE_ENV === 'development' ? emailError : undefined
  });
});

// VERIFY CODE
app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required.' });
  }

  const stored = codes.get(email);

  if (!stored) return res.status(400).json({ error: 'No code found. Request a new code.' });

  if (Date.now() - stored.time > 600000) {
    codes.delete(email);
    return res.status(400).json({ error: 'Code expired. Request a new code.' });
  }

  if (stored.code !== code) {
    return res.status(400).json({ error: 'Invalid code. Please try again.' });
  }

  codes.delete(email);
  const token = 'tok_' + Math.random().toString(36).substr(2, 16);
  const session = { email, token, createdAt: new Date().toISOString() };
  chats.set(token, []);
  sessions.set(token, session);

  return res.json({ success: true, message: 'Welcome to Open Claw!', session });
});

// CHAT
app.post('/api/chat', async (req, res) => {
  const { message, sessionToken, context } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided' });

  const msg = message.toLowerCase();
  let agentType = 'orchestrator';
  let agentEmoji = '🎯';
  let agentName = 'Orchestrator';

  if (msg.includes('market') || msg.includes('competitor') || msg.includes('research') || msg.includes('trend') || msg.includes('industry')) {
    agentType = 'market_research'; agentEmoji = '🔍'; agentName = 'Market Research';
  } else if (msg.includes('design') || msg.includes('ui') || msg.includes('ux') || msg.includes('wireframe') || msg.includes('landing') || msg.includes('mockup')) {
    agentType = 'product_design'; agentEmoji = '🎨'; agentName = 'Product Design';
  } else if (msg.includes('database') || msg.includes('api') || msg.includes('backend') || msg.includes('server') || msg.includes('schema')) {
    agentType = 'backend_engineer'; agentEmoji = '⚙️'; agentName = 'Backend Engineer';
  } else if (msg.includes('react') || msg.includes('component') || msg.includes('frontend') || msg.includes('css') || msg.includes('html') || msg.includes('javascript') || msg.includes('build a') || msg.includes('create a')) {
    agentType = 'frontend_engineer'; agentEmoji = '🎭'; agentName = 'Frontend Engineer';
  } else if (msg.includes('email') || msg.includes('sequence') || msg.includes('newsletter') || msg.includes('campaign')) {
    agentType = 'communications'; agentEmoji = '📧'; agentName = 'Communications';
  } else if (msg.includes('sales') || msg.includes('marketing') || msg.includes('lead') || msg.includes('growth') || msg.includes('outreach')) {
    agentType = 'sales_marketing'; agentEmoji = '💰'; agentName = 'Sales & Marketing';
  } else if (msg.includes('deploy') || msg.includes('docker') || msg.includes('security') || msg.includes('cloud') || msg.includes('aws')) {
    agentType = 'devops_security'; agentEmoji = '🔒'; agentName = 'DevOps & Security';
  } else if (msg.includes('sql') || msg.includes('data') || msg.includes('analytics') || msg.includes('dashboard') || msg.includes('query')) {
    agentType = 'data_analyst'; agentEmoji = '📊'; agentName = 'Data Analyst';
  } else if (msg.includes('test') || msg.includes('documentation') || msg.includes('docs') || msg.includes('readme')) {
    agentType = 'qa_documentation'; agentEmoji = '🧪'; agentName = 'QA & Documentation';
  }

  try {
    let conversationContext = '';
    if (sessionToken && chats.has(sessionToken)) {
      const history = chats.get(sessionToken).slice(-6);
      conversationContext = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content.substring(0, 200)}`).join('\n');
    }

    const fullPrompt = context
      ? `PROJECT CONTEXT:\n${context}\n\nTASK: ${message}`
      : conversationContext
        ? `CONVERSATION HISTORY:\n${conversationContext}\n\nCURRENT TASK: ${message}`
        : `TASK: ${message}`;

    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: AGENT_PROMPTS[agentType] },
        { role: 'user', content: `${fullPrompt}\n\nProvide a comprehensive, detailed response with specific examples and actionable next steps.` }
      ],
      model: 'llama-3.3-70b-versatile',
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

    return res.json({
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
    else if (error.status === 401) errorMessage = 'API key error. Check your GROQ_API_KEY.';
    return res.status(500).json({ success: false, error: errorMessage });
  }
});

// HEALTH
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    version: '4.0.0', 
    agents: 10, 
    multiUser: true,
    emailConfigured: !!process.env.RESEND_API_KEY,
    emailFrom: emailFrom
  });
});

// PAGES
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/landing', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║           🦅 OPEN CLAW ENTERPRISE v4.0 🦅                ║
╠══════════════════════════════════════════════════════════╣
║  Status:  ✅ LIVE on port ${PORT}                          ║
║  AI:      🧠 Groq llama-3.3-70b-versatile                ║
║  Agents:  10 Specialist Agents Ready                     ║
║  Email:   ${process.env.RESEND_API_KEY ? '✅ RESEND CONFIGURED' : '⚠️  SCREEN-ONLY'}        ║
║  From:    ${emailFrom}                    ║
╚══════════════════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => { process.exit(0); });
process.on('SIGINT', () => { process.exit(0); });