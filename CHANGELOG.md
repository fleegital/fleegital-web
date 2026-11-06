# Changelog

This package runs on carriers' own websites, so a breaking change here breaks
someone else's site. Versions follow semver strictly, and anything that changes
what an existing call does gets a major.

## Unreleased

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
