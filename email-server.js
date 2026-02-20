import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// ALLOW ALL CORS (for development)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Send verification email
app.post('/api/send-code', async (req, res) => {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code with timestamp (expires in 10 minutes)
    verificationCodes.set(email, {
        code: code,
        timestamp: Date.now(),
        attempts: 0
    });

    try {
        // Send BEAUTIFUL email
        const { data, error } = await resend.emails.send({
            from: 'Open Claw Enterprise <onboarding@resend.dev>', // Use this for testing
            to: [email],
            subject: '🔐 Your Secure Access Code - Open Claw Enterprise',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { 
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            background: #0a0a0a;
                            margin: 0;
                            padding: 20px;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            background: linear-gradient(145deg, #1a1a1a, #0f0f0f);
                            border: 2px solid #ffd700;
                            border-radius: 20px;
                            padding: 40px;
                            text-align: center;
                        }
                        .logo {
                            font-size: 48px;
                            margin-bottom: 10px;
                        }
                        h1 {
                            color: #ffd700;
                            font-family: 'Orbitron', sans-serif;
                            margin: 0;
                            font-size: 28px;
                            text-transform: uppercase;
                            letter-spacing: 3px;
                        }
                        .subtitle {
                            color: #666;
                            font-size: 14px;
                            margin-top: 10px;
                            letter-spacing: 2px;
                        }
                        .code-box {
                            background: rgba(255, 215, 0, 0.1);
                            border: 2px solid #ffd700;
                            border-radius: 15px;
                            padding: 30px;
                            margin: 30px 0;
                        }
                        .code {
                            font-size: 48px;
                            font-weight: 900;
                            color: #ffd700;
                            letter-spacing: 10px;
                            font-family: 'Courier New', monospace;
                            text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
                        }
                        .warning {
                            color: #ff6b6b;
                            font-size: 12px;
                            margin-top: 20px;
                        }
                        .footer {
                            color: #444;
                            font-size: 12px;
                            margin-top: 30px;
                            border-top: 1px solid #333;
                            padding-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="logo">🚀</div>
                        <h1>OPEN CLAW</h1>
                        <p class="subtitle">ENTERPRISE AI AGENT v2.0</p>
                        
                        <div class="code-box">
                            <p style="color: #fff; margin-bottom: 15px;">Your Secure Verification Code</p>
                            <div class="code">${code}</div>
                            <p style="color: #666; font-size: 12px; margin-top: 15px;">
                                ⏱️ Expires in 10 minutes
                            </p>
                        </div>
                        
                        <p class="warning">
                            🔒 Never share this code with anyone.<br>
                            If you didn't request this, ignore this email.
                        </p>
                        
                        <div class="footer">
                            <p>© 2026 Open Claw Enterprise</p>
                            <p>Secure AI Development Platform</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });

        if (error) {
            console.error('Resend error:', error);
            return res.status(500).json({ error: 'Failed to send email' });
        }

        console.log(`✅ Email sent to ${email} with code: ${code}`);
        
        res.json({ 
            success: true, 
            message: 'Verification code sent!',
            emailId: data?.id 
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Verify code
app.post('/api/verify-code', (req, res) => {
    const { email, code } = req.body;
    
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
        
        // Create session
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

// Check health
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        emailService: 'Resend',
        configured: !!process.env.RESEND_API_KEY
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`📧 Email Server running on http://localhost:${PORT}`);
    console.log(`🔑 Resend API: ${process.env.RESEND_API_KEY ? '✅ Configured' : '❌ Not set'}`);
});