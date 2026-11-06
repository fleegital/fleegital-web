# Reporting a security issue

Please do not open a public issue for a security problem.

Use GitHub's private reporting instead — the **Security** tab of this
repository, then *Report a vulnerability*. It reaches us without the report
being public first.

If that is unavailable to you, raise it through Fleegital support inside the
app, and say only that it is a security report; we will take the details
privately.

## What is in scope

This repository holds the browser package. The endpoints it talks to
(`www.fleegital.app/api/…`) are in scope too — tell us if you can submit an
application with a key that is not yours, read anything belonging to another
company, or get more out of the API than the documentation describes.

## What is not a vulnerability

The publishable key is public by design. It is printed in the page source on
every site that uses this package. A key only works from the origins its
company allowed, so having one is not access.
