# Security Policy

## Supported versions

Only the latest published `0.x` version on npm receives fixes while the
project is in early development. Once `1.0.0` ships, this section will be
updated with a longer support window.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Email Sushil Kamble at <iamsushil303@gmail.com> with:

- A description of the issue and its impact.
- Steps to reproduce, ideally with a minimal proof of concept.
- The version of `agentodo` and your Node.js version.

You should expect an acknowledgement within **72 hours**. Coordinated
disclosure is appreciated — once a fix is released, the advisory will be
published on GitHub and credited (unless you ask to remain anonymous).

## Scope

`agentodo` runs entirely on `localhost`. Things that are in scope:

- Path traversal or arbitrary file read/write through the project picker,
  scratch workspace, or static file server.
- SQL injection or unsafe query construction in the SQLite layer.
- Unauthenticated access to the local API from another origin (CSRF, etc.).
- Insecure handling of agent credentials, tokens, or transcripts.

Out of scope:

- Bugs that require an attacker to already have shell access to your machine.
- Denial of service caused by user-supplied prompts to the underlying agents.
