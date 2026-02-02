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
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            width: 100%;
            max-width: 800px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 600px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 5px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #f7f7f7;
        }
        .message {
            margin-bottom: 15px;
            display: flex;
            gap: 10px;
        }
        .message.user { justify-content: flex-end; }
        .message-content {
            max-width: 70%;
            padding: 12px 16px;
            border-radius: 18px;
            word-wrap: break-word;
        }
        .message.user .message-content {
            background: #667eea;
            color: white;
        }
        .message.assistant .message-content {
            background: white;
            color: #333;
            border: 1px solid #e0e0e0;
        }
        .input-area {
            padding: 20px;
            background: white;
            border-top: 1px solid #e0e0e0;
            display: flex;
            gap: 10px;
        }
        input {
            flex: 1;
            padding: 12px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 25px;
            font-size: 14px;
            outline: none;
        }
        input:focus { border-color: #667eea; }
        button {
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-weight: 600;
            transition: transform 0.2s;
        }
        button:hover { transform: scale(1.05); }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: scale(1);
        }
        .clear-btn {
            background: #ff4757;
            padding: 8px 16px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 AI Personal Assistant</h1>
            <p>Powered by Cloudflare Workers AI & Llama 3.3</p>
        </div>
        <div class="messages" id="messages"></div>
        <div class="input-area">
            <button class="clear-btn" onclick="clearChat()">Clear Chat</button>
            <input type="text" id="input" placeholder="Type your message..." onkeypress="handleKeyPress(event)">
            <button onclick="sendMessage()" id="sendBtn">Send</button>
        </div>
    </div>

    <script>
        const messagesDiv = document.getElementById('messages');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('sendBtn');

        async function sendMessage() {
            const message = input.value.trim();
            if (!message) return;

            addMessage('user', message);
            input.value = '';
            sendBtn.disabled = true;

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });

                const data = await response.json();
                if (!response.ok) {
                    addMessage('assistant', data.error || 'Request failed.');
                } else if (data.response != null) {
                    addMessage('assistant', data.response);
                } else {
                    addMessage('assistant', 'No response from server.');
                }
            } catch (error) {
                addMessage('assistant', 'Sorry, there was an error processing your request.');
            }

            sendBtn.disabled = false;
            input.focus();
        }

        function addMessage(role, content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role}\`;
            messageDiv.innerHTML = \`<div class="message-content">\${content}</div>\`;
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function handleKeyPress(event) {
            if (event.key === 'Enter') sendMessage();
        }

        async function clearChat() {
            if (!confirm('Clear conversation history?')) return;
            
            await fetch('/api/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            messagesDiv.innerHTML = '';
        }

        async function loadHistory() {
            const response = await fetch('/api/history');
            const messages = await response.json();
            messages.forEach(msg => addMessage(msg.role, msg.content));
        }

        loadHistory();
    </script>
</body>
</html>`;