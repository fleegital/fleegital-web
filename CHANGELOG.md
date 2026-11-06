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
