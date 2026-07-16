import { GoogleGenAI } from "@google/genai";
import { BASE_SYSTEM_PROMPT } from "@/lib/system-prompt";

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt?: string
) {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined in the environment.");
    return "Authentication Error: Please configure GEMINI_API_KEY in the environment.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const model = process.env.AI_MODEL || "gemini-2.0-flash";

    // Map roles: Google SDK expects 'model' instead of 'assistant'
    const contents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction: systemPrompt || BASE_SYSTEM_PROMPT,
      }
    });

    const content = response.text || "Sorry, I couldn't generate a response.";

    // Clean up any reasoning/thinking tags (e.g. <think>...</think> or <think:id>...</think:id>)
    const cleanedContent = content
      .replace(/<think[^>]*>[\s\S]*?<\/think[^>]*>/gi, "")
      .replace(/<think[^>]*>/gi, "")
      .replace(/<\/think[^>]*>/gi, "")
      .trim();

    return cleanedContent;
  } catch (error: unknown) {
    const model = process.env.AI_MODEL || "gemini-2.0-flash";
    console.error(`[AI] Google SDK Request failed (model: ${model}):`, error);
    if (
      error instanceof Error &&
      (error.message.includes("not found") || error.message.includes("404"))
    ) {
      console.error(
        `[AI] The model "${model}" does not exist. Check AI_MODEL in .env.local. ` +
        `Valid options: gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash`
      );
    }
    // Return graceful fallback message to prevent delivery loops from crashing
    return "Thank you for your message. Jalal's assistant is temporarily offline, but we will review your message and get back to you shortly.";
  }
}

