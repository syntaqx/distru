"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  GripVertical,
  LayoutList,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  ShoppingCart,
  Trash2,
  User,
} from "lucide-react";
import { deleteTaskAction, setTaskStatusAction } from "@/app/(app)/tasks/actions";

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  link: { type: string; id: string; label: string } | null;
};

const STATUS_META: { key: string; label: string }[] = [
  { key: "OPEN", label: "To do" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "DONE", label: "Done" },
];

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "var(--color-danger)",
  MEDIUM: "var(--color-warn)",
  LOW: "var(--color-info)",
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDue(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function isOverdue(t: TaskView) {
  return t.status !== "DONE" && t.dueAt != null && new Date(t.dueAt) < startOfDay(new Date());
}

function LinkIcon({ type }: { type: string }) {
  if (type === "company") return <Building2 size={12} />;
  if (type === "order") return <ShoppingCart size={12} />;
  return <CircleDot size={12} />;
}

export function TasksManager({ rows }: { rows: TaskView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<"board" | "calendar">("board");
  const [error, setError] = useState<string | null>(null);

  // Optimistic status overrides for drag-and-drop (taskId -> status): a dropped
  // card jumps columns instantly, is pruned once the refreshed rows agree, and
  // is reverted if the server rejects the move.
  const [moves, setMoves] = useState<Record<string, string>>({});
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoves((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const r of rows)
        if (next[r.id] === r.status) {
          delete next[r.id];
          changed = true;
        }
      return changed ? next : prev;
    });
  }, [rows]);

  const effectiveRows = useMemo(
    () => rows.map((r) => (moves[r.id] ? { ...r, status: moves[r.id] } : r)),
    [rows, moves],
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong.");
    });
  }

  function moveTask(id: string, status: string) {
    const current = moves[id] ?? rows.find((r) => r.id === id)?.status;
    if (!current || current === status) return;
    setError(null);
    setMoves((m) => ({ ...m, [id]: status }));
    startTransition(async () => {
      const res = await setTaskStatusAction(id, status);
      if (res.ok) router.refresh();
      else {
        setMoves((m) => {
          const n = { ...m };
          delete n[id];
          return n;
        });
        setError(res.error ?? "Could not move the task.");
      }
    });
  }

  const counts = useMemo(() => {
    const by = (s: string) => effectiveRows.filter((r) => r.status === s).length;
    return {
      total: effectiveRows.length,
      open: by("OPEN"),
      inProgress: by("IN_PROGRESS"),
      done: by("DONE"),
      overdue: effectiveRows.filter(isOverdue).length,
    };
  }, [effectiveRows]);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Total", counts.total, undefined],
          ["To do", counts.open, undefined],
          ["In progress", counts.inProgress, undefined],
          ["Done", counts.done, undefined],
          ["Overdue", counts.overdue, counts.overdue ? "var(--color-danger)" : undefined],
        ].map(([label, value, color]) => (
          <div key={label as string} className="card">
            <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-1 text-2xl font-semibold" style={{ color: color as string | undefined }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border p-0.5" style={{ background: "var(--color-surface)" }}>
          <button
            className={`btn btn-ghost px-3 py-1.5 text-sm ${view === "board" ? "btn-active" : ""}`}
            style={view === "board" ? { background: "var(--color-surface2)" } : undefined}
            onClick={() => setView("board")}
            aria-pressed={view === "board"}
          >
            <LayoutList size={15} /> Board
          </button>
          <button
            className={`btn btn-ghost px-3 py-1.5 text-sm ${view === "calendar" ? "btn-active" : ""}`}
            style={view === "calendar" ? { background: "var(--color-surface2)" } : undefined}
            onClick={() => setView("calendar")}
            aria-pressed={view === "calendar"}
          >
            <CalendarDays size={15} /> Calendar
          </button>
        </div>
        <Link href="/tasks/new" className="btn btn-primary ml-auto">
          <Plus size={16} /> New task
        </Link>
      </div>

      {error && <div className="mb-3 text-sm text-danger">{error}</div>}

      {rows.length === 0 ? (
        <div className="rounded-xl border p-10 text-center text-muted" style={{ background: "var(--color-surface)" }}>
          No tasks yet. Create one, or ask the Copilot to add a task for you.
        </div>
      ) : view === "board" ? (
        <BoardView rows={effectiveRows} pending={pending} run={run} onMove={moveTask} />
      ) : (
        <CalendarView rows={effectiveRows} />
      )}
    </div>
  );
}

function BoardView({
  rows,
  pending,
  run,
  onMove,
}: {
  rows: TaskView[];
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  onMove: (id: string, status: string) => void;
}) {
  // Native HTML5 drag-and-drop: drag a card between columns to change its
  // status (buttons on each card still work as a keyboard/touch fallback).
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STATUS_META.map((col) => {
        const items = rows
          .filter((r) => r.status === col.key)
          .sort((a, b) => {
            if (!a.dueAt) return 1;
            if (!b.dueAt) return -1;
            return a.dueAt.localeCompare(b.dueAt);
          });
        const isOver = overCol === col.key && dragId !== null;
        return (
          <div
            key={col.key}
            className="rounded-xl border transition-colors"
            style={{
              background: isOver ? "var(--color-surface)" : "var(--color-surface2)",
              outline: isOver ? "2px dashed var(--color-accent)" : undefined,
              outlineOffset: -2,
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overCol !== col.key) setOverCol(col.key);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setOverCol((c) => (c === col.key ? null : c));
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragId;
              if (id) onMove(id, col.key);
              setOverCol(null);
              setDragId(null);
            }}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="badge">{items.length}</span>
            </div>
            <div className="space-y-2 p-2">
              {items.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  pending={pending}
                  run={run}
                  dragging={dragId === t.id}
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverCol(null);
                  }}
                />
              ))}
              {items.length === 0 && (
                <div className="px-2 py-6 text-center text-xs text-muted">
                  {isOver ? "Drop to move here" : "Nothing here."}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({
  task,
  pending,
  run,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: TaskView;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const overdue = isOverdue(task);
  return (
    <div
      className="card p-3 transition-opacity"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      style={{ opacity: dragging ? 0.4 : 1, cursor: "grab" }}
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden />
        <span
          className="mt-1.5 inline-block size-2 shrink-0 rounded-full"
          style={{ background: PRIORITY_COLOR[task.priority] ?? "var(--color-muted)" }}
          title={`${task.priority} priority`}
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks/${task.id}/edit`}
            draggable={false}
            className="block truncate text-sm font-medium hover:underline"
          >
            {task.title}
          </Link>
          {task.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">{task.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {task.dueAt && (
              <span
                className="inline-flex items-center gap-1"
                style={overdue ? { color: "var(--color-danger)" } : undefined}
              >
                <Clock size={12} /> {fmtDue(task.dueAt)}
              </span>
            )}
            {task.assigneeName && (
              <span className="inline-flex items-center gap-1">
                <User size={12} /> {task.assigneeName}
              </span>
            )}
            {task.link && (
              <span className="inline-flex items-center gap-1">
                <LinkIcon type={task.link.type} /> {task.link.label}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
        {task.status === "OPEN" && (
          <button
            className="btn btn-ghost px-2 py-1 text-xs"
            disabled={pending}
            onClick={() => run(() => setTaskStatusAction(task.id, "IN_PROGRESS"))}
            title="Start"
          >
            <Play size={13} /> Start
          </button>
        )}
        {task.status === "IN_PROGRESS" && (
          <button
            className="btn btn-ghost px-2 py-1 text-xs"
            disabled={pending}
            onClick={() => run(() => setTaskStatusAction(task.id, "DONE"))}
            title="Complete"
          >
            <Check size={13} /> Complete
          </button>
        )}
        {task.status === "DONE" && (
          <button
            className="btn btn-ghost px-2 py-1 text-xs"
            disabled={pending}
            onClick={() => run(() => setTaskStatusAction(task.id, "OPEN"))}
            title="Reopen"
          >
            <RotateCcw size={13} /> Reopen
          </button>
        )}
        <Link
          className="btn btn-ghost px-2 py-1"
          href={`/tasks/${task.id}/edit`}
          draggable={false}
          title="Edit"
          aria-label={`Edit ${task.title}`}
        >
          <Pencil size={13} />
        </Link>
        <button
          className="btn btn-ghost px-2 py-1"
          disabled={pending}
          title="Delete"
          aria-label={`Delete ${task.title}`}
          onClick={() => {
            if (confirm(`Delete "${task.title}"?`)) run(() => deleteTaskAction(task.id));
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarView({ rows }: { rows: TaskView[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map<string, TaskView[]>();
    for (const t of rows) {
      if (!t.dueAt) continue;
      const key = dayKey(new Date(t.dueAt));
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return map;
  }, [rows]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // back to Sunday
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  const todayKey = dayKey(new Date());
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const unscheduled = rows.filter((t) => !t.dueAt && t.status !== "DONE");

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base font-semibold">{monthLabel}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            className="btn btn-ghost px-2 py-1"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="btn btn-outline px-3 py-1 text-sm"
            onClick={() => {
              const n = new Date();
              setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
            }}
          >
            Today
          </button>
          <button
            className="btn btn-ghost px-2 py-1"
            aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-140 rounded-xl border" style={{ background: "var(--color-border)" }}>
          <div className="grid grid-cols-7 gap-px">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="px-2 py-1.5 text-center text-xs font-medium text-muted"
                style={{ background: "var(--color-surface2)" }}
              >
                {w}
              </div>
            ))}
            {grid.map((d) => {
              const key = dayKey(d);
              const items = byDay.get(key) ?? [];
              const inMonth = d.getMonth() === month;
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className="min-h-24 p-1.5 align-top"
                  style={{
                    background: "var(--color-surface)",
                    opacity: inMonth ? 1 : 0.5,
                  }}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={`inline-flex size-5 items-center justify-center rounded-full text-xs ${isToday ? "font-semibold" : "text-muted"}`}
                      style={isToday ? { background: "var(--color-accent)", color: "var(--color-accentfg)" } : undefined}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 4).map((t) => (
                      <Link
                        key={t.id}
                        href={`/tasks/${t.id}/edit`}
                        className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-xs hover:underline"
                        style={{
                          background: "var(--color-surface2)",
                          textDecoration: t.status === "DONE" ? "line-through" : undefined,
                          opacity: t.status === "DONE" ? 0.6 : 1,
                        }}
                        title={t.title}
                      >
                        <span
                          className="inline-block size-1.5 shrink-0 rounded-full"
                          style={{ background: PRIORITY_COLOR[t.priority] ?? "var(--color-muted)" }}
                        />
                        <span className="truncate">{t.title}</span>
                      </Link>
                    ))}
                    {items.length > 4 && (
                      <div className="px-1 text-xs text-muted">+{items.length - 4} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-muted">No due date</h3>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}/edit`}
                className="badge inline-flex items-center gap-1.5 hover:underline"
              >
                <span
                  className="inline-block size-1.5 rounded-full"
                  style={{ background: PRIORITY_COLOR[t.priority] ?? "var(--color-muted)" }}
                />
                {t.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
