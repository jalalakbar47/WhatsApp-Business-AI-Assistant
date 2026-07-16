"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import type { ConversationWithLastMessage, Message } from "@/lib/types";

export default function Dashboard() {
  const supabase = getBrowserSupabase();

  const [conversations, setConversations] = useState<ConversationWithLastMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId);

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    setConversations(data);
  }, []);

  const fetchMessages = useCallback(async (convoId: string) => {
    const res = await fetch(`/api/conversations/${convoId}/messages`);
    const data = await res.json();
    setMessages(data);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => { if (selectedId) fetchMessages(selectedId); }, [selectedId, fetchMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("realtime-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMsg = payload.new as Message;
        if (newMsg.conversation_id === selectedId) {
          setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
        fetchConversations();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, fetchConversations, supabase]);

  async function toggleMode() {
    if (!selected) return;
    const newMode = selected.mode === "agent" ? "human" : "agent";
    await fetch(`/api/conversations/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: newMode }),
    });
    setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, mode: newMode } : c));
  }

  async function handleSend() {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    await fetch(`/api/conversations/${selectedId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input.trim() }),
    });
    setInput("");
    setSending(false);
    fetchMessages(selectedId);
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getInitials(name: string | null, phone: string) {
    if (name) return name.slice(0, 2).toUpperCase();
    return phone.slice(-2);
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#111b21" }}>

      {/* ── Sidebar ─────────────────────────────────── */}
      <div className="w-[360px] flex flex-col flex-shrink-0" style={{ background: "#111b21", borderRight: "1px solid #2a3942" }}>

        {/* Sidebar Header */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#202c33" }}>
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex-shrink-0">
              <Image
                src="/whatsapp-logo.svg"
                alt="WhatsApp"
                width={40}
                height={40}
                className="rounded-full"
                priority
              />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold leading-tight" style={{ color: "#e9edef" }}>
                WhatsApp Agent
              </h1>
              <span className="text-[11px] font-medium" style={{ color: "#25D366" }}>
                {conversations.length > 0
                  ? `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`
                  : "No active chats"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/knowledge"
              title="Knowledge Base"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-3 py-2" style={{ background: "#111b21" }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#202c33" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="text-[13px]" style={{ color: "#8696a0" }}>Search or start new chat</span>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#374045 transparent" }}>
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#202c33" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-[13px]" style={{ color: "#8696a0" }}>No conversations yet</p>
            </div>
          ) : (
            conversations.map((convo) => {
              const isSelected = selectedId === convo.id;
              return (
                <button
                  key={convo.id}
                  onClick={() => setSelectedId(convo.id)}
                  className="w-full text-left transition-colors"
                  style={{ background: isSelected ? "#2a3942" : "transparent" }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "#202c33"; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #2a3942" }}>
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[14px] font-semibold"
                      style={{ background: "linear-gradient(135deg, #00a884, #025144)" }}
                    >
                      {getInitials(convo.name, convo.phone)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[15px] font-medium truncate" style={{ color: "#e9edef" }}>
                          {convo.name || convo.phone}
                        </span>
                        <span className="text-[11px] flex-shrink-0" style={{ color: "#8696a0" }}>
                          {formatTime(convo.updated_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] truncate" style={{ color: "#8696a0" }}>
                          {convo.last_message || "No messages yet"}
                        </p>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide flex-shrink-0"
                          style={
                            convo.mode === "agent"
                              ? { background: "#00382a", color: "#00a884" }
                              : { background: "#3d2a00", color: "#f59e0b" }
                          }
                        >
                          {convo.mode === "agent" ? "AI" : "You"}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Chat Panel ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "#0b141a" }}>
        {!selected ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center" style={{ background: "#0b141a" }}>
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ background: "#202c33", boxShadow: "0 0 0 1px #2a3942" }}
            >
              <Image src="/whatsapp-logo.svg" alt="WhatsApp" width={56} height={56} />
            </div>
            <div className="max-w-sm">
              <h2 className="text-[22px] font-light mb-2" style={{ color: "#e9edef" }}>
                WhatsApp AI Agent
              </h2>
              <p className="text-[14px] leading-relaxed" style={{ color: "#8696a0" }}>
                Select a conversation from the sidebar to view messages. Your AI agent automatically handles incoming chats using your knowledge base.
              </p>
            </div>
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium"
              style={{ background: "#202c33", color: "#8696a0", border: "1px solid #2a3942" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              End-to-end encrypted
            </div>
            <Link
              href="/knowledge"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold transition-colors"
              style={{ background: "#00a884", color: "#ffffff" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Manage Knowledge Base
            </Link>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ background: "#202c33", borderBottom: "1px solid #2a3942" }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #00a884, #025144)" }}
                >
                  {getInitials(selected.name, selected.phone)}
                </div>
                <div>
                  <h2 className="text-[15px] font-medium" style={{ color: "#e9edef" }}>
                    {selected.name || selected.phone}
                  </h2>
                  <p className="text-[12px]" style={{ color: "#8696a0" }}>{selected.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMode}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                  style={
                    selected.mode === "agent"
                      ? { background: "#00382a", color: "#00a884", border: "1px solid #005c46" }
                      : { background: "#3d2a00", color: "#f59e0b", border: "1px solid #614300" }
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: selected.mode === "agent" ? "#25D366" : "#f59e0b" }}
                  />
                  {selected.mode === "agent" ? "AI Active" : "Human Mode"}
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div
              className="flex-1 overflow-y-auto px-6 py-4 space-y-1"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%230b141a'/%3E%3Cg opacity='0.04' fill='%2300a884'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3Ccircle cx='60' cy='20' r='1'/%3E%3Ccircle cx='100' cy='20' r='1'/%3E%3Ccircle cx='140' cy='20' r='1'/%3E%3Ccircle cx='180' cy='20' r='1'/%3E%3Ccircle cx='220' cy='20' r='1'/%3E%3Ccircle cx='260' cy='20' r='1'/%3E%3Ccircle cx='300' cy='20' r='1'/%3E%3Ccircle cx='340' cy='20' r='1'/%3E%3Ccircle cx='380' cy='20' r='1'/%3E%3Ccircle cx='20' cy='60' r='1'/%3E%3Ccircle cx='60' cy='60' r='1'/%3E%3Ccircle cx='100' cy='60' r='1'/%3E%3Ccircle cx='140' cy='60' r='1'/%3E%3Ccircle cx='180' cy='60' r='1'/%3E%3Ccircle cx='220' cy='60' r='1'/%3E%3Ccircle cx='260' cy='60' r='1'/%3E%3Ccircle cx='300' cy='60' r='1'/%3E%3Ccircle cx='340' cy='60' r='1'/%3E%3Ccircle cx='380' cy='60' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
                scrollbarWidth: "thin",
                scrollbarColor: "#374045 transparent",
              }}
            >
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const showTime = i === messages.length - 1 || messages[i + 1]?.role !== msg.role;
                return (
                  <div key={msg.id} className={`flex ${isUser ? "justify-start" : "justify-end"} mb-1`}>
                    <div className={`flex flex-col ${isUser ? "items-start" : "items-end"} max-w-[65%]`}>
                      <div
                        className="px-3 py-2 rounded-lg text-[14px] leading-relaxed relative"
                        style={
                          isUser
                            ? {
                                background: "#202c33",
                                color: "#e9edef",
                                borderRadius: "0 8px 8px 8px",
                                boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)",
                              }
                            : {
                                background: "#005c4b",
                                color: "#e9edef",
                                borderRadius: "8px 0 8px 8px",
                                boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)",
                              }
                        }
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        {showTime && (
                          <div className={`flex items-center gap-1 mt-1 ${isUser ? "justify-start" : "justify-end"}`}>
                            <span className="text-[11px]" style={{ color: "#8696a0" }}>{formatTime(msg.created_at)}</span>
                            {!isUser && (
                              <svg width="14" height="14" viewBox="0 0 16 15" fill="#53bdeb">
                                <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.033L2.86 8.704a.366.366 0 0 0-.51.064l-.379.483a.418.418 0 0 0 .037.541l2.105 2.01c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512z" />
                              </svg>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0" style={{ background: "#202c33" }}>
              <div
                className="flex-1 flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: "#2a3942" }}
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Type a message"
                  className="flex-1 bg-transparent text-[14px] focus:outline-none"
                  style={{ color: "#e9edef" }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
                style={{ background: "#00a884" }}
              >
                {sending ? (
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
