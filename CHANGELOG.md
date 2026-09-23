# Changelog

## Unreleased

### Changed

- Keep `codex-jev` sessions on Codex's built-in `openai` provider so normal Codex and Jev-routed runs share resume history.
- Remove the synthetic `jev-router` model and rewrite model/effort only on outgoing Responses API requests.
- Reject Responses WebSocket upgrades with HTTP 426 so Codex falls back to the HTTP/SSE proxy path.
- Preserve an explicitly selected `--model` without Jev model routing.

## 0.1.0 - 2026-09-21

### Features

- Add an independent Jev-powered Codex CLI routing bridge.
- Use `codex-jev` as the sole CLI command.
- Add per-turn model selection and reasoning-effort selection.
- Preserve model and effort across tool-call continuations.
- Add local tests, a fake-upstream smoke test, and CI configuration.
