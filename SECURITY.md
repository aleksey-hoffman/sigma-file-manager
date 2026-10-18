# Security Policy

## Supported versions

Security fixes go into the latest release only. Older versions don't get backported patches. Please update to the latest version before reporting.

| Version | Supported |
| ------- | --------- |
| Latest 2.x release (built from `main`) | Yes |
| Older 2.x releases | No, please update |
| 1.x | No |

## Reporting a vulnerability

**Please don't open public issues, pull requests or discussions for security problems.**

Report privately through GitHub:

1. Go to the [Security tab](https://github.com/aleksey-hoffman/sigma-file-manager/security) of this repository.
2. Click **Report a vulnerability**.
3. Fill in the form.

Please include:

- the affected version or commit and your OS
- what an attacker can do, and what they need first (for example "a user installs a malicious extension")
- steps to reproduce or a proof of concept
- a suggested fix, if you have one (you can attach a patch to the private advisory)

## What to expect

This is a project maintained by one person, so these are goals, not guarantees:

- acknowledgement within **7 days**
- an initial assessment within **14 days**
- a fix in a release as soon as practical, usually within **90 days** for confirmed issues

I'll keep you updated in the advisory, credit you in the release notes and the advisory (unless you'd rather stay anonymous), and request a CVE through GitHub when it's warranted. Please give me a chance to ship a fix before you disclose publicly. If 90 days pass without progress, let's agree on a disclosure date in the advisory.

## Scope

In scope:

- the Sigma File Manager desktop app (Tauri/Rust backend and Vue frontend) in this repository
- the extension platform: the extension runtime and sandbox, permission checks, the extension APIs (`@sigma-file-manager/api` in `packages/api`), extension install/update/download, and binary downloads
- the app updater and release artifacts published from this repository

Out of scope:

- third-party extensions themselves. Report those to the extension's author. If an extension shows that the platform's own isolation or permission checks can be bypassed, that is in scope here.
- marketplace listing content in [sigma-hub/sfm-marketplace](https://github.com/sigma-hub/sfm-marketplace). Use that repository's own channels.
- problems that require an attacker who already has full control of the user's account or machine
- vulnerabilities in dependencies with no demonstrated impact on Sigma File Manager (please report those upstream)
- missing hardening with no concrete attack (for example "no CSP header on a local page" without an exploit)

## Automated and AI-assisted reports

AI-assisted reports are welcome if a person has verified them. Please confirm the issue reproduces on the latest release and include a working reproduction. Unverified bulk reports may be closed without detailed review.
