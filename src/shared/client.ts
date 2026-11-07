/**
 * Everything the package knows about reaching Fleegital.
 *
 * One rule shapes this file: a carrier's developer only ever sees our own
 * domain. The backend host is never printed, never configurable by accident,
 * and never reachable from a carrier page — `origin` exists for local
 * development and for carriers we put behind their own apply subdomain.
 */

/** Where the intake endpoint lives unless the caller says otherwise. */
export const DEFAULT_ORIGIN = "https://www.fleegital.app";

/**
 * The door this package submits through. It is checked exactly like the script
 * tag — same publishable key, same origin allowlist — and named apart so the
 * Website applications screen can show how many carriers installed the package.
 */
export const DOOR = "npm" as const;

export interface FleegitalOptions {
  /** `pk_…`, from Settings → Recruiting configuration → Website applications. */
  publishableKey: string;
  /** Override only for local development or a carrier-specific apply domain. */
  origin?: string;
}

/**
 * One field of the application form, as the carrier configured it in
 * Fleegital. The list is served with the rest of the config, which is why this
 * package carries no field list of its own: a field that exists here is a
 * field that reaches the driver's record, and a field that does not exist
 * cannot be invented on the page and silently dropped.
 */
export interface IntakeFieldDef {
  /** The name to send it under. Also the key in `values`. */
  code: string;
  inputType:
    | "text" | "email" | "tel" | "number" | "date"
    | "select" | "multiselect" | "checkbox" | "textarea";
  label: string;
  helpText: string | null;
  required: boolean;
  maxLength: number | null;
  /** For select and multiselect: what to show, and what to store. */
  options: { value: string; label: string }[] | null;
}

/** What one field can hold: text, a set of choices, or yes/no. */
export type IntakeAnswer = string | string[] | boolean;

/** What the form needs from the server before it can render. */
export interface IntakeConfig {
  companyName: string | null;
  consentText: string;
  /** Echoed back on submit; a mismatch means the wording changed under us. */
  consentVersion: string;
  primaryColor: string | null;
  /** Already rewritten to our own domain by the server. */
  logoUrl: string | null;
  /** The form, in display order, exactly as configured in Fleegital. */
  fields: IntakeFieldDef[];
  /** Echoed back on submit; a mismatch means the form changed under us. */
  fieldsVersion: string;
}

/** The value a field starts at before anyone has touched it. */
export function emptyAnswer(field: IntakeFieldDef): IntakeAnswer {
  if (field.inputType === "checkbox") return false;
  if (field.inputType === "multiselect") return [];
  return "";
}

/** True when a required field has not been answered. */
export function isBlank(field: IntakeFieldDef, value: IntakeAnswer | undefined): boolean {
  if (field.inputType === "checkbox") return value !== true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value ?? "").trim() === "";
}

/** A field-level rejection, as the endpoint reports it. */
export type FieldErrors = Record<string, string[]>;

export class IntakeError extends Error {
  readonly status: number;
  readonly fields: FieldErrors | undefined;
  /** True when the form must be reloaded: the consent wording changed. */
  readonly stale: boolean;
  constructor(message: string, status: number, fields?: FieldErrors) {
    super(message);
    this.name = "IntakeError";
    this.status = status;
    this.fields = fields;
    this.stale = status === 409;
  }
}

const endpoint = (origin?: string) => `${(origin ?? DEFAULT_ORIGIN).replace(/\/+$/, "")}/api/intake`;

async function readError(res: Response): Promise<IntakeError> {
  let body: { error?: string; fields?: FieldErrors } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* a proxy or a network device answered instead of the API */
  }
  const first = body.fields && Object.values(body.fields)[0]?.[0];
  return new IntakeError(first ?? body.error ?? "The application could not be sent.", res.status, body.fields);
}

/** Reads the company name, consent wording and brand colour for a key. */
export async function fetchIntakeConfig(
  options: FleegitalOptions,
  signal?: AbortSignal,
): Promise<IntakeConfig> {
  const res = await fetch(`${endpoint(options.origin)}?key=${encodeURIComponent(options.publishableKey)}`, {
    signal,
  });
  if (!res.ok) throw await readError(res);
  const cfg = (await res.json()) as Record<string, unknown>;
  const raw = Array.isArray(cfg.fields) ? (cfg.fields as Record<string, unknown>[]) : [];
  return {
    companyName: (cfg.company_name as string | null) ?? null,
    consentText: String(cfg.consent_text ?? ""),
    consentVersion: String(cfg.consent_version ?? ""),
    primaryColor: (cfg.primary_color as string | null) ?? null,
    logoUrl: (cfg.logo_url as string | null) ?? null,
    fields: raw.map((f) => ({
      code: String(f.code),
      inputType: (f.input_type as IntakeFieldDef["inputType"]) ?? "text",
      label: String(f.label ?? f.code),
      helpText: (f.help_text as string | null) ?? null,
      required: f.required === true,
      maxLength: typeof f.max_length === "number" ? f.max_length : null,
      options: Array.isArray(f.options)
        ? (f.options as { value: string; label: string }[])
        : null,
    })),
    fieldsVersion: String(cfg.fields_version ?? ""),
  };
}

/**
 * The answers one applicant gave, keyed by field code.
 *
 * Deliberately not a fixed set of names. Which fields exist is the carrier's
 * decision, taken in Fleegital, and `config.fields` says what they are — a
 * name written in here would be a name that can drift from the form.
 */
export type ApplicationValues = Record<string, IntakeAnswer>;

/**
 * What the endpoint tells a carrier's page, which is deliberately very little.
 *
 * There is no lead id and no outcome here, and that is on purpose: an accepted
 * application, one held for review, and one that tripped the spam trap all get
 * the same answer, so a submitter cannot learn which happened. Anything a
 * recruiter needs is in the app.
 */
export interface SubmitResult {
  /** The wording to show the applicant, as the server phrased it. */
  message: string;
}

export interface SubmitArgs extends FleegitalOptions {
  values: ApplicationValues;
  consentGranted: boolean;
  consentVersion: string;
  /** Echoed from the config, so a page open while the form changed is told. */
  fieldsVersion?: string;
  /** Anonymous first-party id, so the lead can be traced to the first visit. */
  visitorId?: string | undefined;
  /** Spam trap: the value of a field a person never sees. Must stay empty. */
  honeypot?: string;
  pageUrl?: string;
  signal?: AbortSignal;
}

export async function submitApplication(args: SubmitArgs): Promise<SubmitResult> {
  const res = await fetch(endpoint(args.origin), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-fleegital-key": args.publishableKey },
    signal: args.signal,
    body: JSON.stringify({
      door: DOOR,
      page_url: args.pageUrl ?? (typeof location === "undefined" ? undefined : location.href),
      company_website: args.honeypot ?? "",
      visitor_id: args.visitorId,
      fields_version: args.fieldsVersion,
      consent: { granted: args.consentGranted, version: args.consentVersion },
      ...args.values,
    }),
  });
  if (!res.ok) throw await readError(res);
  const body = (await res.json()) as { message?: string };
  return { message: body.message ?? "Thank you. Your application was received." };
}

/* ------------------------------------------------------------------ *
 * Analytics transport
 * ------------------------------------------------------------------ */

/** The four names the server counts. A fifth would be stored and never read. */
export const ANALYTICS_EVENTS = ["page_view", "form_view", "form_start", "form_submit"] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/**
 * Somewhere to report a funnel event. `Analytics` satisfies it structurally,
 * so the form can report into it without importing the analytics module —
 * a carrier who only installs the form ships none of the analytics code.
 */
export interface EventSink {
  track: (event: AnalyticsEventName, path?: string) => void;
}

/** One event, in the shape the endpoint reads. */
export interface AnalyticsEvent {
  event_name: AnalyticsEventName;
  path: string;
  visitor_id: string;
  session_id?: string | undefined;
  referrer_host?: string | undefined;
  device?: string | undefined;
  utm?: Record<string, string> | undefined;
  /** ISO 8601. The server clamps it into the last two days. */
  occurred_at: string;
}

/** The server's answer, which says nothing a caller can act on. */
export interface SendEventsResult {
  accepted: number;
  dropped: number;
}

/** The endpoint accepts at most this many events in one request. */
export const MAX_BATCH = 50;

const analyticsEndpoint = (origin?: string) =>
  `${(origin ?? DEFAULT_ORIGIN).replace(/\/+$/, "")}/api/analytics`;

/**
 * Sends a batch. Never throws and never rejects: a page view is not worth
 * breaking, retrying or logging on someone else's website, and the endpoint
 * answers 202 for every outcome anyway, so there is nothing to branch on.
 *
 * `keepalive` lets the request outlive the page, which is the whole point
 * when a tab is closing. sendBeacon would be the other way, but it cannot
 * set the key header, and moving the key into the URL to suit it would put
 * it in every proxy log for no gain.
 */
export async function sendEvents(
  options: FleegitalOptions,
  events: AnalyticsEvent[],
  keepalive = false,
): Promise<SendEventsResult | undefined> {
  if (events.length === 0) return { accepted: 0, dropped: 0 };
  try {
    const res = await fetch(analyticsEndpoint(options.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-fleegital-key": options.publishableKey },
      body: JSON.stringify({ events: events.slice(0, MAX_BATCH) }),
      keepalive,
    });
    const body = (await res.json()) as Partial<SendEventsResult>;
    return { accepted: body.accepted ?? 0, dropped: body.dropped ?? 0 };
  } catch {
    return undefined;
  }
}
