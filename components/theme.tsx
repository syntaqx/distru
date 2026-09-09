"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";

const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system",
  setTheme: () => {},
});

function apply(theme: Theme) {
  const el = document.documentElement;
  if (theme === "system") delete el.dataset.theme;
  else el.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    let t: Theme = "system";
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark" || stored === "system") t = stored;
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(t);
    apply(t);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    try {
      localStorage.setItem("theme", t);
    } catch {}
    apply(t);
  }

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

// The no-flash theme script lives inline in the server root layout (app/layout.tsx),
// not here - a <script> rendered from a Client Component isn't executed on the
// client, which is what React 19 warns about.

/** Segmented light / system / dark control. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const opts: { value: Theme; Icon: typeof Sun; label: string }[] = [
    { value: "light", Icon: Sun, label: "Light" },
    { value: "system", Icon: Monitor, label: "System" },
    { value: "dark", Icon: Moon, label: "Dark" },
  ];
  return (
    <div className="flex gap-1 rounded-lg border p-0.5" style={{ background: "var(--color-bg)" }}>
      {opts.map(({ value, Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          aria-label={label}
          className="grid size-7 place-items-center rounded-md transition-colors"
          style={
            theme === value
              ? { background: "var(--color-surface2)", color: "var(--color-fg)" }
              : { color: "var(--color-muted)" }
          }
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
