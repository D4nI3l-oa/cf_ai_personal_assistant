# AI Personal Assistant

A chat-based AI personal assistant built on **Cloudflare Workers**, with persistent conversation memory and a modern dark UI. Powered by **Workers AI** (Llama 3.3 70B) and **Durable Objects** for per-user history.

---

## Features

- **Real-time chat** — Send messages and get AI responses with a single-page chat interface
- **Persistent memory** — Conversation history is stored per user via Durable Objects (SQLite-backed)
- **Workers AI** — Uses Llama 3.3 70B (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) on Cloudflare’s edge
- **Modern UI** — Dark theme, Outfit + JetBrains Mono typography, typing indicator, and message animations
- **Serverless** — No backend to run; everything runs on Cloudflare’s edge network
- **Free-tier friendly** — Configured for Workers Free plan with SQLite-backed Durable Objects

---

## Tech Stack

| Layer        | Technology                          |
| ------------ | ------------------------------------ |
| **Runtime**  | Cloudflare Workers                   |
| **LLM**      | Workers AI — Llama 3.3 70B           |
| **Memory**   | Durable Objects (SQLite backend)     |
| **Frontend** | Vanilla HTML, CSS, JavaScript        |
| **Config**   | Wrangler (`wrangler.toml` / `wrangler.jsonc`) |

---

## Prerequisites

- **Node.js** 18+
- **npm** (or pnpm / yarn)
- **Cloudflare account** — [Sign up](https://dash.cloudflare.com/sign-up) for Workers and Workers AI

---

## Getting Started

### 1. Clone and install

```bash
git clone <your-repo-url>
cd cf-ai-personal-assistant
npm install
```

### 2. Run locally

```bash
npm run dev
```

Then open **http://localhost:8787** in your browser.

> **Tip:** If `env.MEMORY` is undefined locally, run with an explicit config:  
> `npx wrangler dev --config wrangler.toml`

### 3. Deploy to Cloudflare

```bash
npx wrangler login
npm run deploy
```

After deploy, Wrangler prints your live URL (e.g. `https://cf-ai-personal-assistant.<subdomain>.workers.dev`).

---

## Configuration

The worker uses **Wrangler** for config. Key sections:

### AI binding

Workers AI is bound as `env.AI`:

```toml
[ai]
binding = "AI"
```

### Durable Objects (conversation memory)

The `ConversationMemory` Durable Object is bound as `env.MEMORY` and uses the **SQLite** backend (required for the Workers Free plan):

```toml
[[durable_objects.bindings]]
name = "MEMORY"
class_name = "ConversationMemory"
script_name = "cf-ai-personal-assistant"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ConversationMemory"]
```

- **Free plan:** Use `new_sqlite_classes` in migrations (not `new_classes`).
- **Paid plan:** You can use either `new_sqlite_classes` or `new_classes`.

Both `wrangler.toml` and `wrangler.jsonc` are kept in sync so either can be used.

---

## API Reference

| Method | Path           | Description |
| ------ | ----------------- |
| `GET`  | `/`              | Serves the chat UI (HTML). |
| `POST` | `/api/chat`      | Send a message and get an AI reply. |
| `GET`  | `/api/history`   | Get conversation history for the current user. |
| `POST` | `/api/clear`     | Clear conversation history for the current user. |

### `POST /api/chat`

**Request body (JSON):**

```json
{
  "message": "Your message here",
  "userId": "optional-user-id"
}
```

- `message` (required): User message text.
- `userId` (optional): Defaults to `"default-user"` for per-user memory.

**Response (JSON):**

```json
{
  "response": "Assistant reply text"
}
```

On error (e.g. missing `message` or server error), returns an object with an `error` string and an appropriate HTTP status (e.g. 400, 500).

### `GET /api/history`

Optional query: `?userId=default-user`

**Response (JSON):** Array of `{ "role": "user" | "assistant", "content": "..." }`.

### `POST /api/clear`

**Request body (JSON):**

```json
{
  "userId": "optional-user-id"
}
```

**Response (JSON):** `{ "success": true }`.

---

## Project Structure

```
cf-ai-personal-assistant/
├── src/
│   ├── index.ts              # Worker entry: routes, API, embedded UI
│   └── durable-objects/
│       └── ConversationMemory.ts   # Durable Object for per-user message history
├── test/
│   ├── index.spec.ts         # Vitest + cloudflare:test
│   └── env.d.ts              # Test env types
├── wrangler.toml             # Wrangler config (AI + Durable Objects)
├── wrangler.jsonc            # Alternate Wrangler config (same bindings)
├── worker-configuration.d.ts # Env/bindings types (if present)
├── package.json
├── tsconfig.json
└── vitest.config.mts
```

---

## Scripts

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Start local dev server         |
| `npm run deploy`  | Deploy worker to Cloudflare    |
| `npm test`        | Run Vitest tests               |
| `npm run cf-typegen` | Generate Wrangler types    |

---

## Troubleshooting

| Issue | What to do |
| ----- | ----------- |
| `env.MEMORY` is undefined locally | Use `wrangler dev --config wrangler.toml` and ensure `durable_objects` and `migrations` are in that file. |
| Deploy error: "must create a namespace using `new_sqlite_classes`" | On the Free plan, use `new_sqlite_classes` in `[[migrations]]`, not `new_classes`. |
| "message is always undefined" | Ensure the client sends JSON `{ "message": "..." }` and the server validates it (current code returns 400 if missing). |
| AI or MEMORY binding missing in tests | Vitest uses `wrangler.jsonc`; ensure it has the same `ai` and `durable_objects` (and `migrations`) as `wrangler.toml`. |

---

## License

MIT (or your chosen license).
