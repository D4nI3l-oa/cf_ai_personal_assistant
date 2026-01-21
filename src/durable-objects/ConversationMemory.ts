export class ConversationMemory {
  state: DurableObjectState;
  messages: Array<{ role: string; content: string }>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.messages = [];
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/add" && request.method === "POST") {
      const message = await request.json();
      this.messages.push(message);
      await this.state.storage.put("messages", this.messages);
      return new Response(JSON.stringify({ success: true }));
    }

    if (url.pathname === "/history") {
      const stored = await this.state.storage.get("messages");
      this.messages = stored || [];
      return new Response(JSON.stringify(this.messages));
    }

    if (url.pathname === "/clear" && request.method === "POST") {
      this.messages = [];
      await this.state.storage.put("messages", []);
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response("Not found", { status: 404 });
  }
}