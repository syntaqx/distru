import { listTargets } from "./registry";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type TargetScore = {
  key: string;
  label: string;
  description: string;
  score: number;
  confidence: number;
  requiredCovered: boolean;
  matchedFields: string[];
};

/**
 * Score each registered import target against a file's headers, so the agent can
 * detect what an arbitrary CSV *is* (a product catalog? a customer list?) before
 * asking the user what to do with it. Deterministic and offline.
 */
export type Detection = {
  /** confident: one clear match. ambiguous: 2+ plausible. none: nothing viable. */
  recommendation: "confident" | "ambiguous" | "none";
  top: TargetScore | null;
  /** The candidates worth showing the user (viable ones near the top). */
  candidates: TargetScore[];
  ranked: TargetScore[];
};

const MIN_VIABLE = 0.5; // below this a target's required fields aren't covered
const CLOSE_RATIO = 0.8; // runner-up within 80% of the top score = too close to call

/**
 * Turn raw scores into an explicit recommendation so the agent never guesses:
 * - "none"     → no target covers its required fields; report it can't be mapped.
 * - "ambiguous"→ two+ viable targets are close; the agent must ask which.
 * - "confident"→ one clear winner; the agent proposes it (still confirmed).
 */
export function classifyDetection(headers: string[]): Detection {
  const ranked = scoreTargets(headers);
  const top = ranked[0] ?? null;
  const viable = ranked.filter((r) => r.requiredCovered && r.confidence >= MIN_VIABLE);

  if (!top || viable.length === 0 || top.confidence < MIN_VIABLE || !top.requiredCovered) {
    return { recommendation: "none", top, candidates: ranked.slice(0, 3), ranked };
  }
  const close = viable.filter((r) => r.score >= viable[0].score * CLOSE_RATIO);
  if (close.length > 1) {
    return { recommendation: "ambiguous", top, candidates: close.slice(0, 3), ranked };
  }
  return { recommendation: "confident", top, candidates: viable.slice(0, 3), ranked };
}

export function scoreTargets(headers: string[]): TargetScore[] {
  const nheaders = headers.map(normalize);
  return listTargets()
    .map((t) => {
      let req = 0;
      let reqMatched = 0;
      let opt = 0;
      let optMatched = 0;
      const matched: string[] = [];
      for (const f of t.fields) {
        const cands = [f.key, f.label, ...(f.aliases ?? [])].map(normalize);
        const hit = nheaders.some(
          (h) => cands.includes(h) || cands.some((c) => c && (h.includes(c) || c.includes(h))),
        );
        if (f.required) {
          req++;
          if (hit) reqMatched++;
        } else {
          opt++;
          if (hit) optMatched++;
        }
        if (hit) matched.push(f.key);
      }
      // Confidence: required coverage dominates (a target isn't viable without
      // its required fields), then optional coverage refines. This keeps a rich
      // catalog ranked above a 2-column price sheet that happens to be "100%".
      const requiredCovered = req === 0 || reqMatched === req;
      const reqRatio = req ? reqMatched / req : 1;
      const optRatio = opt ? optMatched / opt : 0;
      const confidence = requiredCovered
        ? Math.round((0.7 + 0.3 * optRatio) * 100) / 100
        : Math.round(0.3 * reqRatio * 100) / 100;
      return {
        key: t.key,
        label: t.label,
        description: t.description,
        score: reqMatched * 2 + optMatched,
        confidence,
        requiredCovered,
        matchedFields: matched,
      };
    })
    .sort((a, b) => b.confidence - a.confidence || b.score - a.score);
}
