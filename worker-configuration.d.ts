/// <reference types="@cloudflare/workers-types" />

interface AiBinding {
	run(
		model: string,
		options: { messages: Array<{ role: string; content: string }> }
	): Promise<{ response: string }>;
}

interface Env {
	AI: AiBinding;
	MEMORY: DurableObjectNamespace;
}
