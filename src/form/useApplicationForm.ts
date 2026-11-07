import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchIntakeConfig,
  submitApplication,
  IntakeError,
  emptyAnswer,
  isBlank,
  type ApplicationValues,
  type FieldErrors,
  type EventSink,
  type FleegitalOptions,
  type IntakeAnswer,
  type IntakeConfig,
  type IntakeFieldDef,
} from "../shared/client.js";
import { visitorId } from "../shared/visitor.js";

export type FormState = "loading" | "ready" | "sending" | "sent" | "error";

/** One shared empty array, so `fields` keeps its identity between renders. */
const EMPTY_FIELDS: IntakeFieldDef[] = [];

export interface UseApplicationFormOptions extends FleegitalOptions {
  /**
   * Where to report the three funnel steps: the form became usable, the
   * applicant typed something, the application was accepted. Pass the object
   * `createAnalytics()` returned. Without it the form reports nothing, and
   * the funnel columns in Fleegital stay empty — the page view is recorded
   * either way, by the analytics package, but a page view is not an attempt.
   */
  analytics?: EventSink;
}

/** The result of one submission, carrying the reason when it failed. */
export type SubmitOutcome =
  | { ok: true; message: string }
  | { ok: false; error: string; fields?: FieldErrors; stale: boolean };

export interface UseApplicationForm {
  /** Null until the company's wording and branding have loaded. */
  config: IntakeConfig | null;
  /**
   * The form the carrier configured in Fleegital, in display order. Empty
   * until the config has loaded. This is the only field list there is: the
   * package does not carry one.
   */
  fields: IntakeFieldDef[];
  state: FormState;
  /** The answers so far, keyed by `field.code`. */
  values: ApplicationValues;
  setValue: (code: string, value: IntakeAnswer) => void;
  /** True while a required field is still unanswered. */
  incomplete: boolean;
  consentGranted: boolean;
  setConsentGranted: (granted: boolean) => void;
  /** Per-field messages from the server, cleared as soon as the field changes. */
  errors: FieldErrors;
  /** Whole-form message: a network failure, or the wording having changed. */
  error: string | null;
  /** True when the consent wording changed and the page must be reloaded. */
  stale: boolean;
  /** The server's own thank-you wording, once sent. */
  message: string | null;
  /**
   * Returns what happened. The outcome is returned rather than only put in
   * state because a caller that awaits this and then reads `state` reads the
   * render it started from, not the one the submission produced.
   */
  submit: () => Promise<SubmitOutcome>;
  /** Bind to a field no person can see; a value in it means a bot filled it. */
  honeypotProps: { name: string; value: string; onChange: (e: { target: { value: string } }) => void };
}

/**
 * The form without any markup, for carriers who want their own.
 * `ApplicationForm` is this hook plus a plain, unstyled layout.
 */
export function useApplicationForm(options: UseApplicationFormOptions): UseApplicationForm {
  const { publishableKey, origin, analytics } = options;
  const [config, setConfig] = useState<IntakeConfig | null>(null);
  const [state, setState] = useState<FormState>("loading");
  const [values, setValues] = useState<ApplicationValues>({});
  const [consentGranted, setConsentGranted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const honeypot = useRef("");
  // Each step is reported once per mounted form. A re-render is not a new
  // attempt, and a second keystroke is not a second start.
  const reported = useRef({ view: false, start: false });
  // Held in a ref so that passing a fresh object every render — which a
  // caller doing `analytics={createAnalytics(...)}` inline would — does not
  // re-run the effect below and report the form as viewed again.
  const sink = useRef<EventSink | undefined>(analytics);
  sink.current = analytics;

  useEffect(() => {
    const ac = new AbortController();
    setState("loading");
    fetchIntakeConfig({ publishableKey, origin }, ac.signal)
      .then((cfg) => {
        setConfig(cfg);
        // Start every configured field at its empty value, so a controlled
        // input never flips from uncontrolled on the first keystroke.
        setValues(Object.fromEntries(cfg.fields.map((f) => [f.code, emptyAnswer(f)])));
        setState("ready");
        // Reported here rather than on mount: until the company's wording has
        // loaded there is no form to have seen, only a spinner.
        if (!reported.current.view) {
          reported.current.view = true;
          sink.current?.track("form_view");
        }
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : "This form is unavailable.");
        setState("error");
      });
    return () => ac.abort();
  }, [publishableKey, origin]);

  const setValue = useCallback<UseApplicationForm["setValue"]>((code, value) => {
    if (!reported.current.start) {
      reported.current.start = true;
      sink.current?.track("form_start");
    }
    setValues((v) => ({ ...v, [code]: value }));
    // A message about what the applicant just changed is already out of date.
    setErrors((e) => (e[code] ? { ...e, [code]: [] } : e));
  }, []);

  const fields = config?.fields ?? EMPTY_FIELDS;
  // Only so a caller can disable its own button. The endpoint checks again,
  // because a page is not where a rule is enforced.
  const incomplete = useMemo(
    () => fields.some((f) => f.required && isBlank(f, values[f.code])),
    [fields, values],
  );

  const submit = useCallback(async (): Promise<SubmitOutcome> => {
    if (!config) return { ok: false, error: "This form is not ready yet.", stale: false };
    if (state === "sending") return { ok: false, error: "Already sending.", stale: false };
    setState("sending");
    setError(null);
    setErrors({});
    try {
      const res = await submitApplication({
        publishableKey,
        origin,
        values,
        consentGranted,
        consentVersion: config.consentVersion,
        fieldsVersion: config.fieldsVersion,
        visitorId: visitorId(),
        honeypot: honeypot.current,
        });
      setMessage(res.message);
      setState("sent");
      // Only on acceptance. A rejected submission is not a submission, and
      // counting it would make the funnel wider at the bottom than the top.
      sink.current?.track("form_submit");
      return { ok: true, message: res.message };
    } catch (e: unknown) {
      setState("ready");
      if (e instanceof IntakeError) {
        if (e.fields) setErrors(e.fields);
        setStale(e.stale);
        setError(e.message);
        return e.fields
          ? { ok: false, error: e.message, fields: e.fields, stale: e.stale }
          : { ok: false, error: e.message, stale: e.stale };
      }
      const msg = "Something went wrong. Please try again.";
      setError(msg);
      return { ok: false, error: msg, stale: false };
    }
  }, [config, state, publishableKey, origin, values, consentGranted]);

  const honeypotProps = useMemo(
    () => ({
      name: "company_website",
      value: honeypot.current,
      onChange: (e: { target: { value: string } }) => {
        honeypot.current = e.target.value;
      },
    }),
    [],
  );

  return {
    config, fields, state, values, setValue, incomplete,
    consentGranted, setConsentGranted,
    errors, error, stale, message, submit, honeypotProps,
  };
}
