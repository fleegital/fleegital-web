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

/** What the form needs from the server before it can render. */
export interface IntakeConfig {
  companyName: string | null;
  consentText: string;
  /** Echoed back on submit; a mismatch means the wording changed under us. */
  consentVersion: string;
  primaryColor: string | null;
  /** Already rewritten to our own domain by the server. */
  logoUrl: string | null;
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
  return {
    companyName: (cfg.company_name as string | null) ?? null,
    consentText: String(cfg.consent_text ?? ""),
    consentVersion: String(cfg.consent_version ?? ""),
    primaryColor: (cfg.primary_color as string | null) ?? null,
    logoUrl: (cfg.logo_url as string | null) ?? null,
  };
}

/** The answers one applicant gave. Every field is optional but first name. */
export interface ApplicationValues {
  first_name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  cdl_class?: string;
  experience_years?: string;
  position?: string;
  location?: string;
  notes?: string;
}

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
      consent: { granted: args.consentGranted, version: args.consentVersion },
      ...args.values,
    }),
  });
  if (!res.ok) throw await readError(res);
  const body = (await res.json()) as { message?: string };
  return { message: body.message ?? "Thank you. Your application was received." };
}
