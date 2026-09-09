"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";

/**
 * A themed Radix tooltip. `children` is the trigger (pass a focusable/hoverable
 * element - to tooltip a disabled control, wrap it in a `<span>`, since disabled
 * elements don't emit pointer events).
 */
export function Tooltip({
  content,
  children,
  side = "top",
  delayDuration = 200,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
}) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content side={side} sideOffset={6} className="tooltip-content">
            {content}
            <RadixTooltip.Arrow className="tooltip-arrow" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
