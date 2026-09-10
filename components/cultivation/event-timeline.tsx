import {
  ArrowRightLeft,
  Droplets,
  Move,
  Scissors,
  StickyNote,
  Trash2,
  type LucideIcon,
} from "lucide-react";

export type EventItem = {
  id: string;
  type: string;
  note: string | null;
  occurredAt: string | null;
};

const ICON: Record<string, LucideIcon> = {
  PHASE_CHANGE: ArrowRightLeft,
  FEED: Droplets,
  MOVE: Move,
  HARVEST: Scissors,
  DESTROY: Trash2,
  NOTE: StickyNote,
};

const TONE: Record<string, string> = {
  PHASE_CHANGE: "text-info",
  FEED: "text-accent",
  MOVE: "text-muted",
  HARVEST: "text-warn",
  DESTROY: "text-danger",
  NOTE: "text-muted",
};

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

/** A vertical event timeline for a plant or plant batch. Presentational. */
export function EventTimeline({ events }: { events: EventItem[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border px-4 py-8 text-center text-sm text-muted">
        No events yet. Phase changes, feedings and notes will show up here.
      </div>
    );
  }
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {events.map((e) => {
        const Icon = ICON[e.type] ?? StickyNote;
        const tone = TONE[e.type] ?? "text-muted";
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border bg-bg ${tone}`}
              aria-hidden
            >
              <Icon size={12} />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge text-[10px] ${tone}`}>{e.type}</span>
              <span className="text-xs text-muted tabular-nums">{fmt(e.occurredAt)}</span>
            </div>
            {e.note && <p className="mt-0.5 text-sm">{e.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
