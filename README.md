# cf_ai_personal_assistant

AI-powered personal assistant built on Cloudflare Workers with persistent memory.

## Features

- 💬 Real-time chat interface
- 🧠 Persistent conversation memory using Durable Objects
- 🤖 Powered by Llama 3.3 70B on Workers AI
- 🚀 Serverless architecture on Cloudflare's edge network

## Tech Stack

- **LLM**: Llama 3.3 70B (Workers AI)
- **Workflow**: Cloudflare Workers
- **Memory**: Durable Objects
- **UI**: Vanilla HTML/JS

## Live Demo

[Your deployed URL will go here after deployment]

## Running Locally

1. Install dependencies:
```bash
   npm install
```

2. Run development server:
```bash
   npm run dev
```

3. Open http://localhost:8787 in your browser

## Deploying

1. Login to Cloudflare:
```bash
   npx wrangler login
```

2. Deploy:
```bash
   npm run deploy
```

## API Endpoints

- `POST /api/chat` - Send a message
- `GET /api/history` - Get conversation history
- `POST /api/clear` - Clear conversation

## Architecture

1. **Frontend**: Simple chat UI served by the Worker
2. **Worker**: Handles API requests and coordinates AI & memory
3. **Durable Objects**: Stores conversation history per user
4. **Workers AI**: Runs Llama 3.3 for natural language processing