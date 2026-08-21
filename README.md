# HackScout 🎯

HackScout is a lightweight AI Browser Agent that uses **LLM Intent Parsing** + **webcmd** to navigate real public hackathon websites (e.g. Devpost, Devfolio, MLH, Unstop), search for events matching a user query, and extract structured JSON information in real time.

## Phase 2 Features
- **LLM Semantic Parsing**: Understands natural language constraints (e.g., minimum prizes, status, locations).
- **Deterministic Filtering**: Enforces 0 hallucinations by strictly filtering actual live results against the parsed intent.
- **Concurrent Multi-Site Scraping**: Simultaneously extracts from 10+ platforms.

---

## Prerequisites
- Node.js (v20+)
- \`webcmd\` (installed & configured)
- OpenAI API Key (or OpenRouter API Key)

### 1. Configure Environment
1. Open \`.env.local\`
2. Add your \`OPENAI_API_KEY\` (and \`OPENAI_BASE_URL\` if using OpenRouter).

---

## Quick Start

### 1. Start the React Frontend & Backend
\`\`\`bash
npm run build --prefix frontend
node server.js
\`\`\`
Go to \`http://localhost:3000\`

### 2. Run direct query search (CLI)
\`\`\`bash
node src/cli.js "Find beginner-friendly AI hackathons in India with registration open and prize above 1000"
\`\`\`
