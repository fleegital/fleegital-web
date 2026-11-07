# Changelog

This package runs on carriers' own websites, so a breaking change here breaks
someone else's site. Versions follow semver strictly, and anything that changes
what an existing call does gets a major.

## 0.2.0

Before 1.0 the minor is the major: this changes what existing calls do. The
upgrade is almost always a deletion.

### Changed — the form is defined in Fleegital, not in your code

The package no longer carries a list of fields. `ApplicationForm` renders the
form configured under Settings → Website applications, and `useApplicationForm`
hands you that same list. Adding a field, renaming one or making one required
is now a change in Fleegital, with no deploy.

Why: the field list existed in three places — the script tag, the hosted page
and this package — and they had drifted. Worse, a field written into a
carrier's own markup reached nothing: the endpoint stored a fixed set of names,
so anything else was dropped in silence, as a CDL class was on the first real
installation. A form could also be built without the spam trap, and nothing
said so.

- **Removed `fields` and `labels` props.** Both are now settings in Fleegital.
  Delete them; the form shows what you configured.
- **`values` is keyed by field code** (`Record<string, string | string[] |
  boolean>`) instead of a fixed set of names, and `setValue` takes a code. A
  checkbox answer is a boolean, a multiple-choice answer an array of values.
  `f.values.first_name` still reads the first name if that field is configured;
  TypeScript no longer promises it exists.
- **`FieldName` is gone**, along with the exported default labels.

### Added
- `f.fields` — the configured form: `code`, `inputType`, `label`, `helpText`,
  `required`, `maxLength`, and `options` of `{ value, label }` for the choice
  types. The value is what is stored, so a dropdown writes `A` and shows
  "Class A" rather than inventing a new spelling of a CDL class.
- `f.incomplete` — true while a required field is unanswered, for your own
  disabled button. The endpoint still checks.
- `emptyAnswer(field)` and `isBlank(field, value)`, exported for your own
  markup.
- `classNames` on `ApplicationForm`, and a stable `fga-…` class on every
  element, so a stylesheet or a utility framework can own the look. The package
  still ships no CSS.
- `config.fields` and `config.fieldsVersion`. The version is echoed on submit:
  a page left open while the form changed is told to reload instead of posting
  against a form that no longer exists, exactly as the consent wording already
  worked. `stale` on a failed submit now covers both.
- Every field is validated against its own type before anything is stored, and
  the message comes back on that field.

### Upgrading

```diff
-<ApplicationForm publishableKey="pk_…" fields={["first_name", "phone"]} labels={{ phone: "Cell" }} />
+<ApplicationForm publishableKey="pk_…" />
```

Then set the fields and their wording in Fleegital. With your own markup, map
over `f.fields` instead of naming inputs yourself — the README has the shape.

## 0.1.1

No change to the package. Published to validate the trusted publisher, which
replaces the publishing token: releases are now authenticated by the identity
of the workflow that builds them, so there is no secret to leak or rotate.

## 0.1.0

### Added
- `@fleegital/web/form`: `ApplicationForm` for a form that works out of the box,
  and `useApplicationForm` for your own markup. Deduplicates applicants across
  the whole company, records consent against the exact wording shown, carries an
  anonymous first-visit id, and catches bots with a honeypot field.

- `@fleegital/web/analytics`: `createAnalytics` for website analytics —
  automatic page views including SPA route changes, batching, a send when the
  tab is hidden, device class, and the arriving campaign carried across the
  whole visit. No cookie, no third-party script, nothing a person typed.
- `ApplicationForm` and `useApplicationForm` take an optional `analytics`, and
  report `form_view`, `form_start` and `form_submit` into it.
