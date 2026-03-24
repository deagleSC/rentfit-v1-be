import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../config/env";

/** Ollama Cloud exposes an OpenAI-compatible API at `OLLAMA_BASE_URL` (default `https://ollama.com/v1`). */
export function createChatModel() {
  const provider = createOpenAI({
    baseURL: env.ollama.baseURL,
    apiKey: env.ollama.apiKey || "ollama",
    name: "ollama",
  });
  return provider(env.ollama.model);
}
