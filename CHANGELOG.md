# Changelog

This package runs on carriers' own websites, so a breaking change here breaks
someone else's site. Versions follow semver strictly, and anything that changes
what an existing call does gets a major.

## 0.4.0

Additive. Importing nothing still ships no CSS.

### Added
- **`@fleegital/web/form.css`** — a form that looks finished out of the box:
  spacing, labels, fields, choices, the consent line, the button. Colourless on
  purpose — text, borders and muted text derive from whatever the page already
  sets, so it reads correctly on a light page and on a dark one with no theme
  switch. Every value is a custom property (`--fga-primary`, `--fga-radius`,
  `--fga-gap`, `--fga-border`, `--fga-danger`) so the stylesheet can be kept and
  changed rather than replaced.
- **`@fleegital/web/layout.css`** — the columns alone: a grid on the form and
  nothing else, for carriers who style the rest themselves.
- **The submit button takes the carrier's brand colour.** The component sets
  `--fga-primary` from `config.primaryColor`, which the package has fetched
  since 0.1.0 and never used. It comes from Fleegital, so it cannot drift from
  the colour the app shows.

### Why

0.3.0 shipped `fga-width-half` and no way to make it mean anything. A class is
inert until some stylesheet turns it into a column, so every carrier who wanted
two fields on a row had to write the grid themselves — and the first one who
did wrote it against positions, which is the fault 0.3.0 existed to fix. The
grid now ships as something you can import, at the level you want.

## 0.3.0

Additive: nothing you call changes, and no markup you style disappears.

### Added
- **`fga-width-half` / `fga-width-full` on every field**, from a new per-field
  setting in Fleegital. Which fields share a row is now part of the form, next
  to their order and wording, so the same pairing appears on the hosted
  application page, in the embedded script and here.

  The package still ships no CSS. One rule in yours turns it on — the README
  has it, using a container query so a form in a sidebar stays one column
  without a second breakpoint.

- **`fga-code-<code>` on every field**, so a rule can name the field it means.

  Both exist because of a real failure: a carrier styled the first four fields
  two-up with `:nth-of-type(-n+4)`, which was correct until the field editor
  shipped. Moving one field in Fleegital re-paired the columns and pushed Email
  to full width, with nobody touching the stylesheet. A rule about positions
  cannot survive a form whose order is a setting.

- `width` on `IntakeFieldDef`, for your own markup.

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
