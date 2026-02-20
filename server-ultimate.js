#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Groq with YOUR key
const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY || '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'
});

// ==========================================
// 10 SPECIALIST AGENTS + ORCHESTRATOR
// ==========================================

const TOOLS = [
  {
    name: "orchestrate_task",
    description: "🎯 MASTER ORCHESTRATOR - Coordinates all 10 specialist agents for complex tasks",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Full task description" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"], default: "high" }
      },
      required: ["task"]
    }
  },
  {
    name: "market_research",
    description: "🔍 Market Intelligence - Competitors, trends, pricing, sentiment analysis",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to research" },
        competitors: { type: "array", items: { type: "string" } },
        industry: { type: "string" }
      },
      required: ["query"]
    }
  },
  {
    name: "product_design",
    description: "🎨 UX Architect - Wireframes, user flows, design systems, A/B tests",
    inputSchema: {
      type: "object",
      properties: {
        page_type: { type: "string", enum: ["landing", "dashboard", "checkout", "onboarding"] },
        features: { type: "array", items: { type: "string" } }
      },
      required: ["page_type"]
    }
  },
  {
    name: "backend_engineer",
    description: "⚙️ Backend Architect - Database, APIs, microservices, security",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", enum: ["database", "api", "microservice", "security"] },
        requirements: { type: "string" }
      },
      required: ["task"]
    }
  },
  {
    name: "frontend_engineer",
    description: "🎭 Frontend Developer - React/Vue components, performance, accessibility",
    inputSchema: {
      type: "object",
      properties: {
        component: { type: "string" },
        framework: { type: "string", enum: ["react", "vue", "nextjs"], default: "react" }
      },
      required: ["component"]
    }
  },
  {
    name: "communications",
    description: "📧 Communications Pro - Email sequences, notifications, support, scheduling",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["email_sequence", "notifications", "support", "meeting"] },
        purpose: { type: "string" }
      },
      required: ["type", "purpose"]
    }
  },
  {
    name: "sales_marketing",
    description: "💰 Growth Hacker - Lead gen, outreach, landing pages, CRM",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", enum: ["leads", "outreach", "landing", "crm"] },
        target: { type: "string" }
      },
      required: ["task"]
    }
  },
  {
    name: "devops_security",
    description: "🔒 DevOps Engineer - CI/CD, Docker, cloud, security scanning",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", enum: ["cicd", "docker", "deploy", "security"] },
        platform: { type: "string", default: "vercel" }
      },
      required: ["task"]
    }
  },
  {
    name: "data_analyst",
    description: "📊 Data Scientist - SQL, dashboards, A/B tests, predictions",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", enum: ["sql", "dashboard", "ab_test", "prediction"] },
        data: { type: "string" }
      },
      required: ["task"]
    }
  },
  {
    name: "qa_documentation",
    description: "🧪 QA Engineer - Tests, docs, tutorials, changelogs",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["tests", "docs", "tutorial", "changelog"] },
        subject: { type: "string" }
      },
      required: ["type", "subject"]
    }
  }
];

// Agent prompts
const AGENTS = {
  orchestrator: `You are the CEO of Open Claw Enterprise. Analyze the task and create a detailed execution plan using multiple specialist agents. Break down complex projects into phases and assign the right agents.`,
  
  market_research: `You are a Senior Market Research Analyst with 10+ years experience. Provide deep competitive analysis, trend forecasting, and actionable market intelligence. Be specific with data and sources.`,
  
  product_design: `You are a Principal UX Designer. Create detailed wireframes, user flows, and design systems focused on conversion optimization.`,
  
  backend_engineer: `You are a Staff Backend Engineer. Design scalable systems, databases, and APIs with production-ready architecture.`,
  
  frontend_engineer: `You are a Senior Frontend Architect. Generate modern React components with TypeScript, focusing on performance and accessibility.`,
  
  communications: `You are a Communications Director. Write compelling email sequences and notification strategies.`,
  
  sales_marketing: `You are a Growth Marketing Lead. Create lead generation strategies and high-converting copy.`,
  
  devops_security: `You are a DevSecOps Engineer. Design CI/CD pipelines and security hardening.`,
  
  data_analyst: `You are a Data Scientist. Write complex SQL and build analytics dashboards.`,
  
  qa_documentation: `You are a QA Lead + Technical Writer. Generate comprehensive tests and documentation.`
};

// ==========================================
// AI FUNCTION
// ==========================================

async function callAI(agentType, userPrompt) {
  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: "system", content: AGENTS[agentType] },
        { role: "user", content: userPrompt }
      ],
      model: "llama-3.1-70b-versatile",
      temperature: 0.7,
      max_tokens: 4096,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error("AI Error:", error);
    return `Error: ${error.message}`;
  }
}

// ==========================================
// SERVER SETUP
// ==========================================

const server = new Server(
  { name: "open-claw-ultimate", version: "3.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`🛠️  Agent: ${name}`);

  try {
    // ORCHESTRATOR
    if (name === "orchestrate_task") {
      const result = await callAI("orchestrator", 
        `TASK: ${args.task}\nPRIORITY: ${args.priority}\n\nCreate a detailed execution plan with agent assignments.`);
      
      return {
        content: [{
          type: "text",
          text: `🎯 **ORCHESTRATOR PLAN**\n\n${result}\n\n---\n**Next:** Call specific agents to execute each phase.`
        }]
      };
    }
    
    // MARKET RESEARCH
    if (name === "market_research") {
      const result = await callAI("market_research",
        `Research: ${args.query}\nCompetitors: ${args.competitors?.join(', ') || 'N/A'}\nIndustry: ${args.industry || 'tech'}`);
      
      return {
        content: [{
          type: "text",
          text: `🔍 **MARKET INTELLIGENCE**\n\n${result}`
        }]
      };
    }
    
    // PRODUCT DESIGN
    if (name === "product_design") {
      const result = await callAI("product_design",
        `Design ${args.page_type} with features: ${args.features?.join(', ') || 'standard'}`);
      
      return {
        content: [{
          type: "text",
          text: `🎨 **DESIGN SYSTEM**\n\n${result}`
        }]
      };
    }
    
    // BACKEND ENGINEER
    if (name === "backend_engineer") {
      const result = await callAI("backend_engineer",
        `Task: ${args.task}\nRequirements: ${args.requirements}`);
      
      return {
        content: [{
          type: "text",
          text: `⚙️ **BACKEND ARCHITECTURE**\n\n${result}`
        }]
      };
    }
    
    // FRONTEND ENGINEER
    if (name === "frontend_engineer") {
      const result = await callAI("frontend_engineer",
        `Component: ${args.component}\nFramework: ${args.framework}`);
      
      return {
        content: [{
          type: "text",
          text: `🎭 **COMPONENT CODE**\n\n${result}`
        }]
      };
    }
    
    // COMMUNICATIONS
    if (name === "communications") {
      const result = await callAI("communications",
        `Type: ${args.type}\nPurpose: ${args.purpose}`);
      
      return {
        content: [{
          type: "text",
          text: `📧 **COMMUNICATIONS**\n\n${result}`
        }]
      };
    }
    
    // SALES & MARKETING
    if (name === "sales_marketing") {
      const result = await callAI("sales_marketing",
        `Task: ${args.task}\nTarget: ${args.target}`);
      
      return {
        content: [{
          type: "text",
          text: `💰 **GROWTH STRATEGY**\n\n${result}`
        }]
      };
    }
    
    // DEVOPS & SECURITY
    if (name === "devops_security") {
      const result = await callAI("devops_security",
        `Task: ${args.task}\nPlatform: ${args.platform}`);
      
      return {
        content: [{
          type: "text",
          text: `🔒 **DEVOPS & SECURITY**\n\n${result}`
        }]
      };
    }
    
    // DATA ANALYST
    if (name === "data_analyst") {
      const result = await callAI("data_analyst",
        `Task: ${args.task}\nData: ${args.data}`);
      
      return {
        content: [{
          type: "text",
          text: `📊 **DATA ANALYSIS**\n\n${result}`
        }]
      };
    }
    
    // QA & DOCUMENTATION
    if (name === "qa_documentation") {
      const result = await callAI("qa_documentation",
        `Type: ${args.type}\nSubject: ${args.subject}`);
      
      return {
        content: [{
          type: "text",
          text: `🧪 **QA & DOCUMENTATION**\n\n${result}`
        }]
      };
    }
    
    return {
      content: [{ type: "text", text: `Unknown: ${name}` }],
      isError: true
    };

  } catch (error) {
    return {
      content: [{ type: "text", text: `❌ Error: ${error.message}` }],
      isError: true
    };
  }
});

// ==========================================
// START
// ==========================================

const transport = new StdioServerTransport();
console.error("╔══════════════════════════════════════════════════════╗");
console.error("║  🔥 OPEN CLAW ULTIMATE v3.0 - 10 AGENT SWARM         ║");
console.error("╠══════════════════════════════════════════════════════╣");
console.error("║  🤖 AI: Groq Llama 3.1 70B (FREE - 1M tokens/day)    ║");
console.error("║  👥 Agents: 10 Specialists + 1 Orchestrator          ║");
console.error("║  💰 Cost: $0 FOREVER                                 ║");
console.error("╠══════════════════════════════════════════════════════╣");
console.error("║  AGENTS READY:                                       ║");
console.error("║  🎯 Orchestrator  🔍 Market Research                ║");
console.error("║  🎨 Product Design ⚙️ Backend Engineer               ║");
console.error("║  🎭 Frontend Eng   📧 Communications                 ║");
console.error("║  💰 Sales/Marketing 🔒 DevOps/Security              ║");
console.error("║  📊 Data Analyst   🧪 QA/Documentation               ║");
console.error("╚══════════════════════════════════════════════════════╝");
console.error("Waiting for connection...");

await server.connect(transport);