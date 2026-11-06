import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchIntakeConfig,
  submitApplication,
  IntakeError,
  type ApplicationValues,
  type FieldErrors,
  type FleegitalOptions,
  type IntakeConfig,
} from "../shared/client.js";
import { visitorId } from "../shared/visitor.js";

export type FormState = "loading" | "ready" | "sending" | "sent" | "error";

/** The result of one submission, carrying the reason when it failed. */
export type SubmitOutcome =
  | { ok: true; message: string }
  | { ok: false; error: string; fields?: FieldErrors; stale: boolean };

export interface UseApplicationForm {
  /** Null until the company's wording and branding have loaded. */
  config: IntakeConfig | null;
  state: FormState;
  values: ApplicationValues;
  setValue: <K extends keyof ApplicationValues>(field: K, value: ApplicationValues[K]) => void;
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
export function useApplicationForm(options: FleegitalOptions): UseApplicationForm {
  const { publishableKey, origin } = options;
  const [config, setConfig] = useState<IntakeConfig | null>(null);
  const [state, setState] = useState<FormState>("loading");
  const [values, setValues] = useState<ApplicationValues>({ first_name: "" });
  const [consentGranted, setConsentGranted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const honeypot = useRef("");

  useEffect(() => {
    const ac = new AbortController();
    setState("loading");
    fetchIntakeConfig({ publishableKey, origin }, ac.signal)
      .then((cfg) => {
        setConfig(cfg);
        setState("ready");
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : "This form is unavailable.");
        setState("error");
      });
    return () => ac.abort();
  }, [publishableKey, origin]);

  const setValue = useCallback<UseApplicationForm["setValue"]>((field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
    // A message about what the applicant just changed is already out of date.
    setErrors((e) => (e[field as string] ? { ...e, [field as string]: [] } : e));
  }, []);

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
        visitorId: visitorId(),
        honeypot: honeypot.current,
        });
      setMessage(res.message);
      setState("sent");
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
    config, state, values, setValue, consentGranted, setConsentGranted,
    errors, error, stale, message, submit, honeypotProps,
  };
}
