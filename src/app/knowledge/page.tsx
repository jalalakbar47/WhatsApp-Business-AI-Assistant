"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { getBrowserSupabase } from "@/lib/supabase-browser";

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
}

interface TestResult {
  id: string;
  title: string;
  content: string;
  tags: string[];
  similarity: number;
}

export default function KnowledgeBaseDashboard() {
  const supabase = getBrowserSupabase();

  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [testQueryText, setTestQueryText] = useState("");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testingMatch, setTestingMatch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        (item.tags && item.tags.some((tag) => tag.toLowerCase().includes(q)))
    );
  }, [items, searchTerm]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge");
      if (!res.ok) throw new Error("Failed to fetch knowledge list.");
      setItems(await res.json());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setTitle(""); setContent(""); setTagsInput(""); setEditingId(null); setFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setActionLoading(true);
    const tags = tagsInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    try {
      const res = await fetch("/api/knowledge", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, title, content, tags } : { title, content, tags }),
      });
      if (!res.ok) throw new Error("Failed to save knowledge base item.");
      resetForm();
      fetchItems();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving item");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClick = (item: KnowledgeItem) => {
    setEditingId(item.id); setTitle(item.title); setContent(item.content);
    setTagsInput(item.tags.join(", ")); setFormOpen(true);
  };

  const handleDeleteConfirm = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete item.");
      setDeleteConfirmId(null);
      fetchItems();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting item");
    }
  };

  const runMatchTest = async () => {
    if (!testQueryText.trim() || !supabase) return;
    setTestingMatch(true);
    try {
      const cleanStr = testQueryText.replace(/[^\w\s]/gi, " ").trim();
      const { data, error: rpcError } = await supabase.rpc("search_knowledge", { search_query: cleanStr });
      if (rpcError) throw rpcError;
      setTestResults(data || []);
    } catch {
      alert("Search failed. Ensure query string is valid.");
    } finally {
      setTestingMatch(false);
    }
  };

  // ─── Shared input styles ───────────────────────────────────────────────────
  const inputCls = "w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none transition-all";
  const inputStyle = {
    background: "#2a3942",
    color: "#e9edef",
    border: "1px solid #374045",
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#111b21" }}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header
        className="px-5 py-3 flex items-center justify-between flex-shrink-0"
        style={{ background: "#202c33", borderBottom: "1px solid #2a3942" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            title="Back to Conversations"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>

          <div className="flex items-center gap-2.5">
            <Image src="/whatsapp-logo.svg" alt="WhatsApp" width={32} height={32} className="rounded-full" />
            <div>
              <h1 className="text-[15px] font-semibold leading-tight" style={{ color: "#e9edef" }}>
                Knowledge Base
              </h1>
              <p className="text-[11px]" style={{ color: "#8696a0" }}>
                {loading ? "Loading…" : `${items.length} document${items.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => { setEditingId(null); setTitle(""); setContent(""); setTagsInput(""); setFormOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold transition-all"
          style={{ background: "#00a884", color: "#ffffff" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Document
        </button>
      </header>

      {/* ── Main workspace ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Document list */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#111b21" }}>

          {/* Search */}
          <div className="px-5 py-3 flex-shrink-0" style={{ background: "#111b21", borderBottom: "1px solid #2a3942" }}>
            <div
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
              style={{ background: "#202c33", border: "1px solid #374045" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search documents by title, content, or tags…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent text-[13px] focus:outline-none"
                style={{ color: "#e9edef" }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="flex-shrink-0" style={{ color: "#8696a0" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: "thin", scrollbarColor: "#374045 transparent" }}>
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#00a884", borderTopColor: "transparent" }} />
                <p className="text-[13px]" style={{ color: "#8696a0" }}>Loading knowledge index…</p>
              </div>
            ) : error ? (
              <div className="mx-auto max-w-md mt-8 px-5 py-4 rounded-xl text-[13px]" style={{ background: "#2d1a1a", color: "#f87171", border: "1px solid #4a2020" }}>
                <strong>Error:</strong> {error}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#202c33" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[15px] font-medium mb-1" style={{ color: "#e9edef" }}>No knowledge documents</p>
                  <p className="text-[13px]" style={{ color: "#8696a0" }}>Add documents to help your AI reply accurately.</p>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                <p className="text-[15px] font-medium" style={{ color: "#e9edef" }}>No results for "{searchTerm}"</p>
                <p className="text-[13px]" style={{ color: "#8696a0" }}>Try a different search term.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="relative flex flex-col rounded-xl overflow-hidden group transition-all"
                    style={{ background: "#202c33", border: "1px solid #2a3942" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#374045")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a3942")}
                  >
                    {/* Delete overlay */}
                    {deleteConfirmId === item.id && (
                      <div
                        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-5 text-center rounded-xl"
                        style={{ background: "#202c33" }}
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#2d1a1a" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </div>
                        <p className="text-[13px] font-semibold" style={{ color: "#e9edef" }}>Delete this document?</p>
                        <p className="text-[12px]" style={{ color: "#8696a0" }}>This will permanently remove it from the AI's knowledge.</p>
                        <div className="flex gap-2 w-full">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="flex-1 py-2 rounded-lg text-[12px] font-semibold transition-colors"
                            style={{ background: "#2a3942", color: "#e9edef", border: "1px solid #374045" }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteConfirm(item.id)}
                            className="flex-1 py-2 rounded-lg text-[12px] font-semibold transition-colors"
                            style={{ background: "#f87171", color: "#ffffff" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Card content */}
                    <div className="p-4 flex-1">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-[14px] font-semibold leading-snug" style={{ color: "#e9edef" }}>
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => handleEditClick(item)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: "#8696a0" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2a3942"; (e.currentTarget as HTMLButtonElement).style.color = "#00a884"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#8696a0"; }}
                            title="Edit"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: "#8696a0" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2d1a1a"; (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#8696a0"; }}
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <p className="text-[13px] leading-relaxed line-clamp-4" style={{ color: "#8696a0" }}>
                        {item.content}
                      </p>
                    </div>

                    {/* Tags footer */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="px-4 pb-3 pt-2 flex flex-wrap gap-1.5" style={{ borderTop: "1px solid #2a3942" }}>
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "#1a2c25", color: "#00a884", border: "1px solid #003d2e" }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Sandbox tester */}
        <div
          className="w-[360px] flex flex-col flex-shrink-0 overflow-hidden"
          style={{ background: "#0b141a", borderLeft: "1px solid #2a3942" }}
        >
          <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #2a3942" }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#1a2c25" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00a884" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h2 className="text-[14px] font-semibold" style={{ color: "#e9edef" }}>
                Knowledge Sandbox
              </h2>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: "#8696a0" }}>
              Test how user questions map to your documents.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#374045 transparent" }}>
            {/* Input */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "#202c33", border: "1px solid #374045" }}
            >
              <input
                type="text"
                value={testQueryText}
                onChange={(e) => setTestQueryText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runMatchTest()}
                placeholder="e.g. teeth cost, consultation fee…"
                className="flex-1 bg-transparent text-[13px] focus:outline-none"
                style={{ color: "#e9edef" }}
              />
            </div>
            <button
              onClick={runMatchTest}
              disabled={testingMatch || !testQueryText.trim()}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
              style={{ background: "#00a884", color: "#ffffff" }}
            >
              {testingMatch ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "white", borderTopColor: "transparent" }} />
                  Searching…
                </span>
              ) : "Run Match Test"}
            </button>

            {/* Results */}
            {testResults.length === 0 ? (
              <div
                className="rounded-xl p-6 text-center"
                style={{ background: "#202c33", border: "1px dashed #374045" }}
              >
                <p className="text-[13px]" style={{ color: "#8696a0" }}>
                  {testQueryText.trim() ? "No matches found. Try a different query." : "Results will appear here."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8696a0" }}>
                  {testResults.length} match{testResults.length !== 1 ? "es" : ""} found
                </p>
                {testResults.map((res, i) => (
                  <div
                    key={res.id}
                    className="rounded-xl p-4 space-y-2"
                    style={{ background: "#202c33", border: "1px solid #2a3942" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold truncate" style={{ color: "#e9edef" }}>
                        #{i + 1} {res.title}
                      </span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-bold font-mono flex-shrink-0"
                        style={{ background: "#1a2c25", color: "#00a884" }}
                      >
                        {res.similarity ? res.similarity.toFixed(3) : "0.000"}
                      </span>
                    </div>
                    <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: "#8696a0" }}>
                      {res.content}
                    </p>
                    {res.tags && res.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {res.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: "#2a3942", color: "#8696a0" }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add/Edit Modal ─────────────────────────────────────────────────── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#202c33", border: "1px solid #374045" }}>
            {/* Modal header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #2a3942" }}>
              <h2 className="text-[15px] font-semibold" style={{ color: "#e9edef" }}>
                {editingId ? "Edit Document" : "Add Document"}
              </h2>
              <button
                onClick={resetForm}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ color: "#8696a0" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium" style={{ color: "#8696a0" }}>Document Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Clinic Location & Hours"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium" style={{ color: "#8696a0" }}>Content / Facts *</label>
                <textarea
                  required
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter the exact facts the AI should know…"
                  className={`${inputCls} resize-none`}
                  style={inputStyle}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium" style={{ color: "#8696a0" }}>Tags <span style={{ color: "#374045" }}>(comma-separated)</span></label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. location, hours, parking"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div className="flex gap-3 pt-2" style={{ borderTop: "1px solid #2a3942", paddingTop: "1rem" }}>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
                  style={{ background: "#2a3942", color: "#e9edef", border: "1px solid #374045" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
                  style={{ background: "#00a884", color: "#ffffff" }}
                >
                  {actionLoading ? "Saving…" : editingId ? "Update Document" : "Save Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
