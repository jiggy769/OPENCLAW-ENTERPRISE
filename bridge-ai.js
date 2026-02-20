import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const codes = new Map();
const chats = new Map();
const MY_EMAIL = 'jamesarnold6608@gmail.com';

// ==========================================
// EMAIL API - ALWAYS SHOWS CODE
// ==========================================

app.post('/api/send-code', async (req, res) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    codes.set(MY_EMAIL, { code, time: Date.now() });
    
    console.log('🔐 CODE GENERATED:', code, 'for', MY_EMAIL);

    // Try to send email, but ALWAYS return code
    let emailSent = false;
    
    try {
        const result = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: [MY_EMAIL],
            subject: 'Your Open Claw Code: ' + code,
            html: `<div style="background:#000; color:#ffd700; padding:40px; text-align:center; font-size:48px; border:3px solid #ffd700; font-family:Arial;"><div style="font-size:16px; color:#666; margin-bottom:20px;">OPEN CLAW ENTERPRISE</div>${code}<div style="font-size:14px; color:#666; margin-top:20px;">Your verification code</div></div>`
        });
        
        if (!result.error) {
            emailSent = true;
            console.log('✅ Email sent successfully');
        }
    } catch (err) {
        console.log('⚠️ Email failed (expected in testing):', err.message);
    }

    // ALWAYS return success with the code visible
    res.json({ 
        success: true, 
        message: emailSent ? 'Code sent to your email!' : 'Use this code to login:',
        code: code,  // ALWAYS SHOW THE CODE
        emailSent: emailSent,
        instructions: 'Enter this 6-digit code below'
    });
});

app.post('/api/verify-code', (req, res) => {
    const { code } = req.body;
    const stored = codes.get(MY_EMAIL);
    
    if (!stored) {
        return res.status(400).json({ error: 'No code found. Click "Send Code" first.' });
    }
    
    if (Date.now() - stored.time > 600000) {
        codes.delete(MY_EMAIL);
        return res.status(400).json({ error: 'Code expired. Request new code.' });
    }
    
    if (stored.code !== code) {
        return res.status(400).json({ error: 'Invalid code. Try again.' });
    }
    
    codes.delete(MY_EMAIL);
    const token = 'tok_' + Math.random().toString(36).substr(2, 16);
    chats.set(token, []);
    
    res.json({ 
        success: true, 
        message: 'Welcome to Open Claw Enterprise!',
        session: { email: MY_EMAIL, token: token }
    });
});

// ==========================================
// AI CHAT API
// ==========================================

app.post('/api/chat', async (req, res) => {
    const { message, sessionToken } = req.body;
    
    if (!message) return res.status(400).json({ error: 'No message' });
    if (!sessionToken) return res.status(401).json({ error: 'Not logged in' });
    
    let history = chats.get(sessionToken) || [];
    history.push({ role: 'user', content: message });
    
    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 2000,
            messages: history
        });
        
        const reply = response.content[0].text;
        history.push({ role: 'assistant', content: reply });
        chats.set(sessionToken, history);
        
        res.json({ result: reply, tool: 'claude' });
        
    } catch (err) {
        console.error('Claude error:', err);
        res.status(500).json({ error: 'AI error: ' + err.message });
    }
});

// ==========================================
// SERVE HTML FILES - ALL ROUTES
// ==========================================

function serveFile(filename) {
    try {
        return readFileSync('./' + filename, 'utf8');
    } catch (e) {
        return `Error: ${filename} not found. Make sure the file exists.`;
    }
}

// All possible routes
app.get('/', (req, res) => res.send(serveFile('login.html')));
app.get('/login', (req, res) => res.send(serveFile('login.html')));
app.get('/login.html', (req, res) => res.send(serveFile('login.html')));
app.get('/chat', (req, res) => res.send(serveFile('chat.html')));
app.get('/chat.html', (req, res) => res.send(serveFile('chat.html')));

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        ai: process.env.ANTHROPIC_API_KEY ? '✅ Claude' : '❌ No AI',
        email: process.env.RESEND_API_KEY ? '✅ Resend' : '❌ No Email'
    });
});

// ==========================================
// START
// ==========================================

const PORT = 3000;
app.listen(PORT, () => {
    console.log('╔════════════════════════════════════╗');
    console.log('║   🔥 OPEN CLAW ENTERPRISE v3.0     ║');
    console.log('╠════════════════════════════════════╣');
    console.log('║  🤖 AI: ' + (process.env.ANTHROPIC_API_KEY ? '✅ CONNECTED' : '❌ OFFLINE') + '        ║');
    console.log('║  📧 Email: ' + (process.env.RESEND_API_KEY ? '✅ READY' : '❌ OFFLINE') + '          ║');
    console.log('╠════════════════════════════════════╣');
    console.log('║  🌐 http://localhost:3000          ║');
    console.log('║  🔐 Login: /login or /login.html   ║');
    console.log('║  💬 Chat: /chat or /chat.html       ║');
    console.log('╚════════════════════════════════════╝');
});