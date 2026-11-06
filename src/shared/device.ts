/**
 * Which of the three kinds of device this is, or nothing.
 *
 * The server accepts only `mobile`, `tablet` and `desktop` and drops anything
 * else, so guessing wrongly costs the field rather than the event. Returning
 * undefined is a fine answer and better than a confident wrong one.
 *
 * Deliberately not a user-agent parsing library: those are large, need
 * constant updating, and are a fingerprinting surface. This asks the browser
 * where the browser will say, and falls back to two coarse patterns.
 */
export type Device = "mobile" | "tablet" | "desktop";

interface UaData {
  mobile?: boolean;
}

export function device(): Device | undefined {
  if (typeof navigator === "undefined") return undefined;
  try {
    const ua = navigator.userAgent || "";

    // iPadOS reports itself as a Mac; the touch points give it away.
    const iPad = /iPad/.test(ua) ||
      (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1);
    if (iPad) return "tablet";

    // Android puts "Mobile" in the string for phones and leaves it out for tablets.
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? "mobile" : "tablet";

    // Named devices before the coarse signal. `userAgentData.mobile` is a
    // single boolean that Chromium answers from its own build, not from the
    // user-agent string, so it reports a spoofed or overridden phone as a
    // desktop — which is how this function first got an iPhone wrong.
    if (/iPhone|iPod|Windows Phone/.test(ua)) return "mobile";
    if (/Tablet|PlayBook|Silk|Kindle/.test(ua)) return "tablet";

    // Then let the browser answer where it will.
    const uaData = (navigator as unknown as { userAgentData?: UaData }).userAgentData;
    if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile ? "mobile" : "desktop";

    if (/Mobi/.test(ua)) return "mobile";
    return "desktop";
  } catch {
    return undefined;
  }
}
