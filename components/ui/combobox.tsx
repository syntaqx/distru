"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { SelectOption } from "./select";

/**
 * A searchable combobox — the accessible replacement for native `<input list>` /
 * `<datalist>`. Type to filter suggestions, arrow keys + Enter to pick, and free
 * text is allowed (so a not-yet-existing vendor/customer name can be typed and
 * created on save). Styled to match the Radix Select; the list is portaled so it
 * never clips inside a card, and keeps input focus while open.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  ariaLabel,
  id,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = q
      ? options.filter(
          (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
        )
      : options;
    return list.slice(0, 50);
  }, [options, q]);

  const isOpen = open && filtered.length > 0;

  function openNow() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActive(0);
    setOpen(true);
  }
  function choose(o: SelectOption) {
    onValueChange(o.value);
    setOpen(false);
    inputRef.current?.blur();
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) return openNow();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && isOpen && filtered[active]) {
      e.preventDefault();
      choose(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Popover.Root open={isOpen} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative">
          <input
            ref={inputRef}
            id={id}
            aria-label={ariaLabel}
            className={`input pr-8${className ? ` ${className}` : ""}`}
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(e) => {
              onValueChange(e.target.value);
              openNow();
            }}
            onFocus={openNow}
            onBlur={() => {
              closeTimer.current = setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={onKeyDown}
          />
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="select-content"
          style={{ width: "var(--radix-popover-trigger-width)" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (inputRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <div className="max-h-64 overflow-auto p-1">
            {filtered.map((o, i) => (
              <button
                type="button"
                key={o.value}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                onMouseEnter={() => setActive(i)}
                data-highlighted={i === active ? "" : undefined}
                className="select-item w-full text-left"
              >
                {o.label}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
