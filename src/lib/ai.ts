import { OpenAI } from "openai";
import { BASE_SYSTEM_PROMPT } from "@/lib/system-prompt";

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt?: string
) {
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    console.warn("WARNING: GROQ_API_KEY is not defined in the environment.");
    return "Authentication Error: Please configure GROQ_API_KEY in the environment.";
  }

  try {
    const openai = new OpenAI({
      apiKey: groqApiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

    // Build the format required by Groq API
    const formattedMessages = [
      {
        role: "system" as const,
        content: systemPrompt || BASE_SYSTEM_PROMPT,
      },
      ...messages.map((msg) => ({
        role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: msg.content,
      })),
    ];

    const response = await openai.chat.completions.create({
      model: model,
      messages: formattedMessages,
    });

    const content = response.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";

    // Clean up reasoning if any
    const cleanedContent = content
      .replace(/<think[^>]*>[\s\S]*?<\/think[^>]*>/gi, "")
      .replace(/<think[^>]*>/gi, "")
      .replace(/<\/think[^>]*>/gi, "")
      .trim();

    return cleanedContent;
  } catch (error: unknown) {
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    console.error(`[AI] Groq Request failed (model: ${model}):`, error);
    return "Thank you for your message. Jalal's assistant is temporarily offline, but we will review your message and get back to you shortly.";
  }
}
