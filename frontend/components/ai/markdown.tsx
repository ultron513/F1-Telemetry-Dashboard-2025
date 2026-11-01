// A deliberately tiny Markdown subset for assistant answers: paragraphs,
// "- " and "1. " lists, and **bold**. Built from React elements, so model
// output can never inject HTML.

import { Fragment } from "react";

import { cn } from "@/lib/utils";

function inline(text: string, key: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
      <strong key={`${key}-${i}`} className="font-semibold text-ink">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={`${key}-${i}`}>{p}</Fragment>
    ),
  );
}

type Block = { kind: "p" | "ul" | "ol"; lines: string[] };

function blocks(src: string): Block[] {
  const out: Block[] = [];
  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      out.push({ kind: "p", lines: [] });
      continue;
    }
    const kind: Block["kind"] = /^[-*•]\s+/.test(line) ? "ul" : /^\d+[.)]\s+/.test(line) ? "ol" : "p";
    const text = line.replace(/^([-*•]|\d+[.)])\s+/, "").replace(/^#+\s*/, "");
    const last = out[out.length - 1];
    if (last && last.kind === kind && (kind !== "p" || last.lines.length)) last.lines.push(text);
    else out.push({ kind, lines: [text] });
  }
  return out.filter((b) => b.lines.length);
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("space-y-2.5 text-[14px] leading-relaxed text-ink-2", className)}>
      {blocks(children).map((b, i) => {
        if (b.kind === "ul")
          return (
            <ul key={i} className="space-y-1.5 pl-4 [&>li]:list-disc [&>li]:marker:text-team">
              {b.lines.map((l, j) => (
                <li key={j}>{inline(l, `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        if (b.kind === "ol")
          return (
            <ol key={i} className="tnum space-y-0.5 pl-5 [&>li]:list-decimal [&>li]:marker:text-ink-3">
              {b.lines.map((l, j) => (
                <li key={j}>{inline(l, `${i}-${j}`)}</li>
              ))}
            </ol>
          );
        return (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l, `${i}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
