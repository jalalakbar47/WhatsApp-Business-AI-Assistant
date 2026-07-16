import { supabase } from "./supabase";

export interface KnowledgeItem {
  title: string;
  content: string;
  tags?: string[];
  similarity?: number;
}

/**
 * Searches the Supabase knowledge_base for information matching the user query
 * and formats the output for ingestion by the AI model.
 */
export async function getRelevantKnowledge(query: string): Promise<string> {
  if (!query || query.trim().length < 3) {
    return "";
  }

  try {
    // Sanitise the search query
    const cleanQuery = query
      .replace(/[^\w\s]/gi, " ") // replace special chars with spaces
      .trim();

    if (!cleanQuery) return "";

    console.log(`[Knowledge] Searching database for: "${cleanQuery}"`);

    // Call the postgres function search_knowledge
    const { data, error } = await supabase.rpc("search_knowledge", {
      search_query: cleanQuery,
    });

    if (error) {
      console.error("[Knowledge] Error querying knowledge base:", error);
      return "";
    }

    if (!data || data.length === 0) {
      console.log("[Knowledge] No matching documents found.");
      return "";
    }

    // Limit to top 3 matches and format them nicely for the prompt
    const matches: KnowledgeItem[] = data.slice(0, 3);
    console.log(`[Knowledge] Found ${matches.length} matches:`, matches.map(m => m.title));

    const formattedDocs = matches
      .map(
        (doc) =>
          `[Document: ${doc.title}]\n${doc.content}`
      )
      .join("\n\n");

    return formattedDocs;
  } catch (error) {
    console.error("[Knowledge] System error during search:", error);
    return "";
  }
}
