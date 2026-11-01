"use client";

import { Bot, CornerDownLeft, LoaderCircle, RotateCcw, Sparkles, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AnswerChartCard } from "@/components/ai/answer-charts";
import { Markdown } from "@/components/ai/markdown";
import { PageHeader, SessionGate } from "@/components/shell/page";
import { Button, ErrorState } from "@/components/ui/primitives";
import { useAsk, useAskSuggestions } from "@/lib/api/queries";
import type { AskResponse, ChatTurn } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

export default function AskPage() {
  const { key } = useSelection();
  return (
    <SessionGate>
      {/* A new session starts a new conversation. */}
      <Ask key={key ? `${key.season}-${key.round}-${key.session}` : "none"} />
    </SessionGate>
  );
}

type Message = { role: "user"; text: string } | { role: "assistant"; res: AskResponse };

function Ask() {
  const { key } = useSelection();
  const suggestions = useAskSuggestions(key);
  const ask = useAsk(key);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const assistant = suggestions.data?.assistant;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, ask.isPending]);

  const send = (text: string) => {
    const question = text.trim();
    if (question.length < 2 || ask.isPending) return;
    const history: ChatTurn[] = messages.slice(-8).map((m) =>
      m.role === "user" ? { role: "user", content: m.text } : { role: "assistant", content: m.res.answer },
    );
    setMessages((m) => [...m, { role: "user", text: question }]);
    setDraft("");
    ask.mutate(
      { question, history },
      { onSuccess: (res) => setMessages((m) => [...m, { role: "assistant", res }]) },
    );
  };

  const last = [...messages].reverse().find((m) => m.role === "assistant") as Extract<Message, { role: "assistant" }> | undefined;
  const chips = last?.res.follow_ups ?? suggestions.data?.suggestions ?? [];

  return (
    <>
      <PageHeader
        title="Ask the pit wall"
        description="Ask anything about this session in plain English. Every answer is worked out from the session's timing and telemetry, and comes with the charts that back it up."
        actions={
          <>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] text-ink-2"
              title={assistant?.enabled ? `Language model: ${assistant.provider}` : "No language model configured: the built-in analyst answers from rules and templates."}
            >
              {assistant?.enabled ? <Sparkles className="size-3.5 text-team" aria-hidden /> : <Bot className="size-3.5 text-team" aria-hidden />}
              {assistant?.enabled ? assistant.model : "Built-in analyst"}
            </span>
            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => { setMessages([]); ask.reset(); }}>
                <RotateCcw className="size-3.5" aria-hidden /> New chat
              </Button>
            )}
          </>
        }
      />

      <div className="mx-auto max-w-5xl space-y-5 pb-36">
        {messages.length === 0 && <Welcome />}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-team px-4 py-2.5 text-[14px] text-on-team">{m.text}</p>
            </div>
          ) : (
            <AnswerBlock key={i} res={m.res} />
          ),
        )}

        {ask.isPending && (
          <div className="flex items-center gap-2 text-[13.5px] text-ink-3" role="status">
            <LoaderCircle className="size-4 animate-spin text-team" aria-hidden /> Analysing the data…
          </div>
        )}
        {ask.error && <ErrorState error={ask.error} className="rounded-lg border border-line bg-surface" />}
        <div ref={endRef} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur lg:left-[232px]">
        <div className="mx-auto max-w-5xl px-4 py-3">
          {chips.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1" aria-label="Suggested questions">
              {chips.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  disabled={ask.isPending}
                  className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-team hover:text-ink disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex items-end gap-2"
          >
            <label htmlFor="ask-input" className="sr-only">Your question</label>
            <textarea
              id="ask-input"
              rows={1}
              value={draft}
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder="Ask about this session…"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:border-team focus:outline-none"
            />
            <Button type="submit" variant="solid" disabled={ask.isPending || draft.trim().length < 2} className="h-[44px] px-4">
              Ask <CornerDownLeft className="size-3.5" aria-hidden />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

function Welcome() {
  const topics = [
    ["Why one driver beat another", "pace, strategy, pit stops and the gap lap by lap"],
    ["Where a lap was won", "sector and mini-sector deltas, top speed, throttle"],
    ["Strategy calls", "stints, degradation, and whether an undercut would have worked"],
    ["What happened", "safety cars, penalties, lead changes and conditions"],
  ];
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <Bot className="size-5 text-team" aria-hidden /> Your race engineer, on call
      </div>
      <p className="mt-1.5 text-[14px] text-ink-2">Pick a suggestion below or type your own question. You can ask about:</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {topics.map(([t, d]) => (
          <li key={t} className="rounded-lg bg-surface-2 px-4 py-3">
            <span className="block text-[13.5px] font-semibold text-ink">{t}</span>
            <span className="block text-[13px] text-ink-3">{d}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnswerBlock({ res }: { res: AskResponse }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl rounded-bl-sm border border-line bg-surface px-5 py-4">
        {res.notice && <p className="mb-2 text-[12.5px] text-warn">{res.notice}</p>}
        <Markdown>{res.answer}</Markdown>
        {res.tools.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3 text-[11.5px] text-ink-3">
            <Wrench className="size-3" aria-hidden />
            <span>{res.mode === "llm" ? `${res.model} used` : "Built-in analyst used"}</span>
            {res.tools.map((t, i) => (
              <code key={i} className={cn("rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2")}>
                {t.name}
                {Object.keys(t.args).length > 0 && `(${Object.values(t.args).join(", ")})`}
              </code>
            ))}
          </div>
        )}
      </div>
      {res.charts.length > 0 && (
        <div className="grid gap-3">
          {res.charts.map((c, i) => (
            <AnswerChartCard key={i} chart={c} />
          ))}
        </div>
      )}
    </div>
  );
}
