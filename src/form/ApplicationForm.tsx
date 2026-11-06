import type { CSSProperties } from "react";
import { useApplicationForm } from "./useApplicationForm.js";
import type { ApplicationValues, EventSink, FleegitalOptions } from "../shared/client.js";

/** Fields a carrier can ask for, in the order they are shown. */
export type FieldName = keyof ApplicationValues;

const DEFAULT_FIELDS: FieldName[] = ["first_name", "last_name", "phone", "email", "cdl_class", "experience_years"];

const DEFAULT_LABELS: Record<FieldName, string> = {
  first_name: "First name",
  last_name: "Last name",
  phone: "Mobile phone",
  email: "Email",
  cdl_class: "CDL class",
  experience_years: "Years driving",
  position: "Position",
  location: "Location",
  notes: "Anything else",
};

const REQUIRED: FieldName[] = ["first_name", "phone"];

export interface ApplicationFormProps extends FleegitalOptions {
  /** Pass what `createAnalytics()` returned to record the funnel steps. */
  analytics?: EventSink;
  fields?: FieldName[];
  labels?: Partial<Record<FieldName, string>>;
  /** Called once the server has accepted the submission. */
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  /** Put your own class on the <form>; the package ships no stylesheet. */
  className?: string;
  submitLabel?: string;
}

/*
 * A plain, unstyled form. It carries no CSS of its own beyond what is needed to
 * hide the spam trap, because a carrier's site has its own design and a package
 * that arrives with opinions about colour is a package they fight. Anyone who
 * wants a different layout uses `useApplicationForm` and writes their own.
 */
const HIDDEN: CSSProperties = {
  position: "absolute",
  left: "-10000px",
  width: 1,
  height: 1,
  overflow: "hidden",
};

export function ApplicationForm(props: ApplicationFormProps) {
  const { publishableKey, origin, analytics, fields = DEFAULT_FIELDS, labels, onSuccess, onError, className, submitLabel } = props;
  const f = useApplicationForm({ publishableKey, origin, analytics });

  if (f.state === "loading") return <p>Loading…</p>;
  if (f.state === "error" && !f.config) return <p>{f.error ?? "This form is unavailable."}</p>;
  if (f.state === "sent") return <p>{f.message}</p>;

  const label = (name: FieldName) => labels?.[name] ?? DEFAULT_LABELS[name];

  return (
    <form
      className={className}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void f.submit().then((res) => {
          // From the returned value, not from `f`: the state read here would be
          // the one this render closed over, before the submission ran — and it
          // carries the real reason, so a caller can tell a rejected field from
          // a refused origin.
          if (res.ok) onSuccess?.(res.message);
          else onError?.(res.error);
        });
      }}
    >
      {f.config?.companyName && <h3>Drive for {f.config.companyName}</h3>}

      {fields.map((name) => {
        const id = `fga-${name}`;
        const fieldErrors = f.errors[name] ?? [];
        return (
          <div key={name}>
            <label htmlFor={id}>
              {label(name)}
              {REQUIRED.includes(name) ? " *" : ""}
            </label>
            <input
              id={id}
              name={name}
              type={name === "email" ? "email" : name === "phone" ? "tel" : "text"}
              value={f.values[name] ?? ""}
              required={REQUIRED.includes(name)}
              aria-invalid={fieldErrors.length > 0 || undefined}
              aria-describedby={fieldErrors.length > 0 ? `${id}-error` : undefined}
              onChange={(e) => f.setValue(name, e.target.value)}
            />
            {fieldErrors.length > 0 && <p id={`${id}-error`}>{fieldErrors[0]}</p>}
          </div>
        );
      })}

      {/* A field no person sees. Anything in it came from a bot. */}
      <input {...f.honeypotProps} tabIndex={-1} autoComplete="off" aria-hidden="true" style={HIDDEN} />

      <div>
        <input
          id="fga-consent"
          type="checkbox"
          checked={f.consentGranted}
          onChange={(e) => f.setConsentGranted(e.target.checked)}
        />
        <label htmlFor="fga-consent">{f.config?.consentText}</label>
      </div>

      {f.error && <p role="alert">{f.stale ? "This form has been updated. Please reload the page and try again." : f.error}</p>}

      <button type="submit" disabled={f.state === "sending"}>
        {f.state === "sending" ? "Sending…" : (submitLabel ?? "Apply")}
      </button>
    </form>
  );
}
