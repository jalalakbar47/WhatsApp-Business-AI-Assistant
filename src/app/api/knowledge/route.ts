import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/knowledge - Retrieve all knowledge base items
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("API GET Knowledge error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/knowledge - Add a new knowledge base item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, tags } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and Content are required fields." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("knowledge_base")
      .insert({ title, content, tags: tags || [] })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("API POST Knowledge error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/knowledge - Update an existing knowledge base item
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, content, tags } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing knowledge record ID." }, { status: 400 });
    }

    const updateFields: any = {};
    if (title !== undefined) updateFields.title = title;
    if (content !== undefined) updateFields.content = content;
    if (tags !== undefined) updateFields.tags = tags;

    const { data, error } = await supabase
      .from("knowledge_base")
      .update(updateFields)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("API PATCH Knowledge error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/knowledge - Delete a knowledge base item by ID
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing knowledge record ID." }, { status: 400 });
    }

    const { error } = await supabase.from("knowledge_base").delete().eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API DELETE Knowledge error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
