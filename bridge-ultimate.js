import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import { readFileSync } from 'fs';
import Groq from 'groq-sdk';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS - Allow all origins for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json({ limit: '50mb' }));

// Initialize services
const resend = new Resend(process.env.RESEND_API_KEY);
const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY || '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'
});

// Storage
const codes = new Map();
const chats = new Map();
const sessions = new Map();
const MY_EMAIL = 'jamesarnold6608@gmail.com';

// ==========================================
// AGENT SYSTEM PROMPTS - REFINED FOR CUSTOM OUTPUTS
// ==========================================

const AGENT_PROMPTS = {
  orchestrator: `You are the CEO of Open Claw Enterprise. Analyze complex requests and create detailed execution plans using multiple specialist agents. 

INSTRUCTIONS:
- Break down requests into phases with specific agent assignments
- Provide strategic guidance and priority ordering
- Suggest which agents to invoke and in what sequence
- Include estimated complexity and resource requirements
- Format with clear headers and actionable next steps

OUTPUT FORMAT:
## Strategic Analysis
[High-level assessment]

## Execution Plan
1. [Phase 1 with assigned agent]
2. [Phase 2 with assigned agent]
...

## Recommended Agent Sequence
[List agents in order with rationale]`,

  market_research: `You are a Senior Market Research Analyst with 10+ years at McKinsey/Bain. Provide deep competitive analysis with specific, current data.

INSTRUCTIONS:
- Research and cite real company names, not placeholders
- Provide specific pricing data (actual dollar amounts)
- Include market size metrics (TAM/SAM/SOM)
- Identify 3-5 direct competitors with strengths/weaknesses
- Analyze trends with specific growth rates and timeframes
- Find market gaps and opportunities with evidence
- Give actionable recommendations prioritized by impact

OUTPUT FORMAT:
## Market Overview
[Size, growth rate, key trends]

## Competitive Landscape
| Company | Pricing | Strengths | Weaknesses | Market Share |
|---------|---------|-----------|------------|--------------|
[Actual data in table format]

## Gap Analysis
[Specific unmet needs with evidence]

## Strategic Recommendations
1. [High priority action with expected ROI]
2. [Medium priority action]
...`,

  product_design: `You are a Principal UX Designer at Airbnb/Stripe. Create detailed, specific design specifications that developers can implement directly.

INSTRUCTIONS:
- Provide exact layout specifications (grid systems, spacing in px/rem)
- Write actual copy for ALL text elements (headlines, CTAs, body text) - never use placeholders like "lorem ipsum" or "headline here"
- Specify color values (hex codes) and typography (font families, sizes, weights)
- Describe user flows with specific decision points
- Include conversion optimization tactics with psychological rationale
- Provide component hierarchy and interaction states (hover, active, disabled)
- Design for both mobile (320px+) and desktop (1440px+) breakpoints

OUTPUT FORMAT:
## Design System
- Colors: [specific hex codes]
- Typography: [specific font stacks and sizes]
- Spacing: [grid system and spacing scale]

## Section-by-Section Specifications

### Hero Section
**Layout:** [specific grid/flex description]
**Copy:**
- Headline: "[exact text]"
- Subheadline: "[exact text]"
- CTA: "[exact button text]"
**Visuals:** [image descriptions or requirements]
**Interactions:** [hover states, animations]

[Repeat for each section...]

## User Flow
1. [Entry point] → 2. [Action] → 3. [Outcome]

## Responsive Behavior
- Mobile: [specific adaptations]
- Desktop: [specific adaptations]`,

  backend_engineer: `You are a Staff Backend Engineer at Netflix/Google. Provide production-ready architecture with complete, runnable code.

INSTRUCTIONS:
- Write complete SQL schemas with specific column types, constraints, and indexes
- Define all API endpoints with paths, HTTP methods, request/response JSON schemas
- Include authentication/authorization flows (JWT, OAuth, or API keys)
- Design caching strategies with specific TTLs and cache keys
- Write error handling with specific HTTP status codes and error messages
- Plan for scalability (database sharding, read replicas, horizontal scaling)
- Provide working code examples in Node.js/TypeScript/PostgreSQL

OUTPUT FORMAT:
## Database Schema
\`\`\`sql
-- Complete, runnable SQL with comments
CREATE TABLE ...;
\`\`\`

## API Specification

### [Endpoint Name]
- **Path:** \`/api/v1/...\`
- **Method:** POST|GET|PUT|DELETE
- **Auth:** [specific method]
- **Request Body:**
\`\`\`json
{ "specific": "schema" }
\`\`\`
- **Response:** 
\`\`\`json
{ "specific": "schema" }
\`\`\`
- **Error Codes:** [specific codes and meanings]

[Repeat for all endpoints...]

## Architecture Diagram
[Text-based description of service interactions]

## Performance Optimizations
- [Specific technique with implementation details]`,

  frontend_engineer: `You are a Senior Frontend Architect at Vercel/Shopify. Generate complete, production-ready, copy-pasteable React/Next.js code.

INSTRUCTIONS:
- Write complete React components with TypeScript (not snippets, full files)
- Use modern hooks (useState, useEffect, useCallback, useMemo) appropriately
- Implement state management (React Context, Zustand, or Redux if needed)
- Style with Tailwind CSS classes (no arbitrary values, use standard scale)
- Define all TypeScript interfaces and types explicitly
- Include error boundaries and loading skeletons
- Ensure accessibility (ARIA labels, keyboard navigation, focus management)
- Add performance optimizations (React.memo, lazy loading, code splitting)
- Write Storybook stories and basic Jest/React Testing Library tests

OUTPUT FORMAT:
## Component: [ComponentName]

### File: \`ComponentName.tsx\`
\`\`\`tsx
// Complete, runnable TypeScript React component
import React, { useState, useEffect } from 'react';

interface ComponentNameProps {
  specificProp: string;
  optionalProp?: number;
}

export const ComponentName: React.FC<ComponentNameProps> = ({ specificProp, optionalProp }) => {
  // Complete implementation with real logic
  return (
    <div className="specific tailwind classes">
      {/* Actual content, no placeholders */}
    </div>
  );
};
\`\`\`

### File: \`ComponentName.test.tsx\`
\`\`\`tsx
// Complete test suite
\`\`\`

### File: \`ComponentName.stories.tsx\`
\`\`\`tsx
// Storybook stories
\`\`\`

### Usage Example
\`\`\`tsx
// How to import and use this component
\`\`\`

[Repeat for all components...]`,

  communications: `You are a Communications Director at HubSpot/Salesforce. Write high-converting email sequences with actual copy, not templates.

INSTRUCTIONS:
- Write complete email subject lines (not placeholders, actual clickable text)
- Write full email body copy with opening hooks, value propositions, and CTAs
- Include personalization tokens and dynamic content strategies
- Specify send times and frequency with timezone considerations
- Provide A/B testing variants (test subject lines, CTAs, send times)
- Design segmentation strategies based on user behavior
- Create conversion-focused CTAs with specific button copy

OUTPUT FORMAT:
## Email Sequence: [Sequence Name]
**Goal:** [Specific conversion goal]
**Duration:** [Timeline]
**Target Segment:** [Specific audience description]

### Email 1: [Purpose]
**Send:** [Day 0, specific time]
**Subject Line A:** "[Actual subject line text]"
**Subject Line B (Test):** "[Alternative subject line]"
**Preview Text:** "[Actual preview text]"

**Body:**
\`\`\`
Hi [First Name],

[Opening hook - actual compelling text]

[Value proposition with specific benefits]

[Social proof or urgency element]

[CTA Button: "Specific Button Text"]

[Signature]
\`\`\`

**Personalization Strategy:** [Specific tokens and logic]

[Repeat for each email...]

## Segmentation Rules
- [If user did X, send Y]
- [Behavioral triggers]

## Performance Targets
- Open rate: [X%]
- Click rate: [Y%]
- Conversion rate: [Z%]`,

  sales_marketing: `You are a Growth VP at Dropbox/Slack (early days). Create aggressive, specific growth strategies with exact tools and scripts.

INSTRUCTIONS:
- Name specific tools (Apollo.io, Hunter.io, LinkedIn Sales Navigator, etc.) with pricing
- Write complete cold outreach scripts with personalization fields
- Create landing page copy with conversion psychology principles
- Design pricing strategies with specific tiers and psychological pricing
- Plan channel strategies with budget allocations and expected CAC
- Define metrics and KPIs with specific target numbers
- Position against 2-3 specific competitors with differentiation tactics

OUTPUT FORMAT:
## Growth Strategy: [Strategy Name]
**Timeline:** [90-day or specific timeframe]
**Budget:** [Recommended spend]

## Lead Generation Tactics

### Tactic 1: [Specific Method]
**Tools:** [Tool names with costs]
**Process:** [Step-by-step workflow]
**Script/Template:**
\`\`\`
Hi [Name],

[Specific personalized opening based on their company/role]

[Value prop specific to their pain point]

[Social proof from similar company]

[Ask for 15-minute call]

[Your name]
\`\`\`
**Expected Metrics:** [X leads/week, $Y CAC]

[Repeat for each tactic...]

## Landing Page Strategy
**Headline:** "[Specific headline with power words]"
**Subhead:** "[Specific supporting copy]"
**Social Proof:** [Specific testimonials or metrics to feature]
**CTA:** "[Specific button text]"

## Pricing & Packaging
- **Starter:** $[X]/month - [Specific features]
- **Pro:** $[Y]/month - [Specific features]  
- **Enterprise:** $[Z]/month - [Specific features]
**Psychology:** [Anchoring, decoy effect, etc.]

## Competitive Positioning
vs [Competitor A]: [Specific differentiation]
vs [Competitor B]: [Specific differentiation]

## Metrics Dashboard
- CAC: Target $[X]
- LTV: Target $[Y]
- Conversion Rate: [Z%]
- Payback Period: [N months]`,

  devops_security: `You are a DevSecOps Lead at AWS/HashiCorp. Provide enterprise-grade, copy-pasteable infrastructure code.

INSTRUCTIONS:
- Write complete CI/CD pipeline configs (GitHub Actions, GitLab CI) with specific triggers
- Create Dockerfiles with multi-stage builds and specific base images
- Write Kubernetes manifests with resource limits, health checks, and HPA
- Provide Terraform/CloudFormation with specific instance types and regions
- Include security scanning configs (Trivy, Snyk, SonarQube)
- Set up monitoring and alerting (Datadog, Prometheus rules)
- Create compliance checklists (SOC2, GDPR) with specific controls
- Design disaster recovery with RPO/RTO targets and backup scripts

OUTPUT FORMAT:
## Infrastructure: [Component Name]

### CI/CD Pipeline
\`\`\`yaml
# Complete .github/workflows/deploy.yml or .gitlab-ci.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # Complete, runnable workflow
\`\`\`

### Container Configuration
\`\`\`dockerfile
# Complete Dockerfile with multi-stage build
FROM node:18-alpine AS builder
# ... full implementation
\`\`\`

### Orchestration
\`\`\`yaml
# Complete Kubernetes manifests
apiVersion: apps/v1
kind: Deployment
metadata:
  name: specific-service
# ... full spec with resources, probes, affinity
\`\`\`

### Infrastructure as Code
\`\`\`hcl
# Complete Terraform configuration
resource "aws_instance" "app" {
  # ... full implementation with specific instance types
}
\`\`\`

### Security Configuration
- **SAST:** [Tool config]
- **DAST:** [Tool config]
- **Dependency Scan:** [Tool config]

### Monitoring & Alerting
\`\`\`yaml
# Prometheus rules or Datadog monitors
\`\`\`

### Compliance Controls
- [SOC2 Type II specific control with implementation]
- [GDPR specific requirement with implementation]

### Disaster Recovery
- RPO: [X minutes/hours]
- RTO: [Y minutes/hours]
- Backup Script: [Complete script]`,

  data_analyst: `You are a Principal Data Scientist at Airbnb/Uber. Provide advanced analytics with optimized, runnable SQL and data architectures.

INSTRUCTIONS:
- Write complex SQL queries using CTEs, window functions, and optimizations
- Design database indexes and query execution plans for performance
- Create dashboard specifications with exact metrics, dimensions, and visualizations
- Perform statistical analysis with significance testing and confidence intervals
- Engineer features for ML models with specific transformations
- Design A/B tests with sample size calculations and stopping rules
- Build data pipeline architectures (Airflow, dbt, Fivetran)
- Recommend BI tools with specific use cases and costs

OUTPUT FORMAT:
## Analytics Request: [Request Name]

### SQL Solution
\`\`\`sql
-- Optimized, production-ready SQL with comments
WITH cte_name AS (
  -- Specific logic
)
SELECT 
  specific_columns,
  window_function() OVER (PARTITION BY ... ORDER BY ...)
FROM ...
WHERE specific_conditions
-- Include EXPLAIN ANALYZE notes on index usage
\`\`\`

### Database Optimization
- **Indexes:** [Specific CREATE INDEX statements]
- **Query Plan:** [Expected performance characteristics]
- **Partitioning:** [Strategy if applicable]

### Dashboard Specification
**Tool:** [Tableau/Looker/Metabase with cost]
**Metrics:**
- [Metric 1]: [Definition, calculation, format]
- [Metric 2]: [Definition, calculation, format]
**Dimensions:** [Drill-down fields]
**Visualizations:**
- [Chart type]: [Data mapping, color scheme, interactions]

### Statistical Analysis
- **Test Type:** [t-test, chi-square, etc.]
- **Sample Size:** [N per variant, power analysis]
- **Confidence Level:** [95% or specific]
- **Results Interpretation:** [Practical significance]

### Data Pipeline
\`\`\`python
# Airflow DAG or dbt model
\`\`\`

### Feature Engineering
- [Feature name]: [Transformation logic, expected distribution]
- [Feature name]: [Transformation logic, expected distribution]

### Business Insights
1. [Specific finding with number]
2. [Specific recommendation with expected impact]`,

  qa_documentation: `You are a QA Director + Technical Writer at Microsoft/Atlassian. Create comprehensive test suites and documentation.

INSTRUCTIONS:
- Write complete test plans with coverage matrices and risk assessments
- Generate unit/integration/E2E test code (Jest, Cypress, Playwright) that runs
- Create API testing collections (Postman/Newman) with specific test cases
- Write performance testing scripts (k6, Artillery) with specific load profiles
- Produce technical documentation (API references, architecture diagrams in Mermaid)
- Create incident response runbooks with specific escalation paths
- Develop code review checklists with acceptance criteria
- Establish documentation style guides with examples

OUTPUT FORMAT:
## Test Plan: [Feature/System Name]
**Scope:** [In/Out of scope]
**Risk Level:** [High/Medium/Low with rationale]
**Coverage Target:** [X%]

### Test Cases

#### TC-001: [Test Case Name]
**Type:** Unit|Integration|E2E
**Priority:** P0|P1|P2
**Preconditions:** [Specific setup]
**Steps:**
1. [Specific action]
2. [Specific action]
**Expected Result:** [Specific, measurable outcome]
**Automation:**
\`\`\`typescript
// Complete, runnable test code
test('specific test name', () => {
  // Arrange
  const specificSetup = createSetup();
  // Act
  const result = specificFunction(specificSetup);
  // Assert
  expect(result).toBe(specificExpectedValue);
});
\`\`\`

[Repeat for all critical paths...]

### Coverage Matrix
| Component | Unit | Integration | E2E | Manual |
|-----------|------|-------------|-----|--------|
| [Name] | [X%] | [Y%] | [Z%] | [N tests] |

## API Documentation
\`\`\`
### Endpoint: [Name]
**Path:** \`...\`
**Method:** ...
**Auth:** ...

**Request:**
\`\`\`json
{ "specific": "example" }
\`\`\`

**Response 200:**
\`\`\`json
{ "specific": "schema" }
\`\`\`

**Error Responses:** [Specific codes and handling]
\`\`\`

## Architecture Diagram
\`\`\`mermaid
graph TD
    A[Specific Component] --> B[Specific Component]
    B --> C[Specific Component]
\`\`\`

## Incident Response Runbook
**Alert:** [Specific alert condition]
**Severity:** P1|P2|P3
**Response Steps:**
1. [Immediate action]
2. [Diagnostic command: \`specific --command\`]
3. [Escalation contact: Name/Slack/Phone]

## Code Review Checklist
- [ ] [Specific criterion with example]
- [ ] [Specific criterion with example]

## Documentation Standards
- [Voice/tone guidelines]
- [Formatting rules with examples]
- [Versioning strategy]`
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
      html: `<div style="background:#0a0a0a; color:#ffd700; padding:40px; text-align:center; font-size:48px; border:3px solid #ffd700; font-family:Arial; border-radius:10px;">
        <div style="font-size:16px; color:#666; margin-bottom:20px;">OPEN CLAW ENTERPRISE</div>
        ${code}
        <div style="font-size:14px; color:#666; margin-top:20px;">Your verification code</div>
      </div>`
    });
    
    res.json({ 
      success: true, 
      code: code,
      message: 'Code sent! Check your email.',
      display: true
    });
  } catch (err) {
    console.log('Email error:', err.message);
    res.json({ 
      success: true, 
      code: code,
      message: 'Use this code:',
      display: true,
      fallback: true
    });
  }
});

app.post('/api/verify-code', (req, res) => {
  const { code } = req.body;
  const stored = codes.get(MY_EMAIL);
  
  if (!stored) {
    return res.status(400).json({ error: 'No code found. Request new code.' });
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
  const session = { email: MY_EMAIL, token: token, createdAt: new Date().toISOString() };
  chats.set(token, []);
  sessions.set(token, session);
  
  res.json({ 
    success: true, 
    message: 'Welcome to Open Claw Enterprise! Your AI agents are ready.',
    session: session
  });
});

// ==========================================
// AI CHAT API - REAL GROQ INTEGRATION WITH CUSTOM RESPONSES
// ==========================================

app.post('/api/chat', async (req, res) => {
  const { message, sessionToken, context } = req.body;
  
  if (!message) return res.status(400).json({ error: 'No message provided' });
  
  // Determine which agent to use based on message content
  const msg = message.toLowerCase();
  let agentType = 'orchestrator';
  let agentEmoji = '🎯';
  let agentName = 'Orchestrator';
  let agentColor = '#ffd700';
  
  // Enhanced routing logic with priority matching
  if (msg.includes('market') || msg.includes('competitor') || msg.includes('research') || msg.includes('trend') || msg.includes('pricing') || msg.includes('industry')) {
    agentType = 'market_research';
    agentEmoji = '🔍';
    agentName = 'Market Research';
    agentColor = '#00d4ff';
  }
  else if (msg.includes('design') || msg.includes('ui') || msg.includes('ux') || msg.includes('wireframe') || msg.includes('landing') || msg.includes('page') || msg.includes('mockup') || msg.includes('prototype')) {
    agentType = 'product_design';
    agentEmoji = '🎨';
    agentName = 'Product Design';
    agentColor = '#ff6b6b';
  }
  else if (msg.includes('database') || msg.includes('api') || msg.includes('backend') || msg.includes('server') || msg.includes('schema') || msg.includes('postgresql') || msg.includes('mongodb')) {
    agentType = 'backend_engineer';
    agentEmoji = '⚙️';
    agentName = 'Backend Engineer';
    agentColor = '#4ecdc4';
  }
  else if (msg.includes('react') || msg.includes('component') || msg.includes('frontend') || msg.includes('css') || msg.includes('html') || msg.includes('javascript') || msg.includes('typescript') || msg.includes('next.js')) {
    agentType = 'frontend_engineer';
    agentEmoji = '🎭';
    agentName = 'Frontend Engineer';
    agentColor = '#95e1d3';
  }
  else if (msg.includes('email') || msg.includes('notification') || msg.includes('message') || msg.includes('sequence') || msg.includes('newsletter') || msg.includes('campaign')) {
    agentType = 'communications';
    agentEmoji = '📧';
    agentName = 'Communications';
    agentColor = '#f7dc6f';
  }
  else if (msg.includes('sales') || msg.includes('marketing') || msg.includes('lead') || msg.includes('growth') || msg.includes('outreach') || msg.includes('funnel') || msg.includes('conversion')) {
    agentType = 'sales_marketing';
    agentEmoji = '💰';
    agentName = 'Sales & Marketing';
    agentColor = '#bb8fce';
  }
  else if (msg.includes('deploy') || msg.includes('docker') || msg.includes('ci/cd') || msg.includes('security') || msg.includes('cloud') || msg.includes('kubernetes') || msg.includes('aws') || msg.includes('infrastructure')) {
    agentType = 'devops_security';
    agentEmoji = '🔒';
    agentName = 'DevOps & Security';
    agentColor = '#85c1e9';
  }
  else if (msg.includes('sql') || msg.includes('data') || msg.includes('analytics') || msg.includes('dashboard') || msg.includes('query') || msg.includes('metric') || msg.includes('kpi')) {
    agentType = 'data_analyst';
    agentEmoji = '📊';
    agentName = 'Data Analyst';
    agentColor = '#f8b500';
  }
  else if (msg.includes('test') || msg.includes('documentation') || msg.includes('docs') || msg.includes('tutorial') || msg.includes('readme') || msg.includes('api doc')) {
    agentType = 'qa_documentation';
    agentEmoji = '🧪';
    agentName = 'QA & Documentation';
    agentColor = '#82e0aa';
  }

  try {
    console.log(`🤖 ${agentEmoji} ${agentName} Agent activated`);
    console.log(`📝 Processing: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);
    
    // Build conversation history if session exists
    let conversationContext = '';
    if (sessionToken && chats.has(sessionToken)) {
      const history = chats.get(sessionToken);
      if (history.length > 0) {
        // Include last 3 exchanges for context
        const recentHistory = history.slice(-6);
        conversationContext = recentHistory.map(h => 
          `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content.substring(0, 200)}`
        ).join('\n');
      }
    }

    // Construct the prompt with context
    const fullPrompt = context 
      ? `PROJECT CONTEXT: ${context}\n\nTASK: ${message}`
      : conversationContext 
        ? `CONVERSATION HISTORY:\n${conversationContext}\n\nCURRENT TASK: ${message}`
        : `TASK: ${message}`;

    // Call REAL Groq AI with custom system prompt - UPDATED MODEL
    const response = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: AGENT_PROMPTS[agentType] 
        },
        { 
          role: "user", 
          content: `${fullPrompt}\n\nProvide a comprehensive, detailed response with specific examples, actual code/copy where relevant, and actionable next steps. Be thorough and professional. Do not use placeholders - provide real, specific content.` 
        }
      ],
      model: "llama-3.3-70b-versatile",  // UPDATED MODEL HERE!
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1
    });

    const aiResponse = response.choices[0].message.content;
    
    // Store in chat history if session exists
    if (sessionToken && chats.has(sessionToken)) {
      const history = chats.get(sessionToken);
      history.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
      history.push({ role: 'assistant', content: aiResponse, agent: agentType, timestamp: new Date().toISOString() });
      // Keep last 50 messages
      if (history.length > 50) {
        chats.set(sessionToken, history.slice(-50));
      }
    }

    // Format the response with agent branding
    const formattedResponse = `${agentEmoji} **${agentName} Agent** [${new Date().toLocaleTimeString()}]
<div style="border-left: 4px solid ${agentColor}; padding-left: 16px; margin: 16px 0;">

${aiResponse}

</div>

---
*Agent: ${agentType} | Model: llama-3.3-70b-versatile | Tokens: ${response.usage?.total_tokens || 'N/A'}*`;

    res.json({
      success: true,
      tool: agentType,
      agent: agentName,
      emoji: agentEmoji,
      color: agentColor,
      result: formattedResponse,
      rawResponse: aiResponse,
      timestamp: new Date().toISOString(),
      usage: response.usage,
      model: "llama-3.3-70b-versatile"
    });

  } catch (error) {
    console.error('🚨 AI Error:', error);
    
    // Graceful fallback with specific error information
    let errorMessage = 'AI service temporarily unavailable';
    let statusCode = 500;
    
    if (error.status === 429) {
      errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      statusCode = 429;
    } else if (error.status === 401) {
      errorMessage = 'API authentication failed. Check your GROQ_API_KEY.';
      statusCode = 401;
    } else if (error.message.includes('network')) {
      errorMessage = 'Network error. Please check your connection.';
      statusCode = 503;
    } else if (error.message.includes('decommissioned') || error.message.includes('model')) {
      errorMessage = 'AI model update required. Contact administrator.';
      statusCode = 500;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      tool: 'error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==========================================
// AGENT CHAINING API - Multi-Agent Workflows
// ==========================================

app.post('/api/chain', async (req, res) => {
  const { workflow, sessionToken } = req.body;
  
  if (!workflow || !Array.isArray(workflow)) {
    return res.status(400).json({ error: 'Workflow must be an array of agent tasks' });
  }
  
  const results = [];
  let context = '';
  
  console.log(`🔄 Starting chained workflow with ${workflow.length} agents`);
  
  for (let i = 0; i < workflow.length; i++) {
    const step = workflow[i];
    console.log(`➡️ Step ${i + 1}/${workflow.length}: ${step.agent || 'auto-detect'} - ${step.task.substring(0, 50)}...`);
    
    try {
      // Determine agent for this step
      const msg = step.task.toLowerCase();
      let agentType = step.agent || 'orchestrator';
      
      // Auto-detect if not specified
      if (!step.agent) {
        if (msg.includes('design')) agentType = 'product_design';
        else if (msg.includes('market')) agentType = 'market_research';
        else if (msg.includes('backend') || msg.includes('database')) agentType = 'backend_engineer';
        else if (msg.includes('frontend') || msg.includes('react')) agentType = 'frontend_engineer';
        // ... add more auto-detection as needed
      }
      
      const prompt = context 
        ? `PREVIOUS OUTPUTS:\n${context}\n\nCURRENT TASK: ${step.task}`
        : step.task;
      
      const response = await groq.chat.completions.create({
        messages: [
          { role: "system", content: AGENT_PROMPTS[agentType] },
          { role: "user", content: prompt }
        ],
        model: "llama-3.3-70b-versatile",  // UPDATED HERE TOO!
        temperature: 0.7,
        max_tokens: 4096
      });
      
      const result = response.choices[0].message.content;
      results.push({
        step: i + 1,
        agent: agentType,
        task: step.task,
        result: result,
        timestamp: new Date().toISOString()
      });
      
      // Build context for next step
      context += `\n\n--- STEP ${i + 1} (${agentType}) ---\n${result.substring(0, 1000)}`; // Truncate for token limits
      
    } catch (error) {
      results.push({
        step: i + 1,
        agent: step.agent || 'unknown',
        task: step.task,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      break;
    }
  }
  
  res.json({
    success: true,
    workflow: results,
    totalSteps: results.length,
    completedAt: new Date().toISOString()
  });
});

// ==========================================
// SESSION MANAGEMENT API
// ==========================================

app.get('/api/session/:token', (req, res) => {
  const { token } = req.params;
  const session = sessions.get(token);
  const history = chats.get(token);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    session: session,
    history: history || [],
    messageCount: history ? history.length : 0
  });
});

app.delete('/api/session/:token', (req, res) => {
  const { token } = req.params;
  sessions.delete(token);
  chats.delete(token);
  res.json({ success: true, message: 'Session cleared' });
});

// ==========================================
// HEALTH & STATUS API
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0-groq',
    agents: Object.keys(AGENT_PROMPTS),
    groqConnected: !!process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile'  // SHOWS NEW MODEL
  });
});

app.get('/api/agents', (req, res) => {
  const agentList = Object.keys(AGENT_PROMPTS).map(key => ({
    id: key,
    name: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    emoji: {
      orchestrator: '🎯',
      market_research: '🔍',
      product_design: '🎨',
      backend_engineer: '⚙️',
      frontend_engineer: '🎭',
      communications: '📧',
      sales_marketing: '💰',
      devops_security: '🔒',
      data_analyst: '📊',
      qa_documentation: '🧪'
    }[key],
    description: AGENT_PROMPTS[key].split('\n')[0].replace('You are ', '')
  }));
  
  res.json({ agents: agentList });
});

// ==========================================
// SERVER INITIALIZATION
// ==========================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║           🦅 OPEN CLAW ENTERPRISE v2.0 🦅                ║
║              REAL AI AGENTS ACTIVATED                    ║
╠══════════════════════════════════════════════════════════╣
║  Status:     ✅ Running on port ${PORT}                    ║
║  AI Engine:  🧠 Groq (llama-3.3-70b-versatile)           ║
║  Agents:     10 Specialist Agents Ready                  ║
║  Email:      ${process.env.RESEND_API_KEY ? '✅ Connected' : '⚠️  Fallback Mode'}              ║
╚══════════════════════════════════════════════════════════╝

Available Endpoints:
  POST /api/send-code     - Request verification code
  POST /api/verify-code   - Verify code & create session
  POST /api/chat          - Chat with AI agents (MAIN)
  POST /api/chain         - Multi-agent workflows
  GET  /api/health        - System status
  GET  /api/agents        - List available agents

🚀 Ready for custom AI-generated designs and code!
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 Shutting down gracefully...');
  process.exit(0);
});
