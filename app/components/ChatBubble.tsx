"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "../lib/store";

interface Props {
  messages: ChatMessage[];
  onSendMessage: (content: string) => Promise<unknown>;
  onClearChat: () => void;
}

export default function ChatBubble({
  messages,
  onSendMessage,
  onClearChat,
}: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const msg = input.trim();
    setInput("");
    setLoading(true);

    try {
      await onSendMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
          open
            ? "bg-neutral-800 text-white rotate-45"
            : "bg-black text-white hover:scale-105"
        }`}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M1 9h16M9 1v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[380px] h-[520px] bg-white border border-neutral-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slideUp">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <div>
              <span className="text-sm font-semibold text-black">AI Assistant</span>
              <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                Goals analysis &amp; extraction
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={onClearChat}
                className="text-[10px] font-mono text-neutral-400 hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-xs text-neutral-400 font-mono space-y-3 mt-6">
                <p className="text-neutral-500">Ask me to:</p>
                <p>Summarize current goals</p>
                <p>Suggest goals from context</p>
                <p>Analyze goal alignment</p>
                <p>Extract goals from meeting notes</p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`text-xs leading-relaxed ${
                  msg.role === "user" ? "text-black" : "text-neutral-600"
                }`}
              >
                <span className="text-[10px] font-mono text-neutral-400 block mb-0.5">
                  {msg.role === "user" ? "You" : "Assistant"}
                </span>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="text-xs text-neutral-400 font-mono animate-pulse">
                Thinking...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSend} className="px-5 py-4 border-t border-neutral-100">
            <div className="flex gap-2">
              <input
                className="flex-1 text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 outline-none focus:border-black focus:bg-white transition-colors"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about goals..."
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="text-xs font-mono px-4 py-2.5 bg-black text-white rounded-lg disabled:opacity-30 transition-opacity"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
