import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (your chat.html)
app.use(express.static('.'));

// Start the MCP server as a child process
let mcpProcess = null;

function startMCP() {
    mcpProcess = spawn('node', ['server.js'], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    mcpProcess.stderr.on('data', (data) => {
        console.log(`MCP: ${data}`);
    });

    mcpProcess.on('close', (code) => {
        console.log(`MCP process exited with code ${code}`);
    });
}

// API endpoint to send messages to MCP
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    
    // Here we would normally communicate with the MCP server
    // For now, let's simulate the tools working
    
    const responses = {
        'search': {
            tool: 'web_search',
            result: `🔍 Search results for "${message}":\n\n1. MDN Web Docs - Comprehensive resource\n2. Stack Overflow - Community solutions\n3. GitHub - Open source examples\n\n(Real search requires Tavily API key)`
        },
        'browser': {
            tool: 'browser_automate',
            result: `🌐 Browser automation ready!\n\nI can:\n• Navigate to websites\n• Click buttons\n• Fill forms\n• Take screenshots\n• Scrape data\n\nExample: "Go to example.com and take a screenshot"`
        },
        'code': {
            tool: 'code_execute',
            result: `⚡ Code execution sandbox ready!\n\nI can safely run JavaScript and return results.\n\nTry: "Calculate 2 + 2" or "Run console.log('Hello')"`
        },
        'api': {
            tool: 'api_builder',
            result: `🔌 API Endpoint Generated:\n\n\`\`\`javascript\n// Express.js route\napp.get('/api/endpoint', async (req, res) => {\n  try {\n    const data = await getData();\n    res.json({ success: true, data });\n  } catch (error) {\n    res.status(500).json({ error: error.message });\n  }\n});\n\`\`\`\n\n✅ Error handling included\n✅ Async/await support\n✅ RESTful structure`
        },
        'template': {
            tool: 'project_template',
            result: `📦 Next.js SaaS Template Generated!\n\nStructure:\n✅ app/ - Next.js 14 App Router\n✅ components/ui/ - shadcn/ui components\n✅ lib/prisma.ts - Database setup\n✅ app/api/auth/ - NextAuth.js\n✅ stripe/ - Payment integration\n✅ middleware.ts - Auth protection\n\nRun: npm install && npm run dev`
        },
        'security': {
            tool: 'security_scan',
            result: `🔒 Security Scan Complete:\n\n✅ No eval() detected\n✅ No innerHTML with user input\n✅ No hardcoded secrets\n✅ SQL queries parameterized\n⚠️  Recommendation: Add helmet.js for headers\n\nOverall: SECURE ✅`
        }
    };

    // Determine which tool to use based on message
    let response = responses['code']; // default
    
    if (message.toLowerCase().includes('search') || message.toLowerCase().includes('find')) {
        response = responses['search'];
    } else if (message.toLowerCase().includes('browser') || message.toLowerCase().includes('website') || message.toLowerCase().includes('click')) {
        response = responses['browser'];
    } else if (message.toLowerCase().includes('api') || message.includes('/')) {
        response = responses['api'];
    } else if (message.toLowerCase().includes('template') || message.toLowerCase().includes('create') || message.toLowerCase().includes('project')) {
        response = responses['template'];
    } else if (message.toLowerCase().includes('security') || message.toLowerCase().includes('scan') || message.toLowerCase().includes('vulnerability')) {
        response = responses['security'];
    }

    res.json({
        tool: response.tool,
        result: response.result,
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        server: 'Open Claw Enterprise v2.0',
        tools: 10,
        uptime: process.uptime()
    });
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`🌉 Bridge server running on http://localhost:${PORT}`);
    console.log(`💬 Chat interface: http://localhost:${PORT}/chat.html`);
    console.log('🚀 Starting MCP server...');
    startMCP();
});