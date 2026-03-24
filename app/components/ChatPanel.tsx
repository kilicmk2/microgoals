"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage, Goal, createChatMessage } from "../lib/store";

interface Props {
  messages: ChatMessage[];
  goals: Goal[];
  onAddMessage: (msg: ChatMessage) => void;
  onClearChat: () => void;
  onGoalsUpdate: (goals: Goal[]) => void;
}

export default function ChatPanel({
  messages,
  goals,
  onAddMessage,
  onClearChat,
  onGoalsUpdate,
}: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("microgoals_api_key") || "";
      setApiKey(saved);
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function saveApiKey(key: string) {
    setApiKey(key);
    localStorage.setItem("microgoals_api_key", key);
    setShowKeyInput(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = createChatMessage("user", input.trim());
    onAddMessage(userMsg);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          goals,
          apiKey,
        }),
      });

      const data = await res.json();

      if (data.error) {
        onAddMessage(createChatMessage("assistant", `Error: ${data.error}`));
      } else {
        onAddMessage(createChatMessage("assistant", data.reply));
        if (data.updatedGoals) {
          onGoalsUpdate(data.updatedGoals);
        }
      }
    } catch {
      onAddMessage(
        createChatMessage(
          "assistant",
          "Failed to connect. Check your API key and try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
        <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">
          AI Assistant
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="text-[10px] font-mono text-neutral-400 hover:text-black"
          >
            {apiKey ? "Key set" : "Set API key"}
          </button>
          {messages.length > 0 && (
            <button
              onClick={onClearChat}
              className="text-[10px] font-mono text-neutral-400 hover:text-red-500"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {showKeyInput && (
        <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50">
          <p className="text-[10px] font-mono text-neutral-500 mb-2">
            Anthropic API key (stored locally only)
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              className="flex-1 text-xs bg-white border border-neutral-200 rounded px-2 py-1 outline-none focus:border-black"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
            <button
              onClick={() => saveApiKey(apiKey)}
              className="text-xs font-mono px-2 py-1 bg-black text-white rounded"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-xs text-neutral-400 font-mono space-y-2 mt-8">
            <p>Ask me to:</p>
            <p className="text-neutral-500">- Summarize current goals</p>
            <p className="text-neutral-500">- Suggest goals based on context</p>
            <p className="text-neutral-500">- Analyze goal alignment</p>
            <p className="text-neutral-500">- Update goal statuses</p>
            <p className="text-neutral-500">- Paste meeting notes for extraction</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-xs leading-relaxed ${
              msg.role === "user"
                ? "text-black font-medium"
                : "text-neutral-600"
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

      <form onSubmit={handleSend} className="px-4 py-3 border-t border-neutral-200">
        <div className="flex gap-2">
          <input
            className="flex-1 text-xs bg-transparent border border-neutral-200 rounded px-3 py-2 outline-none focus:border-black"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={apiKey ? "Ask about goals..." : "Set API key first..."}
            disabled={loading || !apiKey}
          />
          <button
            type="submit"
            disabled={loading || !apiKey || !input.trim()}
            className="text-xs font-mono px-3 py-2 bg-black text-white rounded disabled:opacity-30"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
