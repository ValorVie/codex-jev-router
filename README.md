# codex-jev-router

[![CI](https://github.com/ValorVie/codex-jev-router/actions/workflows/ci.yml/badge.svg)](https://github.com/ValorVie/codex-jev-router/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Route OpenAI Codex CLI turns through Jev. Jev selects a suitable Codex model and reasoning effort for each fresh turn.

The bridge runs locally. It starts a loopback Responses API proxy, temporarily points Codex's built-in `openai` provider at that proxy, sends the routing context to Jev, and forwards the request upstream. If Jev is unavailable, Codex continues with its current model and effort.

The wrapper does not create a synthetic model or a separate model provider. Sessions created by `codex` and `codex-jev` therefore use the same `openai` provider identity and appear in the same Codex resume history.

## Prerequisites

- Node.js 20 or newer
- OpenAI Codex CLI installed and available as `codex` on your `PATH`
- Codex authentication configured
- A Jev or TypeSafe API key

This project is open source under the MIT License. The package is not published to npm; install it from the public GitHub repository with the steps below.

## Install from source

Clone the repository, install its dependencies, and create the global `codex-jev` command:

```bash
git clone https://github.com/ValorVie/codex-jev-router.git
cd codex-jev-router
npm install
npm link
codex-jev --version
```

If your GitHub account uses SSH, replace the clone URL with the SSH URL configured for your account.

## Configure the Jev key

Store the key outside the repository. The bridge loads `~/.jev-codex.env` automatically:

```bash
printf '%s\n' 'JEV_API_KEY=your_typesafe_api_key' > ~/.jev-codex.env
chmod 600 ~/.jev-codex.env
```

You can also export `JEV_API_KEY` in the shell that starts Codex. Do not commit the key or place it in a tracked file.

## Run Codex with routing

Change to the project where you want to work, then start Codex through the wrapper:

```bash
cd /path/to/your/project
codex-jev
```

The wrapper forwards normal Codex arguments, including `--model`, `--sandbox`, and `--dangerously-bypass-approvals-and-sandbox`.

When no `--model` is supplied, Jev may rewrite the model and reasoning effort on the outgoing Responses API request. The Codex session itself keeps a normal Codex model and the built-in `openai` provider. If you explicitly pass `--model`, automatic model routing is disabled for that process and the selected model is forwarded unchanged.

Without a Jev key, the wrapper still starts Codex and prints a fallback notice. Add the key when you want automatic routing.

## Shared Codex session history

`codex-jev` uses Codex's built-in `openai` provider and only overrides `openai_base_url` for the lifetime of the wrapper process. This keeps session metadata compatible with normal Codex:

```bash
# Create a session normally.
codex

# Resume the same OpenAI-provider sessions with Jev routing enabled.
codex-jev resume --all

# Sessions created through codex-jev are also visible to normal Codex.
codex resume --all
```

The local proxy rejects Responses WebSocket upgrades with HTTP 426, which makes Codex use its HTTP/SSE fallback through the same proxy.

For each fresh turn, the bridge adds a Codex commentary item with the selected model and reasoning effort. Codex renders this item with the same layout and colors as the rest of the conversation:

```text
🔹 [Jev] routed this turn to gpt-5.6-sol (max reasoning, confidence 0.95).
```

## Reasoning-effort policy

Automatic effort selection is enabled by default. The bridge maps Jev's `reasoning_required` score as follows:

```text
reasoning_required < 0.30  -> low
reasoning_required < 0.60  -> medium
reasoning_required < 0.85  -> high
otherwise                   -> max
```

Set `JEV_CODEX_AUTO_EFFORT=0` to preserve the effort selected in Codex.

The selected model's advertised capabilities take precedence. If a model does not support the requested effort, the bridge chooses the strongest supported lower level.

## Routing pool controls

By default, every Codex-advertised model and supported reasoning effort is eligible. You can restrict the candidate pool before Jev makes a decision.

```bash
# Only let Jev choose from these exact model IDs.
JEV_CODEX_MODELS=gpt-5.6-luna,gpt-5.6-terra,gpt-5.6-sol

# Only let Jev use these reasoning efforts.
JEV_CODEX_EFFORTS=low,medium,high

# Optional lower/upper effort bounds.
JEV_CODEX_MIN_EFFORT=medium
JEV_CODEX_MAX_EFFORT=high
```

The policy is applied to both the live Codex `/models` catalog and the static fallback catalog. A model is removed entirely if none of its advertised reasoning efforts remain after filtering. Jev only receives the remaining model candidates.

If the configured policy removes every model/effort combination, the bridge fails with a clear configuration error instead of silently routing outside the requested pool.


## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `JEV_API_KEY` | unset | Enables Jev routing |
| `JEV_BASE_URL` | TypeSafe default | Overrides the Jev API endpoint |
| `JEV_CODEX_AUTO_EFFORT` | `1` | Derives reasoning effort from Jev's score |
| `JEV_CODEX_MODELS` | unset | Comma-separated exact model allowlist presented to Jev |
| `JEV_CODEX_EFFORTS` | unset | Comma-separated reasoning-effort allowlist |
| `JEV_CODEX_MIN_EFFORT` | unset | Minimum allowed reasoning effort |
| `JEV_CODEX_MAX_EFFORT` | unset | Maximum allowed reasoning effort |
| `JEV_CODEX_API_BASE_URL` | OpenAI API default | Overrides the OpenAI Responses endpoint |
| `JEV_CODEX_CHATGPT_BASE_URL` | ChatGPT Codex default | Overrides the ChatGPT Codex endpoint |
| `JEV_CODEX_DEBUG` | unset | Logs route metadata without prompts or keys when set to `1` |

## Troubleshooting

### `codex-jev: command not found`

Run `npm link` from the cloned repository. If the command remains unavailable, add the npm global bin directory to your `PATH`:

```bash
npm prefix -g
```

On macOS with Homebrew, the directory is commonly `/opt/homebrew/bin`.

### Codex is not installed or is not on `PATH`

Run `codex --version` first. Install and authenticate the OpenAI Codex CLI, then run `codex-jev` again.

### Codex starts without routing

Check that the key file exists and has the expected variable:

```bash
ls -l ~/.jev-codex.env
grep -q '^JEV_API_KEY=' ~/.jev-codex.env && echo 'JEV_API_KEY is configured'
```

The bridge fails open when Jev cannot be reached, so Codex can continue without automatic routing.

## Development

Run the local checks from the repository root:

```bash
npm test
npm run smoke
npm audit --omit=dev
```

The tests use a fake Jev decision boundary and a local fake upstream. They do not require an API key.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, required checks, and pull request expectations.

## Security notes

- Keep TypeSafe and Codex credentials outside the repository.
- The proxy binds to `127.0.0.1` and does not log prompts or authorization headers.
- Full-access Codex mode remains unrestricted. The bridge does not make it safer.
- Jev receives the text needed to make the routing decision. Do not route sensitive prompts through Jev unless that data flow is acceptable.

To report a vulnerability privately, see [SECURITY.md](SECURITY.md).

## License

This project is licensed under the [MIT License](LICENSE).
