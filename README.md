# codex-jev-router

An independent local bridge that lets OpenAI Codex CLI use Jev for per-turn model and reasoning-effort routing.

This project does not depend on the `jev-router` GitHub repository. It uses the TypeSafe JavaScript SDK for Jev and a small loopback Responses API proxy for Codex.

## What it does

For each fresh user turn, the bridge can:

1. Ask Jev which available Codex model is sufficient.
2. Convert Jev's `reasoning_required` score into `low`, `medium`, `high`, or `max`.
3. Rewrite `model` and `reasoning.effort` before forwarding the request.
4. Keep the selected model and effort stable across tool-call continuations.
5. Preserve Codex's streaming response and command-line permissions.

If Jev is unavailable, the bridge fails open: it keeps the current model/effort and lets Codex continue.

## Install and run

```bash
npm install

# Put the key outside the repository, for example:
printf '%s\n' 'JEV_API_KEY=your-key' > ~/.jev-codex.env
chmod 600 ~/.jev-codex.env

cd /path/to/your/repository
node /Users/tiandee/IqiyiProjects/codex-jev-router/bin/jev-codex.mjs \
  --dangerously-bypass-approvals-and-sandbox
```

To install this independent command without replacing the existing `jev-codex` command:

```bash
npm link
jev-codex-bridge
```

The wrapper forwards all normal Codex arguments, including `--sandbox`, `--model`, and `--dangerously-bypass-approvals-and-sandbox`.

## Effort policy

Automatic effort is enabled by default. Set `JEV_CODEX_AUTO_EFFORT=0` to keep the effort selected in Codex's `/model` picker.

The current mapping is:

```text
reasoning_required < 0.30  -> low
reasoning_required < 0.60  -> medium
reasoning_required < 0.85  -> high
otherwise                   -> max
```

The selected model's advertised capabilities win: an unsupported effort is normalized to a supported level.

## Development

```bash
npm test
npm run smoke
```

The tests use a fake Jev decision boundary and a local fake upstream; no API key is required for them.

## Security notes

- Keep TypeSafe and Codex credentials outside the repository.
- The bridge binds to `127.0.0.1` and does not log prompts or authorization headers.
- Full-access Codex mode remains fully unrestricted; the bridge does not make it safer.
- Jev receives the text needed to make the routing decision, so do not route sensitive prompts through it unless that data flow is acceptable.
