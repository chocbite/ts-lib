//Client for OpenAI compatible chat servers, like LiteLLM, llama-swap and llama.cpp's llama-server.
//Replies are streamed, can be cancelled, and can be forced into a JSON schema.
import { err, ok, type Result } from "@chocbite/ts-lib/result";
import type { Schema } from "#lib/schema";

export interface LlmServer {
  /**Base url including the version, like http://host:4000/v1*/
  url: string;
  /**Bearer key, empty for servers without one*/
  key: string;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**How much the model may think before answering, for models that think*/
export const LlmThinking = {
  Off: "off",
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;
export type LlmThinking = (typeof LlmThinking)[keyof typeof LlmThinking];

export interface LlmRequest {
  model: string;
  messages: LlmMessage[];
  /**Forces the reply into the schema, the reply text is then JSON*/
  schema?: { name: string; schema: Schema };
  /**Leaving it out uses the server's default*/
  thinking?: LlmThinking;
  temperature?: number;
  max_tokens?: number;
  signal?: AbortSignal;
  /**Called while the reply streams in, with all text and thinking so far*/
  on_text?: (text: string, reasoning: string) => void;
}

export interface LlmReply {
  text: string;
  /**What the model thought before answering, empty when the server does not give it*/
  reasoning: string;
  prompt_tokens?: number;
  reply_tokens?: number;
}

const base = (server: LlmServer) => server.url.trim().replace(/\/+$/, "");
//Trimmed, a key pasted with a space or line break does not match
const headers = (server: LlmServer) => ({
  "Content-Type": "application/json",
  ...(server.key.trim() ? { Authorization: `Bearer ${server.key.trim()}` } : {}),
});

/**Explains an error answer from the server, with hints for known confusing ones*/
async function answer_error(res: Response): Promise<string> {
  const text = (await res.text()).slice(0, 1000);
  //LiteLLM looks up keys that are not its master key as virtual keys in its database
  const hint = text.includes("no_db_connection")
    ? " LiteLLM did not accept the key as its master key, and has no database to look it up as a virtual key. Check the key."
    : "";
  return `The server answered ${res.status}: ${text}${hint}`;
}

/**Explains a failed fetch, browsers give no details on network and CORS errors*/
const fetch_error = (server: LlmServer, e: unknown) =>
  e instanceof DOMException && e.name === "AbortError"
    ? "cancelled"
    : `Could not reach ${base(server)} (${String(e)}). Check the address, that the server is running, and that it allows requests from this page (CORS).`;

const NO_SERVER = "No AI server address is set";

/**Lists the models the server offers*/
export async function llm_models(server: LlmServer): Promise<Result<string[], string>> {
  if (!base(server)) return err(NO_SERVER);
  try {
    const res = await fetch(base(server) + "/models", { headers: headers(server) });
    if (!res.ok) return err(await answer_error(res));
    const body = (await res.json()) as { data?: { id: string }[] };
    return ok((body.data ?? []).map((m) => m.id).sort());
  } catch (e) {
    return err(fetch_error(server, e));
  }
}

/**Sends a chat and streams the reply*/
export async function llm_chat(
  server: LlmServer,
  request: LlmRequest,
): Promise<Result<LlmReply, string>> {
  if (!base(server)) return err(NO_SERVER);
  const body: { [key: string]: unknown } = {
    model: request.model,
    messages: request.messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.max_tokens !== undefined) body.max_tokens = request.max_tokens;
  if (request.schema)
    body.response_format = {
      type: "json_schema",
      json_schema: { name: request.schema.name, schema: request.schema.schema, strict: true },
    };
  if (request.thinking) {
    //reasoning_effort is the OpenAI parameter, chat_template_kwargs reaches the chat template of llama.cpp models,
    //which is where Qwen models read enable_thinking and reasoning_effort
    const thinking = request.thinking !== LlmThinking.Off;
    if (thinking) body.reasoning_effort = request.thinking;
    body.chat_template_kwargs = {
      enable_thinking: thinking,
      ...(thinking ? { reasoning_effort: request.thinking } : {}),
    };
  }

  let res: Response;
  try {
    res = await fetch(base(server) + "/chat/completions", {
      method: "POST",
      headers: headers(server),
      body: JSON.stringify(body),
      signal: request.signal,
    });
  } catch (e) {
    return err(fetch_error(server, e));
  }
  if (!res.ok || !res.body) return err(await answer_error(res));

  const reply: LlmReply = { text: "", reasoning: "" };
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      let changed = false;
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        let chunk: StreamChunk;
        try {
          chunk = JSON.parse(data) as StreamChunk;
        } catch {
          continue;
        }
        if (chunk.error) return err(`The server failed: ${chunk.error.message ?? JSON.stringify(chunk.error)}`);
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          reply.text += delta.content;
          changed = true;
        }
        const thought = delta?.reasoning_content ?? delta?.reasoning;
        if (thought) {
          reply.reasoning += thought;
          changed = true;
        }
        if (chunk.usage) {
          reply.prompt_tokens = chunk.usage.prompt_tokens;
          reply.reply_tokens = chunk.usage.completion_tokens;
        }
      }
      if (changed) request.on_text?.(reply.text, reply.reasoning);
    }
  } catch (e) {
    return err(fetch_error(server, e));
  }
  return ok(reply);
}

interface StreamChunk {
  choices?: { delta?: { content?: string; reasoning_content?: string; reasoning?: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
  error?: { message?: string };
}

/**Reads JSON from a reply, also when the model wrapped it in a code fence or wrote text around it*/
export function llm_json(text: string): Result<unknown, string> {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start < 0 || end < start) return err("The reply has no JSON in it");
  try {
    return ok(JSON.parse(text.slice(start, end + 1)));
  } catch (e) {
    return err(`The reply is not valid JSON: ${String(e)}`);
  }
}
