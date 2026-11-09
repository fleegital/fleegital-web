# @fleegital/web

The driver application form for carriers running Fleegital, as a package your
developers install instead of a script tag.

```bash
npm install @fleegital/web
```

Your publishable key is in Fleegital under **Settings → Data management →
Recruiting configuration → Website applications**, together with the list of
websites allowed to submit. A key that is not used from an allowed origin is
refused, so the key being public is not a way in.

## The form

```tsx
import { ApplicationForm } from "@fleegital/web/form";

<ApplicationForm
  publishableKey="pk_live_…"
  onSuccess={(message) => router.push("/thanks")}
  onError={(message) => toast(message)}
  className="my-form"
/>
```

That is the whole integration. **Which fields the form asks for is not set
here.** It is the form you configured in Fleegital, under the same Website
applications settings as the key, and the component renders it — so adding a
field, renaming one or making one required is a change you make in Fleegital,
with no deploy and no code.

This is deliberate. A field written into your own markup reaches nothing: the
endpoint stores the answers to the fields the form actually has, so an invented
one is dropped and nobody is told. The same applies to the spam trap, which is
part of the form here rather than something your markup has to remember.

### Styling

Three levels. Pick one; none of them is forced on you.

**1. Nothing.** Import no stylesheet and the package ships no CSS at all. Every
element carries a stable class and the form is yours to style.

**2. Columns only.**

```ts
import "@fleegital/web/layout.css";
```

Fifteen lines: a grid on the form, and `fga-width-half` becomes a column. No
colours, no fonts, no borders — your design still owns the look. Import this if
you style the form yourself, because `fga-width-half` is inert until some
stylesheet turns it into a column.

**3. A finished form.**

```ts
import "@fleegital/web/form.css";
```

Columns plus a presentable default: spacing, labels, fields, the consent line,
the button. It is deliberately colourless — text, borders and muted text are
derived from whatever your page already sets, so it reads correctly on a light
page and on a dark one without a theme switch. The one real colour is the
submit button, and that comes from your brand colour in Fleegital.

Everything is a custom property, so you can keep the stylesheet and change it:

```css
.fga-form {
  --fga-primary: #c2410c;   /* overrides the brand colour from Fleegital */
  --fga-radius: 0;
  --fga-gap: 1.5rem;
  --fga-border: #d8dee9;
  --fga-danger: #b00020;
}
```

#### The classes

| class | element |
| --- | --- |
| `fga-form` | the `<form>` |
| `fga-title` | "Drive for …" |
| `fga-field`, `fga-field-<type>` | one field's wrapper (`fga-field-select`, `fga-field-checkbox`, …) |
| `fga-code-<code>` | which field it is (`fga-code-phone`), whatever its position |
| `fga-width-half`, `fga-width-full` | how wide you made it in Fleegital |
| `fga-label`, `fga-optional` | its label, and the "(optional)" marker |
| `fga-input`, `fga-textarea`, `fga-select`, `fga-checkbox` | the control |
| `fga-options`, `fga-option` | a multiple-choice field's list |
| `fga-help`, `fga-error` | the hint, and the message for that field |
| `fga-consent` | the consent checkbox and its wording |
| `fga-alert` | a message about the whole form |
| `fga-submit` | the button |

For CSS-in-JS and utility frameworks, where the class name is generated, pass
`classNames` and it is added alongside the `fga-…` one:

```tsx
<ApplicationForm
  publishableKey="pk_live_…"
  classNames={{ input: "rounded border px-3 py-2", submit: "btn btn-primary" }}
/>
```

### Two fields on a row

Which fields share a row is set per field in Fleegital, not written into your
CSS, and arrives as `fga-width-half`. Either stylesheet above turns it into a
column at 640px and up.

Writing it yourself is four lines:

```css
@media (min-width: 640px) {
  .fga-form { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; }
  .fga-form > * { grid-column: 1 / -1; }
  .fga-form > .fga-width-half { grid-column: span 1; }
}
```

If the form sits in a column narrower than the page — a sidebar, a modal — ask
the space it was given rather than the screen. The container has to be the
element around the form, not the form: a container query asks an ancestor, so
an element that declares itself one never matches its own rule.

```css
.my-apply-slot { container-type: inline-size; }
@container (min-width: 460px) { /* the same three rules */ }
```

Do not write the layout as "the first four fields". It works until someone
reorders the form in Fleegital — which the field editor exists to let them do —
and then the pairs silently follow the new positions. `fga-width-half` and
`fga-code-<code>` both survive a reorder; `:nth-of-type` does not.

### Your own markup

```tsx
import { useApplicationForm } from "@fleegital/web/form";

const f = useApplicationForm({ publishableKey: "pk_live_…" });

if (f.state === "loading") return <Spinner />;
if (f.state === "sent") return <p>{f.message}</p>;

<form onSubmit={async (e) => {
  e.preventDefault();
  const res = await f.submit();
  if (!res.ok) showError(res.error);
}}>
  {/* The fields your Fleegital settings say this form has. */}
  {f.fields.map((field) => (
    <div key={field.code}>
      <label htmlFor={field.code}>{field.label}{field.required ? " *" : ""}</label>
      <input
        id={field.code}
        value={String(f.values[field.code] ?? "")}
        onChange={(e) => f.setValue(field.code, e.target.value)}
      />
      {f.errors[field.code]?.[0] && <small>{f.errors[field.code][0]}</small>}
    </div>
  ))}

  <label>
    <input type="checkbox" checked={f.consentGranted}
           onChange={(e) => f.setConsentGranted(e.target.checked)} />
    {f.config?.consentText}
  </label>

  {/* A field no person sees. Leave it in: it is how bots are caught. */}
  <input {...f.honeypotProps} tabIndex={-1} aria-hidden style={{ position: "absolute", left: -10000 }} />

  <button type="submit" disabled={f.incomplete || f.state === "sending"}>Apply</button>
</form>
```

Each field carries `code`, `inputType` (`text`, `email`, `tel`, `number`,
`date`, `select`, `multiselect`, `checkbox`, `textarea`), `label`, `helpText`,
`required`, `maxLength`, `width` (`"full"` or `"half"`) and, for the two choice
types, `options` of `{ value, label }` — the value is what gets stored, so a
dropdown writes `A` and shows "Class A". A checkbox answer is a boolean and a multiple-choice
answer is an array of values; everything else is a string. `emptyAnswer(field)`
and `isBlank(field, value)` are exported if you want them.

`f.config` also carries the company name, the consent wording and version, the
brand colour and the logo — all from your Fleegital settings, so changing them
there changes the form without a deploy.

## Website analytics

```bash
npm install @fleegital/web
```

```ts
import { createAnalytics } from "@fleegital/web/analytics";

const analytics = createAnalytics({ publishableKey: "pk_live_…" });
```

That is the whole setup. It records a page view on load and on every SPA route
change, batches events, and sends what is queued when the tab is hidden.

| | |
|---|---|
| `analytics.pageView(path?)` | Record a page view yourself (use with `autoPageViews: false`). |
| `analytics.track(event, path?)` | `page_view`, `form_view`, `form_start`, `form_submit`. |
| `analytics.flush()` | Send what is queued now. |
| `analytics.stop()` | Stop listening, unwrap `history`, send what is left. |

Options: `autoPageViews` (default `true`) and `flushInterval` in milliseconds
(default `3000`), plus `publishableKey` and `origin`.

### The application funnel

Hand the analytics object to the form and the three funnel steps are recorded
for you — the form became usable, the applicant typed something, the
application was accepted:

```tsx
<ApplicationForm publishableKey="pk_live_…" analytics={analytics} />
```

Or with your own markup:

```ts
const f = useApplicationForm({ publishableKey: "pk_live_…", analytics });
```

Without it the page view is still recorded, but the funnel columns in Fleegital
stay empty — and a page view is not an attempt.

### What it collects

An anonymous id for the browser, an id for the visit, the path, the referring
host when it is somebody else's, a device class of `mobile`, `tablet` or
`desktop`, and the `utm_*` tags the visit arrived on.

It sets **no cookie**, loads **no third-party script**, sends nothing to anyone
but your own Fleegital endpoint, and collects nothing a person typed. The ids
live in `localStorage` and `sessionStorage` and never leave the browser except
in these events. Where storage is blocked, nothing is recorded and nothing
breaks.

The campaign is remembered for the whole visit, not read fresh on each page: a
visitor who arrives from an ad and reads three pages counts as three pages for
that campaign.

### It will not break your site

No call throws, no failure is retried, and nothing is logged to the console. A
page view is not worth an error on a carrier's careers page. On a browser
without `fetch` `keepalive` (Firefox before 133) a last unsent batch can be lost
when the tab closes; everything before it is already gone.

## What it does that a plain `fetch` would not

- **Deduplicates across your whole company.** A driver who already applied, in
  any phone format, updates their record instead of becoming a second lead.
- **Records consent** against the exact wording and version shown, which is what
  the text-message gate reads before anything is sent.
- **Carries a first-visit id** so the lead can be traced to the visit it came
  from. Anonymous, `localStorage` only, no cookie, nothing to a third party, and
  silently skipped where storage is blocked.
- **Catches bots** with the honeypot field, without a CAPTCHA.
- **Only asks for what it can keep.** Every field comes from your Fleegital
  settings and writes to a column on the driver's record, so there is no way to
  collect an answer that quietly goes nowhere.

## Outcomes

`submit()` resolves to `{ ok: true, message }` or
`{ ok: false, error, fields?, stale }`.

`stale` means the form changed in Fleegital while the page was open — the
consent wording or the fields themselves: reload it. `fields` carries per-field
messages, keyed by field code.

Accepted applications, ones held for review and ones that tripped the spam trap
all get the same answer, deliberately — a submitter cannot learn which happened.
What a recruiter needs is in Fleegital.

## Privacy

The package sets no cookie, loads no third-party script, and sends nothing
anywhere but your Fleegital intake endpoint on `www.fleegital.app`. The only
thing it stores is the anonymous visit id above.

## Versions

This runs on your website, so a change here can break your site. Versions
follow semver strictly: anything that changes what an existing call does gets a
major — and before 1.0, the minor is that major. Pin the minor
(`"@fleegital/web": "~0.2.0"`) and read [CHANGELOG.md](CHANGELOG.md) before
moving it.

Published builds carry [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
so you can verify the tarball you installed was built from a commit in this
repository.

## Support

Bugs and documentation problems: [open an issue](https://github.com/fleegital/fleegital-web/issues).
Anything about your own company's keys, leads or settings belongs in the app,
not in a public issue. Security reports: see [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
