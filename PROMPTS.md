# AI Prompts Used in Development

## Prompts to Claude for Building This Project

### Initial Setup Request
"I need to build a Cloudflare AI app with LLM, workflow coordination, user chat input, and memory/state for a job application assignment."

### Architecture Design
"What are the trade-offs between using Durable Objects vs. KV storage for conversation history in a Cloudflare Worker? I'm building a chat app and want to understand the pros/cons of each approach."

**My Decision**: Chose Durable Objects for per-user instances because I wanted each user to have isolated storage. Later switched to a simpler model without persistence to work with free tier constraints.

### Code Implementation
"I'm getting an error that env.AI is undefined even though I added [ai] binding to wrangler.toml. What could cause the binding to not be passed to the Worker? How do I debug what bindings are actually available at runtime?"

**What I Did**: 
- Added logging to print Object.keys(env) to see what was actually available
- Tested with npx wrangler dev --remote to use real Cloudflare infrastructure instead of local simulator
- Figured out the wrangler.toml config format wasn't being recognized and tried multiple formats until it worked

### UI Development
"What are best practices for building a chat interface? Should I use a framework or JavaScript? What CSS approach would give a modern, dark-mode aesthetic?"

**My Design Decisions**:
- Chose vanilla JavaScript (no React) to keep it simple and deployable in a single file
- Implemented a typing indicator animation while waiting for AI responses
- Used CSS variables for theming to make dark mode easy
- Built custom message bubbles with different styles for user vs assistant

## System Prompt Used in the Application

The AI assistant uses this system prompt:
You are a helpful personal assistant. Be concise and friendly.
**Why I chose this**: Keeps responses focused and conversational without being overly verbose. I tested a few variations and found this provided the best balance.

## Key Challenges I Solved

### Challenge 1: AI Binding Not Working
- Researched the difference between local `wrangler dev` and `--remote` flag
- Used console logging to inspect the actual env object received
- Discovered that Durable Objects require paid tier, removed them from free tier version

### Challenge 2: Deploying Configuration
- Learned that wrangler.toml configuration must match exact formatting
- Tried multiple syntax variations: `[ai]`, `[[ai]]`, `ai = {}`
- Figured out that even with correct config, local dev doesn't replicate production bindings

### Challenge 3: UI/UX Polish
- Implemented typing indicator to give user feedback while AI processes
- Added animations for message appearance
- Styled with gradient backgrounds and custom scrollbars

## Future Improvements I'd Implement
- [ ] Switch to SQLite for cheaper persistent storage (currently no memory across sessions)
- [ ] Add streaming responses for better UX with long AI outputs
- [ ] Implement rate limiting to prevent abuse on free tier
- [ ] Add error boundaries to handle API timeouts gracefully
- [ ] Create user authentication to isolate conversations per user
