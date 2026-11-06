import {
  sendEvents,
  MAX_BATCH,
  type AnalyticsEvent,
  type AnalyticsEventName,
  type FleegitalOptions,
} from "../shared/client.js";
import { visitorId } from "../shared/visitor.js";
import { sessionId, visitUtm } from "../shared/session.js";
import { device } from "../shared/device.js";

export interface AnalyticsOptions extends FleegitalOptions {
  /**
   * Record a page view on load and on every SPA route change. Default true.
   * Turn it off to call `pageView()` yourself from your router.
   */
  autoPageViews?: boolean;
  /** How long events wait to be batched, in milliseconds. Default 3000. */
  flushInterval?: number;
}

export interface Analytics {
  /** Records a page view. Defaults to the current path. */
  pageView: (path?: string) => void;
  /** Records one of the funnel events. */
  track: (event: AnalyticsEventName, path?: string) => void;
  /** Sends whatever is queued now, rather than waiting for the timer. */
  flush: () => void;
  /** Stops listening and sends what is left. */
  stop: () => void;
}

/**
 * The queue is bounded. A tab left open for a day with no network should cost
 * a fixed amount of memory, not a growing one. Past the cap the oldest events
 * go, because what someone is doing now is worth more than what they did an
 * hour ago on a page that never reported.
 */
const MAX_QUEUED = 200;

const noop: Analytics = {
  pageView: () => {},
  track: () => {},
  flush: () => {},
  stop: () => {},
};

function currentPath(): string {
  try {
    return window.location.pathname + window.location.search;
  } catch {
    return "/";
  }
}

/** The referring host, but only when it is somebody else's. */
function referrerHost(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const u = new URL(document.referrer);
    if (u.host === window.location.host) return undefined;
    return u.host;
  } catch {
    return undefined;
  }
}

/**
 * Starts collecting. Returns a no-op on the server, so importing this in a
 * framework that renders on the server costs nothing and breaks nothing.
 *
 * Nothing here throws into the host page. A carrier's careers site must not
 * go down because a page view could not be counted.
 */
export function createAnalytics(options: AnalyticsOptions): Analytics {
  if (typeof window === "undefined" || typeof document === "undefined") return noop;

  const { publishableKey, origin } = options;
  const interval = Math.max(500, options.flushInterval ?? 3000);
  const auto = options.autoPageViews ?? true;

  let queue: AnalyticsEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const send = (keepalive: boolean) => {
    if (queue.length === 0) return;
    const batch = queue.slice(0, MAX_BATCH);
    queue = queue.slice(MAX_BATCH);
    // Deliberately not awaited: the caller is a click or a navigation.
    void sendEvents({ publishableKey, origin }, batch, keepalive);
  };

  const schedule = () => {
    if (timer !== undefined || stopped) return;
    timer = setTimeout(() => {
      timer = undefined;
      send(false);
    }, interval);
  };

  const push = (event: AnalyticsEventName, path?: string) => {
    if (stopped) return;
    const vid = visitorId();
    // No id, no event: the server requires one, and an event that cannot be
    // tied to a visit cannot be counted as a visitor either.
    if (!vid) return;
    const utm = visitUtm();
    queue.push({
      event_name: event,
      path: (path ?? currentPath()).slice(0, 400),
      visitor_id: vid,
      session_id: sessionId(),
      referrer_host: referrerHost(),
      device: device(),
      utm: Object.keys(utm).length > 0 ? (utm as Record<string, string>) : undefined,
      occurred_at: new Date().toISOString(),
    });
    if (queue.length > MAX_QUEUED) queue = queue.slice(queue.length - MAX_QUEUED);
    schedule();
  };

  // A tab being hidden is the last reliable moment to send. pagehide is the
  // backstop for browsers that go straight there, and both can fire, which is
  // harmless: the queue is emptied as it is read.
  const onHide = () => {
    if (document.visibilityState === "hidden") send(true);
  };
  const onPageHide = () => send(true);
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);

  // SPA navigation. pushState and replaceState fire no event of their own, so
  // they are wrapped; popstate covers the back button. Both are put back as
  // they were on stop(), so an app that mounts and unmounts does not stack
  // wrappers.
  const origPush = window.history.pushState;
  const origReplace = window.history.replaceState;
  const onPop = () => push("page_view");

  if (auto) {
    const wrap = (fn: typeof origPush) =>
      function (this: History, ...args: Parameters<typeof origPush>) {
        const r = fn.apply(this, args);
        // After the URL has changed, not before.
        push("page_view");
        return r;
      };
    try {
      window.history.pushState = wrap(origPush);
      window.history.replaceState = wrap(origReplace);
      window.addEventListener("popstate", onPop);
    } catch {
      /* a page that froze history keeps manual pageView() */
    }
    push("page_view");
  }

  return {
    pageView: (path?: string) => push("page_view", path),
    track: (event: AnalyticsEventName, path?: string) => push(event, path),
    flush: () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      send(false);
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      if (auto) {
        try {
          window.history.pushState = origPush;
          window.history.replaceState = origReplace;
          window.removeEventListener("popstate", onPop);
        } catch {
          /* nothing to put back */
        }
      }
      send(true);
    },
  };
}
