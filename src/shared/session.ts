/**
 * Per-visit state: a session id, and the campaign the visit arrived on.
 *
 * sessionStorage, not localStorage: this is meant to end when the tab does.
 * Every access is guarded for the same reason as visitor.ts — in a private
 * window or with site data blocked the accessor itself throws, and analytics
 * must never be the reason a carrier's page breaks.
 *
 * The campaign is remembered for the whole visit rather than read fresh on
 * each page. A visitor who arrives from an ad and then reads three pages
 * should count as three pages for that campaign; reading the URL each time
 * would credit the landing page and lose the rest.
 */
const SESSION_KEY = "fga_sid";
const UTM_KEY = "fga_utm";

/** The five tags the server stores. Anything else in the URL is ignored. */
export const UTM_PARAMS = ["source", "medium", "campaign", "content", "term"] as const;
export type Utm = Partial<Record<(typeof UTM_PARAMS)[number], string>>;

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* storage is closed; the visit simply carries no id */
  }
}

function makeId(): string {
  const bytes = new Uint8Array(12);
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = "s";
  for (const b of bytes) out += b.toString(36).padStart(2, "0");
  return out.slice(0, 32);
}

/** The id for this visit, creating one on first use. */
export function sessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const found = read(SESSION_KEY);
  if (found) return found;
  const created = makeId();
  write(SESSION_KEY, created);
  return created;
}

/**
 * The campaign this visit arrived on: taken from the URL the first time any
 * utm_* parameter appears, and kept for the rest of the visit.
 */
export function visitUtm(): Utm {
  if (typeof window === "undefined") return {};
  let fromUrl: Utm = {};
  try {
    const q = new URLSearchParams(window.location.search);
    for (const p of UTM_PARAMS) {
      const v = q.get("utm_" + p);
      if (v) fromUrl[p] = v.slice(0, 200);
    }
  } catch {
    fromUrl = {};
  }
  if (Object.keys(fromUrl).length > 0) {
    write(UTM_KEY, JSON.stringify(fromUrl));
    return fromUrl;
  }
  const stored = read(UTM_KEY);
  if (!stored) return {};
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Utm = {};
    for (const p of UTM_PARAMS) {
      const v = (parsed as Record<string, unknown>)[p];
      if (typeof v === "string" && v) out[p] = v;
    }
    return out;
  } catch {
    return {};
  }
}
