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

The package ships no stylesheet. The markup is plain elements with your
`className` on the form, so your own CSS owns it.

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
  <input value={f.values.first_name} onChange={(e) => f.setValue("first_name", e.target.value)} />
  {f.errors.first_name?.[0] && <small>{f.errors.first_name[0]}</small>}

  <label>
    <input type="checkbox" checked={f.consentGranted}
           onChange={(e) => f.setConsentGranted(e.target.checked)} />
    {f.config?.consentText}
  </label>

  {/* A field no person sees. Leave it in: it is how bots are caught. */}
  <input {...f.honeypotProps} tabIndex={-1} aria-hidden style={{ position: "absolute", left: -10000 }} />
</form>
```

`f.config` carries the company name, the consent wording and version, the brand
colour and the logo — all from your Fleegital settings, so changing them there
changes the form without a deploy.

## What it does that a plain `fetch` would not

- **Deduplicates across your whole company.** A driver who already applied, in
  any phone format, updates their record instead of becoming a second lead.
- **Records consent** against the exact wording and version shown, which is what
  the text-message gate reads before anything is sent.
- **Carries a first-visit id** so the lead can be traced to the visit it came
  from. Anonymous, `localStorage` only, no cookie, nothing to a third party, and
  silently skipped where storage is blocked.
- **Catches bots** with the honeypot field, without a CAPTCHA.

## Outcomes

`submit()` resolves to `{ ok: true, message }` or
`{ ok: false, error, fields?, stale }`.

`stale` means your consent wording changed in Fleegital while the page was open:
reload it. `fields` carries per-field messages, keyed by field name.

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
major. Pin the major and read [CHANGELOG.md](CHANGELOG.md) before moving it.

Published builds carry [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
so you can verify the tarball you installed was built from a commit in this
repository.

## Support

Bugs and documentation problems: [open an issue](https://github.com/fleegital/fleegital-web/issues).
Anything about your own company's keys, leads or settings belongs in the app,
not in a public issue. Security reports: see [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
