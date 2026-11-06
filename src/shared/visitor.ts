/**
 * An anonymous id for this browser, so an application can be traced back to the
 * visit it came from.
 *
 * localStorage only: no cookie, nothing sent to a third party, and nothing that
 * identifies a person. Every read and write is guarded, because in a private
 * window or with site data blocked the accessor itself throws — and a form that
 * fails to submit is a worse outcome than a lead with no attribution. When
 * storage is unavailable the submission simply carries no id.
 */
const KEY = "fga_vid";

function make(): string {
  const bytes = new Uint8Array(12);
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = "v";
  for (const b of bytes) out += b.toString(36).padStart(2, "0");
  // The server accepts /^[A-Za-z0-9_-]{8,64}$/; this is 25 characters.
  return out.slice(0, 32);
}

/** The id for this browser, creating one on first use. Undefined if storage is closed. */
export function visitorId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const found = window.localStorage.getItem(KEY);
    if (found) return found;
    const created = make();
    window.localStorage.setItem(KEY, created);
    return created;
  } catch {
    return undefined;
  }
}
