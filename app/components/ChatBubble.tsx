"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  onSendMessage: (content: string) => Promise<{ reply?: string; error?: string }>;
  onClearChat: () => Promise<void>;
  initialMessages: Message[];
  page?: string;
}

export default function ChatBubble({ onSendMessage, onClearChat, initialMessages, page }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const msg = input.trim();
    setInput("");

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await onSendMessage(msg);
      if (result.error) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `Error: ${result.error}` }]);
      } else if (result.reply) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: result.reply! }]);
      }
    } catch {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Failed to get response." }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    await onClearChat();
    setMessages([]);
  }

  // Format assistant messages: bold **text**, bullet points, etc.
  function formatContent(text: string) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-5 right-5 z-50 w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg ${
          open ? "bg-neutral-800 text-white rotate-45" : "bg-black text-white hover:scale-105"
        }`}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path d="M1 9h16M9 1v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-[72px] right-5 z-50 w-[400px] h-[560px] bg-white border border-neutral-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-neutral-50">
            <div>
              <span className="text-sm font-semibold text-black">micro<em className="not-italic font-normal text-neutral-500">goals</em> AI</span>
              <p className="text-[9px] font-mono text-neutral-400 mt-0.5">
                {page === "technical" ? "Technical canvas" : "Goals & strategy"} &middot; Persistent memory
              </p>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button onClick={handleClear} className="text-[9px] font-mono text-neutral-400 hover:text-red-500">Clear</button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="text-[11px] text-neutral-400 font-mono space-y-2 mt-4">
                <p className="text-neutral-500 font-medium">I can help with:</p>
                <div className="space-y-1">
                  {[
                    "\"Add a weekly goal to deliver GDM data\"",
                    "\"What are our blocked goals?\"",
                    "\"Summarize our 6-month strategy\"",
                    "\"Create a canvas task for Nico\"",
                    "\"Remember that India mono is deprioritized\"",
                    "\"Extract goals from this meeting transcript\"",
                  ].map((s, i) => (
                    <button key={i} onClick={() => setInput(s.replace(/"/g, ""))}
                      className="block text-left text-[10px] text-neutral-400 hover:text-black transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`${msg.role === "user" ? "flex justify-end" : ""}`}>
                <div className={`max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-black text-white rounded-2xl rounded-br-sm px-3 py-2"
                    : "bg-neutral-50 text-neutral-700 rounded-2xl rounded-bl-sm px-3 py-2 border border-neutral-100"
                }`}>
                  <div className="text-[11px] leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: msg.role === "assistant" ? formatContent(msg.content) : msg.content }} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-1.5 px-3 py-2">
                <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="px-4 py-3 border-t border-neutral-100">
            <div className="flex gap-2">
              <input
                className="flex-1 text-[11px] bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 outline-none focus:border-black focus:bg-white transition-colors"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                disabled={loading}
                autoFocus={open}
              />
              <button type="submit" disabled={loading || !input.trim()}
                className="text-[11px] font-mono px-3 py-2.5 bg-black text-white rounded-xl disabled:opacity-30 transition-opacity">
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
