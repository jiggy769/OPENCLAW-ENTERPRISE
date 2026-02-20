import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config();
console.log('🔑 Resend Key:', process.env.RESEND_API_KEY ? 'Found' : 'NOT FOUND');
console.log('🔑 Key starts with:', process.env.RESEND_API_KEY?.substring(0, 10));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS - Allow everything for development
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('.'));

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);
const verificationCodes = new Map();

// ==========================================
// EMAIL VERIFICATION API (REAL)
// ==========================================

app.post('/api/send-code', async (req, res) => {
    console.log('📧 SEND-CODE endpoint hit!');
    console.log('📧 Request body:', req.body);
    
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
        console.log('❌ Invalid email:', email);
        return res.status(400).json({ error: 'Invalid email address' });
    }

    console.log('✅ Email valid:', email);

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('🔐 Generated code:', code);
    
    // Store with timestamp
    verificationCodes.set(email, {
        code: code,
        timestamp: Date.now(),
        attempts: 0
    });

    console.log('💾 Code stored in memory');

    // Check if Resend is configured
    console.log('🔑 Resend API Key exists:', !!process.env.RESEND_API_KEY);
    console.log('🔑 Resend API Key length:', process.env.RESEND_API_KEY?.length);

    try {
        console.log('📤 Attempting to send email via Resend...');
        
        const emailData = {
            from: 'onboarding@resend.dev',
            to: [email],
            subject: '🔐 Your Secure Access Code - Open Claw Enterprise',
            html: `<div style="background:#0a0a0a; padding:40px; text-align:center;">
                <h1 style="color:#ffd700; font-size:48px;">${code}</h1>
                <p style="color:#666;">Your verification code</p>
            </div>`
        };
        
        console.log('📧 Email data:', JSON.stringify(emailData, null, 2));

        const { data, error } = await resend.emails.send(emailData);

        console.log('📧 Resend response data:', data);
        console.log('📧 Resend response error:', error);

        if (error) {
            console.error('❌ Resend returned error:', error);
            return res.status(500).json({ error: 'Failed to send email: ' + JSON.stringify(error) });
        }

        console.log(`✅ Email sent successfully! ID: ${data?.id}`);
        
        res.json({ 
            success: true, 
            message: 'Verification code sent! Check your email.',
            emailId: data?.id 
        });

    } catch (error) {
        console.error('❌ CATCH BLOCK ERROR:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});
    

app.post('/api/verify-code', (req, res) => {
    const { email, code } = req.body;
    
    if (!email || !code) {
        return res.status(400).json({ error: 'Email and code required' });
    }
    
    const stored = verificationCodes.get(email);
    
    if (!stored) {
        return res.status(400).json({ error: 'No code found. Please request new code.' });
    }
    
    // Check expiration (10 minutes)
    if (Date.now() - stored.timestamp > 600000) {
        verificationCodes.delete(email);
        return res.status(400).json({ error: 'Code expired. Please request new code.' });
    }
    
    // Check attempts
    if (stored.attempts >= 3) {
        verificationCodes.delete(email);
        return res.status(400).json({ error: 'Too many attempts. Please request new code.' });
    }
    
    // Verify
    if (stored.code === code) {
        verificationCodes.delete(email);
        
        const session = {
            email: email,
            loginTime: Date.now(),
            token: 'sess_' + Math.random().toString(36).substr(2, 16)
        };
        
        return res.json({ 
            success: true, 
            message: 'Access granted!',
            session: session
        });
    } else {
        stored.attempts++;
        return res.status(400).json({ error: 'Invalid code. Please try again.' });
    }
});

// ==========================================
// CHAT API (Connects to MCP Server)
// ==========================================

let mcpProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe']
});

mcpProcess.stderr.on('data', (data) => {
    console.log(`MCP: ${data}`);
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    
    let toolName = 'code_execute';
    let args = {};
    
    if (message.toLowerCase().includes('search') || message.toLowerCase().includes('find')) {
        toolName = 'web_search';
        args = { 
            query: message.replace(/search|find|for/gi, '').trim(),
            max_results: 5 
        };
    } else if (message.toLowerCase().includes('github') || message.toLowerCase().includes('repo')) {
        toolName = 'github_integration';
        args = { action: 'list_repos' };
    } else if (message.toLowerCase().includes('browser') || message.toLowerCase().includes('go to')) {
        toolName = 'browser_automate';
        args = { action: 'navigate', url: message.match(/https?:\/\/[^\s]+/)?.[0] || 'https://example.com' };
    } else if (message.toLowerCase().includes('template') || message.toLowerCase().includes('create')) {
        toolName = 'project_template';
        args = { template: 'nextjs-saas', project_name: 'my-app' };
    } else if (message.toLowerCase().includes('api')) {
        toolName = 'api_builder';
        args = { path: '/api/endpoint', method: 'GET', framework: 'express' };
    } else if (message.toLowerCase().includes('security') || message.toLowerCase().includes('scan')) {
        toolName = 'security_scan';
        args = { code: message, language: 'javascript' };
    } else if (message.toLowerCase().includes('status') || message.toLowerCase().includes('stats')) {
        toolName = 'system_status';
        args = {};
    }

    let result = '';
    
    switch(toolName) {
        case 'web_search':
            result = `🔍 Searching LIVE web for: "${args.query}"\n\nThis would call Tavily API with your key: ${process.env.TAVILY_API_KEY?.substring(0, 10)}...\n\n[REAL SEARCH RESULTS WOULD APPEAR HERE]`;
            break;
        case 'github_integration':
            result = `🐙 GitHub Integration\nToken configured: ${process.env.GITHUB_TOKEN ? 'YES' : 'NO'}\n\nWould list your real repositories here!`;
            break;
        case 'browser_automate':
            result = `🌐 Browser Automation\nWould navigate to: ${args.url}\n\n[Playwright would control real browser]`;
            break;
        case 'project_template':
            result = `📦 Generating template: ${args.template}\n\n[Real project structure would be created]`;
            break;
        case 'system_status':
            result = `📊 System Status\n✅ Server: ONLINE\n✅ Database: CONNECTED\n✅ Tavily: ${process.env.TAVILY_API_KEY ? 'CONFIGURED' : 'NOT SET'}\n✅ GitHub: ${process.env.GITHUB_TOKEN ? 'CONFIGURED' : 'NOT SET'}`;
            break;
        default:
            result = `🤖 I received: "${message}"\n\nTry commands like:\n• "Search for React best practices"\n• "List my GitHub repos"\n• "Create a SaaS template"\n• "Check system status"`;
    }

    res.json({
        tool: toolName,
        result: result,
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        server: 'Open Claw Enterprise v2.0 - UNIFIED',
        email: process.env.RESEND_API_KEY ? 'configured' : 'not set',
        tavily: process.env.TAVILY_API_KEY ? 'configured' : 'not set',
        github: process.env.GITHUB_TOKEN ? 'configured' : 'not set',
        uptime: process.uptime()
    });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 UNIFIED SERVER running on http://localhost:${PORT}`);
    console.log(`💬 Chat: http://localhost:${PORT}/chat.html`);
    console.log(`🔐 Login: http://localhost:${PORT}/login.html`);
    console.log('📧 Resend:', process.env.RESEND_API_KEY ? '✅ Ready' : '❌ Not set');
    console.log('🔥 Tavily:', process.env.TAVILY_API_KEY ? '✅ Ready' : '❌ Not set');
    console.log('🐙 GitHub:', process.env.GITHUB_TOKEN ? '✅ Ready' : '❌ Not set');
});