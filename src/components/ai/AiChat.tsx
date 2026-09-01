"use client";

import { useRef, useState, useTransition } from "react";
import { Send, Sparkles } from "lucide-react";
import { askTradingAssistant } from "@/lib/actions/ai";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/ai/client";

export function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = () => {
    const question = input.trim();
    if (!question) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");

    startTransition(async () => {
      const result = await askTradingAssistant(next);
      if (result.ok) {
        setMessages([...next, { role: "assistant", content: result.text }]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } else {
        setError(result.error);
      }
    });
  };

  const suggestions = [
    "What's my win rate this month?",
    "Which symbol has been my best performer?",
    "Am I trading better long or short?",
  ];

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border bg-surface p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Sparkles className="h-8 w-8 text-text-faint" />
            <p className="text-sm text-text-muted">
              Ask about your logged trades — I only see what&apos;s already in your journal.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-surface-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-sm",
              m.role === "user"
                ? "ml-auto bg-accent text-accent-fg"
                : "bg-surface-2 text-text",
            )}
          >
            {m.content}
          </div>
        ))}
        {isPending && (
          <div className="max-w-[85%] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text-faint">
            Thinking…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-loss/40 bg-loss-bg px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask about your trading performance…"
          className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
        <button
          onClick={send}
          disabled={isPending || !input.trim()}
          className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
