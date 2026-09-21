# Contributing

Thanks for helping improve `codex-jev-router`.

## Development setup

Use Node.js 20 or newer:

```bash
npm ci
```

The test suite and local smoke test do not require a Jev API key or a Codex
login.

## Before opening a pull request

Run the same checks used by CI:

```bash
npm test
npm run smoke
npm audit --omit=dev --audit-level=high
```

Keep credentials in an ignored local environment file or the configuration
environment. Never commit API keys, authorization headers, prompt dumps, or
other sensitive data.

For behavior changes, update the relevant tests and README. Keep the bridge
fail-open when Jev is unavailable unless the change explicitly documents a
different policy.

## Commits and pull requests

- Use a short Conventional Commit message, such as `fix(proxy): preserve SSE framing`.
- Explain the user-visible behavior and compatibility impact in the pull request.
- Include test results and call out any changes to routing, prompt data flow, or credentials.
