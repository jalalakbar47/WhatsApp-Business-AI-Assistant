import { NextRequest, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getAIResponse } from "@/lib/ai";
import { getRelevantKnowledge } from "@/lib/knowledge";
import { BASE_SYSTEM_PROMPT } from "@/lib/system-prompt";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Only process whatsapp_business_account events
  if (body.object !== "whatsapp_business_account") {
    return Response.json({ status: "ignored" });
  }

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  // Only process actual messages (not status updates)
  if (!value?.messages?.[0]) {
    return Response.json({ status: "no_message" });
  }

  const message = value.messages[0];
  const contact = value.contacts?.[0];

  // Only handle text messages
  if (message.type !== "text") {
    return Response.json({ status: "non_text" });
  }

  const phone = message.from;
  const text = message.text.body;
  const name = contact?.profile?.name || null;
  const whatsappMsgId = message.id;

  try {
    console.time("1. Database Find/Create Conv");
    // Find or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("phone", phone)
      .single();
 
    if (!conversation) {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({ phone, name })
        .select()
        .single();
      conversation = newConvo;
    } else if (name && name !== conversation.name) {
      await supabase
        .from("conversations")
        .update({ name })
        .eq("id", conversation.id);
    }
 
    if (!conversation) {
      console.timeEnd("1. Database Find/Create Conv");
      return Response.json({ error: "Failed to create conversation" }, { status: 500 });
    }
    console.timeEnd("1. Database Find/Create Conv");
 
    console.time("2. Database Insert User Msg");
    // Store user message (ignore duplicates)
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: text,
      whatsapp_msg_id: whatsappMsgId,
    });
 
    if (insertError?.code === "23505") {
      console.timeEnd("2. Database Insert User Msg");
      // Duplicate message, ignore
      return Response.json({ status: "duplicate" });
    }
    console.timeEnd("2. Database Insert User Msg");
 
    console.time("3. Database Update Timestamp");
    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
    console.timeEnd("3. Database Update Timestamp");
    // If mode is 'human', don't auto-reply
    if (conversation.mode === "human") {
      return Response.json({ status: "stored_for_human" });
    }

    // Process AI completion and reply in background to prevent webhook timeout
    after(async () => {
      try {
        console.time("4. Database Select History (Async)");
        const { data: historyData } = await supabase
          .from("messages")
          .select("role, content")
          .eq("conversation_id", conversation!.id)
          .order("created_at", { ascending: false })
          .limit(20);
        const history = (historyData || []).reverse();
        console.timeEnd("4. Database Select History (Async)");

        console.time("4.1. Database Select Knowledge (Async)");
        const knowledge = await getRelevantKnowledge(text);
        console.timeEnd("4.1. Database Select Knowledge (Async)");

        let systemPrompt = BASE_SYSTEM_PROMPT;
        if (knowledge) {
          systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n=== RELEVANT AGENT KNOWLEDGE ===\nUse the following verified information about Jalal Akbar to answer the user's query if relevant:\n${knowledge}\n==================================`;
        }

        console.time("5. Groq Client Call (Async)");
        const aiResponse = await getAIResponse(
          (history || []).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          systemPrompt
        );
        console.timeEnd("5. Groq Client Call (Async)");

        console.time("6. WhatsApp Send API Call (Async)");
        await sendWhatsAppMessage(phone, aiResponse);
        console.timeEnd("6. WhatsApp Send API Call (Async)");

        console.time("7. Database Insert AI Msg (Async)");
        await supabase.from("messages").insert({
          conversation_id: conversation!.id,
          role: "assistant",
          content: aiResponse,
        });
        console.timeEnd("7. Database Insert AI Msg (Async)");

        console.time("8. Database Update Timestamp 2 (Async)");
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversation!.id);
        console.timeEnd("8. Database Update Timestamp 2 (Async)");
      } catch (err) {
        console.error("Background webhook processing error:", err);
      }
    });

    return Response.json({ status: "queued" });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
