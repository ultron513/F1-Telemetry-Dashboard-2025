"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface PickerItem<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Text used for filtering. */
  search?: string;
  group?: string;
  disabled?: boolean;
  hint?: React.ReactNode;
}

interface PickerProps<T extends string> {
  label: string;
  value: T | null;
  items: PickerItem<T>[];
  onChange: (value: T) => void;
  /** Content inside the trigger button. */
  display: React.ReactNode;
  caption?: string;
  searchable?: boolean;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
}

export function Picker<T extends string>({
  label,
  value,
  items,
  onChange,
  display,
  caption,
  searchable = false,
  placeholder = "Search",
  className,
  contentClassName,
  disabled,
  align = "start",
}: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => !q || (i.search ?? String(i.value)).toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, filtered.findIndex((i) => i.value === value));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(idx);
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-index="${idx}"]`)?.scrollIntoView({ block: "nearest" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (item: PickerItem<T> | undefined) => {
    if (!item || item.disabled) return;
    onChange(item.value);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      const next = Math.min(filtered.length - 1, Math.max(0, active + dir));
      setActive(next);
      listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(filtered[active]);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "group flex h-11 min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-left transition-colors hover:border-line-strong data-[state=open]:border-team disabled:opacity-50",
            className,
          )}
        >
          <span className="min-w-0 flex-1">
            {caption && <span className="block text-[11px] leading-none text-ink-3">{caption}</span>}
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[14px] leading-tight font-semibold text-ink">
              {display}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          onKeyDown={onKeyDown}
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] min-w-64 overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-pop)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            contentClassName,
          )}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 text-ink-3" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder={placeholder}
                aria-controls={listId}
                aria-label={`${label} search`}
                className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
              />
            </div>
          )}
          <div ref={listRef} id={listId} role="listbox" aria-label={label} tabIndex={-1} className="scroll-thin max-h-80 overflow-y-auto p-1 outline-none">
            {filtered.length === 0 && <div className="px-3 py-6 text-center text-sm text-ink-3">No matches</div>}
            {filtered.map((item, i) => {
              const header = item.group && item.group !== filtered[i - 1]?.group ? item.group : null;
              const selected = item.value === value;
              return (
                <div key={item.value}>
                  {header && <div className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold text-ink-3">{header}</div>}
                  <div
                    role="option"
                    data-index={i}
                    aria-selected={selected}
                    aria-disabled={item.disabled}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(item)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-ink",
                      i === active && "bg-surface-3",
                      item.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">{item.label}</span>
                    {item.hint && <span className="shrink-0 text-xs text-ink-3">{item.hint}</span>}
                    <Check className={cn("size-4 shrink-0 text-team", !selected && "invisible")} aria-hidden />
                  </div>
                </div>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
