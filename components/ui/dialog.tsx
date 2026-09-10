"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/**
 * A reusable, accessible modal built on Radix Dialog: closes on Esc and on
 * backdrop click, traps focus, locks body scroll, and animates in/out - the
 * behavior every modal in the app should have. Children mount only while open,
 * so a modal that owns a resource (e.g. the camera) releases it on close.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = "max-w-md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: string;
  children: ReactNode;
  /** Width utility for the content panel (default `max-w-md`). */
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal-content ${className}`}
          aria-describedby={description ? undefined : "modal-no-desc"}
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
            <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
            <Dialog.Close
              className="-mr-1 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface2 hover:text-fg"
              aria-label="Close"
            >
              <X size={16} />
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          ) : (
            <span id="modal-no-desc" className="sr-only">
              Dialog
            </span>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
