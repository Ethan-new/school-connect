"use client";

import { useState, useEffect, useRef } from "react";
import { getMessagesAction, sendMessageAction } from "@/app/actions";
import type { MessageSerialized } from "@/lib/messaging";

interface ParentMessageThreadModalProps {
  conversationId: string;
  teacherName: string;
  studentName: string;
  isOpen: boolean;
  onClose: () => void;
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ParentMessageThreadModal({
  conversationId,
  teacherName,
  studentName,
  isOpen,
  onClose,
}: ParentMessageThreadModalProps) {
  const [messages, setMessages] = useState<MessageSerialized[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !conversationId) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getMessagesAction(conversationId);
        if (res.success) setMessages(res.messages);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isOpen, conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    const res = await sendMessageAction(conversationId, body);
    setSending(false);
    if (res.success) {
      setInput("");
      const msgsRes = await getMessagesAction(conversationId);
      if (msgsRes.success) setMessages(msgsRes.messages);
    } else if (res.error) {
      setError(res.error);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="fixed left-4 right-4 top-4 bottom-4 z-50 mx-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Message — {teacherName}
            </h2>
            <p className="text-sm text-zinc-500">About {studentName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Loading...
            </p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No messages yet. Start the conversation below.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${
                    m.isFromTeacher ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      m.isFromTeacher
                        ? "bg-red-600 text-white"
                        : "bg-zinc-100 text-zinc-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {m.body}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        m.isFromTeacher ? "text-red-200" : "text-zinc-500"
                      }`}
                    >
                      {formatMessageTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <form
          onSubmit={handleSend}
          className="shrink-0 border-t border-zinc-200 p-3"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={loading || sending}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:opacity-50 [color-scheme:light]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || sending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
