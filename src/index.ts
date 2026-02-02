import { ConversationMemory } from './durable-objects/ConversationMemory';

export { ConversationMemory };

interface AiBinding {
	run(
		model: string,
		options: { messages: Array<{ role: string; content: string }> },
	): Promise<{ response: string }>;
}

interface Env {
	AI: AiBinding;
	MEMORY: DurableObjectNamespace;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.MEMORY) {
      return new Response(
        JSON.stringify({
          error:
            'MEMORY binding is missing. Add durable_objects to wrangler.toml or wrangler.jsonc and restart wrangler dev.',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve the chat UI
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(HTML_CONTENT, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Chat endpoint
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { message?: string; userId?: string };
        const message = body?.message?.trim();
        const userId = body?.userId ?? 'default-user';

        if (!message) {
          return new Response(
            JSON.stringify({ error: 'Missing or empty "message" in request body' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        if (!env.MEMORY) return missingBindingResponse(corsHeaders);

        // Get Durable Object instance for this user
        const id = env.MEMORY.idFromName(userId);
        const stub = env.MEMORY.get(id);

        // Add user message to history
        await stub.fetch('https://fake-host/add', {
          method: 'POST',
          body: JSON.stringify({ role: 'user', content: message }),
        });

        // Get conversation history
        const historyResponse = await stub.fetch('https://fake-host/history');
        const messages = await historyResponse.json();

        // Call Workers AI with Llama 3.3
        const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            {
              role: 'system',
              content: 'You are a helpful personal assistant. Be concise and friendly.',
            },
            ...messages,
          ],
        });

        const assistantMessage = aiResponse.response;

        // Save assistant response to history
        await stub.fetch('https://fake-host/add', {
          method: 'POST',
          body: JSON.stringify({ role: 'assistant', content: assistantMessage }),
        });

        return new Response(JSON.stringify({ response: assistantMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get conversation history
    if (url.pathname === '/api/history') {
      if (!env.MEMORY) return missingBindingResponse(corsHeaders);
      const userId = url.searchParams.get('userId') || 'default-user';
      const id = env.MEMORY.idFromName(userId);
      const stub = env.MEMORY.get(id);
      const response = await stub.fetch('https://fake-host/history');
      const messages = await response.json();

      return new Response(JSON.stringify(messages), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clear conversation
    if (url.pathname === '/api/clear' && request.method === 'POST') {
      if (!env.MEMORY) return missingBindingResponse(corsHeaders);
      const { userId = 'default-user' } = await request.json();
      const id = env.MEMORY.idFromName(userId);
      const stub = env.MEMORY.get(id);
      await stub.fetch('https://fake-host/clear', { method: 'POST' });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Personal Assistant</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg-deep: #0d1117;
            --bg-surface: #161b22;
            --bg-elevated: #21262d;
            --border: #30363d;
            --text: #e6edf3;
            --text-muted: #8b949e;
            --accent: #58a6ff;
            --accent-soft: rgba(88, 166, 255, 0.15);
            --user-bubble: #238636;
            --user-bubble-soft: rgba(35, 134, 54, 0.2);
            --danger: #f85149;
            --radius: 12px;
            --radius-lg: 20px;
        }
        body {
            font-family: 'Outfit', system-ui, sans-serif;
            background: var(--bg-deep);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 24px;
            color: var(--text);
        }
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(88, 166, 255, 0.12), transparent),
                        radial-gradient(ellipse 60% 40% at 100% 100%, rgba(35, 134, 54, 0.06), transparent);
            pointer-events: none;
            z-index: 0;
        }
        .container {
            position: relative;
            z-index: 1;
            width: 100%;
            max-width: 720px;
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: min(85vh, 640px);
            box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
        }
        .header {
            padding: 24px 28px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .logo {
            width: 44px;
            height: 44px;
            background: var(--accent-soft);
            border: 1px solid var(--accent);
            border-radius: var(--radius);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }
        .header h1 {
            font-size: 1.35rem;
            font-weight: 600;
            letter-spacing: -0.02em;
        }
        .header .tagline {
            font-size: 0.8rem;
            color: var(--text-muted);
            margin-top: 2px;
            font-family: 'JetBrains Mono', monospace;
        }
        .clear-btn {
            font-family: 'Outfit', sans-serif;
            font-size: 0.8rem;
            font-weight: 500;
            color: var(--text-muted);
            background: transparent;
            border: 1px solid var(--border);
            padding: 8px 14px;
            border-radius: 8px;
            cursor: pointer;
            transition: color 0.2s, border-color 0.2s, background 0.2s;
        }
        .clear-btn:hover {
            color: var(--danger);
            border-color: var(--danger);
            background: rgba(248, 81, 73, 0.08);
        }
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .messages::-webkit-scrollbar { width: 8px; }
        .messages::-webkit-scrollbar-track { background: var(--bg-deep); }
        .messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        .message {
            display: flex;
            gap: 12px;
            animation: messageIn 0.35s ease-out;
        }
        @keyframes messageIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .message.user { flex-direction: row-reverse; }
        .message-avatar {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }
        .message.user .message-avatar {
            background: var(--user-bubble-soft);
            border: 1px solid rgba(35, 134, 54, 0.4);
        }
        .message.assistant .message-avatar {
            background: var(--accent-soft);
            border: 1px solid rgba(88, 166, 255, 0.35);
        }
        .message-content {
            max-width: 78%;
            padding: 14px 18px;
            border-radius: var(--radius);
            word-wrap: break-word;
            line-height: 1.55;
            font-size: 0.95rem;
        }
        .message.user .message-content {
            background: var(--user-bubble);
            color: #fff;
            border: 1px solid rgba(35, 134, 54, 0.5);
        }
        .message.assistant .message-content {
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            color: var(--text);
        }
        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 14px 18px;
        }
        .typing-indicator span {
            width: 8px;
            height: 8px;
            background: var(--text-muted);
            border-radius: 50%;
            animation: typing 1.2s ease-in-out infinite;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes typing {
            0%, 60%, 100% { opacity: 0.35; transform: scale(0.9); }
            30% { opacity: 1; transform: scale(1); }
        }
        .input-area {
            padding: 20px 24px;
            border-top: 1px solid var(--border);
            display: flex;
            gap: 12px;
            align-items: center;
        }
        .input-wrap {
            flex: 1;
            display: flex;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-wrap:focus-within {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-soft);
        }
        input {
            flex: 1;
            padding: 14px 18px;
            border: none;
            background: transparent;
            color: var(--text);
            font-family: 'Outfit', sans-serif;
            font-size: 0.95rem;
            outline: none;
        }
        input::placeholder { color: var(--text-muted); }
        .send-btn {
            font-family: 'Outfit', sans-serif;
            padding: 14px 22px;
            background: var(--accent);
            color: #0d1117;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: filter 0.2s, transform 0.15s;
        }
        .send-btn:hover:not(:disabled) {
            filter: brightness(1.1);
            transform: translateY(-1px);
        }
        .send-btn:active:not(:disabled) { transform: translateY(0); }
        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .send-btn svg { width: 18px; height: 18px; }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="header-left">
                <div class="logo" aria-hidden="true">◇</div>
                <div>
                    <h1>Personal Assistant</h1>
                    <p class="tagline">Llama 3.3 · Workers AI</p>
                </div>
            </div>
            <button type="button" class="clear-btn" onclick="clearChat()">Clear chat</button>
        </header>
        <div class="messages" id="messages"></div>
        <div class="input-area">
            <div class="input-wrap">
                <input type="text" id="input" placeholder="Ask anything..." autocomplete="off" onkeypress="handleKeyPress(event)">
            </div>
            <button type="button" class="send-btn" onclick="sendMessage()" id="sendBtn" title="Send">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                Send
            </button>
        </div>
    </div>

    <script>
        const messagesDiv = document.getElementById('messages');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('sendBtn');

        function showTyping() {
            const el = document.createElement('div');
            el.className = 'message assistant';
            el.setAttribute('data-typing', '1');
            el.innerHTML = '<div class="message-avatar">◆</div><div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
            messagesDiv.appendChild(el);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return el;
        }

        function removeTyping() {
            const el = messagesDiv.querySelector('[data-typing="1"]');
            if (el) el.remove();
        }

        async function sendMessage() {
            const message = input.value.trim();
            if (!message) return;

            addMessage('user', message);
            input.value = '';
            sendBtn.disabled = true;
            showTyping();

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });
                const data = await response.json();
                removeTyping();
                if (!response.ok) {
                    addMessage('assistant', data.error || 'Request failed.');
                } else if (data.response != null) {
                    addMessage('assistant', data.response);
                } else {
                    addMessage('assistant', 'No response from server.');
                }
            } catch (err) {
                removeTyping();
                addMessage('assistant', 'Sorry, there was an error. Please try again.');
            }

            sendBtn.disabled = false;
            input.focus();
        }

        function addMessage(role, content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role}\`;
            const avatar = role === 'user' ? 'You' : '◆';
            messageDiv.innerHTML = \`<div class="message-avatar">\${avatar}</div><div class="message-content"></div>\`;
            messageDiv.querySelector('.message-content').textContent = content;
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function handleKeyPress(event) {
            if (event.key === 'Enter') sendMessage();
        }

        async function clearChat() {
            if (!confirm('Clear conversation history?')) return;
            await fetch('/api/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
            messagesDiv.innerHTML = '';
        }

        async function loadHistory() {
            try {
                const response = await fetch('/api/history');
                const messages = await response.json();
                if (Array.isArray(messages)) messages.forEach(msg => addMessage(msg.role, msg.content));
            } catch (_) {}
        }

        loadHistory();
    </script>
</body>
</html>`;