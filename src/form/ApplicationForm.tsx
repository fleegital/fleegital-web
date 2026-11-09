import type { CSSProperties } from "react";
import { useApplicationForm } from "./useApplicationForm.js";
import type { EventSink, FleegitalOptions, IntakeAnswer, IntakeFieldDef } from "../shared/client.js";

/**
 * The parts of the form you can put a class on.
 *
 * Every element already carries a stable `fga-…` class, so a stylesheet of
 * your own is enough and this is only for CSS-in-JS and utility frameworks
 * where a generated class name has to be passed in.
 */
export interface ApplicationFormClassNames {
  form?: string;
  title?: string;
  field?: string;
  label?: string;
  required?: string;
  help?: string;
  error?: string;
  input?: string;
  textarea?: string;
  select?: string;
  options?: string;
  option?: string;
  checkbox?: string;
  consent?: string;
  alert?: string;
  submit?: string;
  message?: string;
}

export interface ApplicationFormProps extends FleegitalOptions {
  /** Pass what `createAnalytics()` returned to record the funnel steps. */
  analytics?: EventSink;
  /** Called once the server has accepted the submission. */
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  /** Put your own class on the <form>; the package ships no stylesheet. */
  className?: string;
  /** A class for each part, on top of the `fga-…` ones. */
  classNames?: ApplicationFormClassNames;
  submitLabel?: string;
  /** Wording while the form loads, and for a field that is not required. */
  loadingLabel?: string;
  optionalLabel?: string;
}

/*
 * A plain, unstyled form. It carries no CSS of its own beyond what is needed to
 * hide the spam trap, because a carrier's site has its own design and a package
 * that arrives with opinions about colour is a package they fight. What it does
 * carry is a stable class on every element, so your own CSS can own the look
 * without copying the markup.
 *
 * Which fields it shows is not a decision taken here or in your code: it is the
 * form configured in Fleegital, served with the rest of the config. That is
 * what makes "a field you can ask for is a field that reaches the driver's
 * record" true — a field invented on the page would reach nothing, and a form
 * missing the spam trap would catch nothing.
 */
const HIDDEN: CSSProperties = {
  position: "absolute",
  left: "-10000px",
  width: 1,
  height: 1,
  overflow: "hidden",
};

const cx = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ") || undefined;

export function ApplicationForm(props: ApplicationFormProps) {
  const {
    publishableKey, origin, analytics, onSuccess, onError,
    className, classNames: cn = {}, submitLabel,
    loadingLabel = "Loading…", optionalLabel = "optional",
  } = props;
  const f = useApplicationForm({ publishableKey, origin, analytics });

  if (f.state === "loading") return <p className={cx("fga-loading", cn.message)}>{loadingLabel}</p>;
  if (f.state === "error" && !f.config) {
    return <p className={cx("fga-error", cn.error)}>{f.error ?? "This form is unavailable."}</p>;
  }
  if (f.state === "sent") return <p className={cx("fga-sent", cn.message)}>{f.message}</p>;

  const field = (d: IntakeFieldDef) => {
    const id = `fga-${d.code}`;
    // Two classes nothing in this file acts on, for your stylesheet to act on:
    // which field this is, and how wide the carrier made it. Both come from
    // Fleegital, so a rule written against them survives a field being moved —
    // a rule written against position does not.
    const w = `fga-code-${d.code} fga-width-${d.width === "half" ? "half" : "full"}`;
    const errs = f.errors[d.code] ?? [];
    const value: IntakeAnswer = f.values[d.code] ?? (d.inputType === "checkbox" ? false : d.inputType === "multiselect" ? [] : "");
    const described = [d.helpText ? `${id}-help` : null, errs.length ? `${id}-error` : null].filter(Boolean).join(" ");
    const common = {
      id,
      name: d.code,
      required: d.required,
      "aria-invalid": errs.length > 0 || undefined,
      "aria-describedby": described || undefined,
    };
    const help = d.helpText
      ? <p id={`${id}-help`} className={cx("fga-help", cn.help)}>{d.helpText}</p>
      : null;
    const error = errs.length > 0
      ? <p id={`${id}-error`} className={cx("fga-error", cn.error)}>{errs[0]}</p>
      : null;
    const label = (
      <label htmlFor={id} className={cx("fga-label", cn.label)}>
        {d.label}
        {!d.required && <span className={cx("fga-optional", cn.required)}> ({optionalLabel})</span>}
      </label>
    );

    if (d.inputType === "checkbox") {
      return (
        <div key={d.code} className={cx("fga-field", "fga-field-checkbox", w, cn.field)}>
          <input {...common} type="checkbox" className={cx("fga-checkbox", cn.checkbox)}
            checked={value === true}
            onChange={(e) => f.setValue(d.code, e.target.checked)} />
          <label htmlFor={id} className={cx("fga-label", cn.label)}>{d.label}</label>
          {help}{error}
        </div>
      );
    }

    if (d.inputType === "select") {
      return (
        <div key={d.code} className={cx("fga-field", "fga-field-select", w, cn.field)}>
          {label}
          <select {...common} className={cx("fga-select", cn.select)}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => f.setValue(d.code, e.target.value)}>
            <option value="">—</option>
            {(d.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {help}{error}
        </div>
      );
    }

    if (d.inputType === "multiselect") {
      const picked = Array.isArray(value) ? value : [];
      return (
        <div key={d.code} className={cx("fga-field", "fga-field-multiselect", w, cn.field)}>
          <span className={cx("fga-label", cn.label)}>
            {d.label}
            {!d.required && <span className={cx("fga-optional", cn.required)}> ({optionalLabel})</span>}
          </span>
          <div className={cx("fga-options", cn.options)} role="group" aria-label={d.label}>
            {(d.options ?? []).map((o) => (
              <label key={o.value} className={cx("fga-option", cn.option)}>
                <input type="checkbox" className={cx("fga-checkbox", cn.checkbox)}
                  name={d.code} value={o.value} checked={picked.includes(o.value)}
                  onChange={(e) => f.setValue(d.code, e.target.checked
                    ? [...picked, o.value]
                    : picked.filter((p) => p !== o.value))} />
                {o.label}
              </label>
            ))}
          </div>
          {help}{error}
        </div>
      );
    }

    if (d.inputType === "textarea") {
      return (
        <div key={d.code} className={cx("fga-field", "fga-field-textarea", w, cn.field)}>
          {label}
          <textarea {...common} className={cx("fga-textarea", cn.textarea)} rows={3}
            maxLength={d.maxLength ?? undefined}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => f.setValue(d.code, e.target.value)} />
          {help}{error}
        </div>
      );
    }

    // text, email, tel, number, date. `number` is sent as a typed text input:
    // a spinner on "years driving" invites 1e3, and the server reads digits.
    return (
      <div key={d.code} className={cx("fga-field", `fga-field-${d.inputType}`, w, cn.field)}>
        {label}
        <input {...common} className={cx("fga-input", cn.input)}
          type={d.inputType === "number" ? "text" : d.inputType}
          inputMode={d.inputType === "number" ? "numeric" : undefined}
          maxLength={d.maxLength ?? (d.inputType === "number" ? 2 : undefined)}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => f.setValue(d.code, e.target.value)} />
        {help}{error}
      </div>
    );
  };

  return (
    <form
      className={cx("fga-form", className, cn.form)}
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
      {f.config?.companyName && (
        <h3 className={cx("fga-title", cn.title)}>Drive for {f.config.companyName}</h3>
      )}

      {f.fields.map(field)}

      {/* A field no person sees. Anything in it came from a bot. It is part of
          the form rather than something your markup has to remember. */}
      <input {...f.honeypotProps} tabIndex={-1} autoComplete="off" aria-hidden="true" style={HIDDEN} />

      <div className={cx("fga-field", "fga-consent", cn.consent)}>
        <input
          id="fga-consent"
          type="checkbox"
          className={cx("fga-checkbox", cn.checkbox)}
          checked={f.consentGranted}
          onChange={(e) => f.setConsentGranted(e.target.checked)}
        />
        <label htmlFor="fga-consent" className={cx("fga-label", cn.label)}>{f.config?.consentText}</label>
      </div>

      {f.error && (
        <p role="alert" className={cx("fga-alert", cn.alert)}>
          {f.stale ? "This form has been updated. Please reload the page and try again." : f.error}
        </p>
      )}

      <button type="submit" className={cx("fga-submit", cn.submit)}
        disabled={f.state === "sending" || f.incomplete}>
        {f.state === "sending" ? "Sending…" : (submitLabel ?? "Apply")}
      </button>
    </form>
  );
}
