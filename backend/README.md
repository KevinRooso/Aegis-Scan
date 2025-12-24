# AegisScan Backend

FastAPI backend that exposes orchestration APIs, WebSocket updates, and bridges to the local multi-agent pentest orchestrator defined in `app/orchestrator.py`.

## Features

- REST endpoints (`/scan/start`, `/scan/status`, `/scan/results`, `/report/latest`).
- WebSocket gateway for streaming agent progress and voice updates.
- Adaptive orchestrator that coordinates tool agents, parses results, and stores canonical findings.
- Thin ElevenLabs proxy (`/voice/speak`) so the React HAL Voice SDK never needs the API key.
- Configuration via `.env` or environment variables using `pydantic-settings`.

## Getting Started

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt  # install dependencies without building the package
# optional: install editable package after deps succeed
pip install -e .
uvicorn app.main:app --reload
```

## CLI

Installing the package in editable mode gives you the `aegisscan` command:

```bash
aegisscan scan ./example-target --mode adaptive
aegisscan report pentest_output/<scan_id>.json
aegisscan serve --port 9000
```

`aegisscan ui` is a convenience alias for `serve`—run the React frontend (`pnpm dev`) in another terminal to access the dashboard while the CLI keeps the backend alive.

## Testing

```bash
pytest
```

## Environment

Create `.env` alongside `pyproject.toml` with:

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_key
ELEVENLABS_API_KEY=your_eleven_key
ELEVENLABS_AGENT_ID=hal_voice_agent_id
ELEVENLABS_BASE_URL=https://api.elevenlabs.io  # optional override
SEMGREP_BIN=semgrep
TRIVY_BIN=trivy
GITLEAKS_BIN=gitleaks
FFUF_BIN=ffuf
FFUF_WORDLIST=/usr/share/wordlists/dirb/common.txt
ZAP_BASELINE_BIN=zap-baseline.py
NUCLEI_BIN=nuclei
```

Add any additional tool credentials (GitHub tokens, Slack webhooks, etc.) in the same file as needed.

## Tooling Requirements

Install the external scanners locally (or wrap them via Docker) so each agent can execute real scans:

- Semgrep
- Trivy
- Gitleaks
- ffuf + a wordlist (defaults to `/usr/share/wordlists/dirb/common.txt`)
- OWASP ZAP baseline (`zap-baseline.py`)
- Nuclei

Override binary paths/commands through the environment variables shown above if they live elsewhere or require docker wrappers.

## Docker Toolbox (all-in-one install)

Build the curated image that already contains the CLI plus every scanner:

```bash
docker build -t aegisscan-tools -f docker/Dockerfile ..
```

Run a scan against a host project:

```bash
docker run --rm -it \
  --env-file backend/.env \
  -v /path/to/project:/workspace \
  -v /path/to/project/pentest_output:/output \
  aegisscan-tools \
  aegisscan scan /workspace --mode adaptive
```

- `/workspace` is the mounted target repo.
- `/output` is where `pentest_output/<scan_id>` artifacts land.
- Replace the final command to serve the API instead: `aegisscan serve --host 0.0.0.0 --port 8000` plus `-p 8000:8000` on the docker run invocation.

This is the easiest way to give end users a fully working toolchain—only Docker and an `.env` file are required on their machines.

## Docker Compose workflow

Spin up everything (backend API, security tooling, and React UI) with:

```bash
docker compose up backend frontend
```

- Backend: `http://localhost:8000`
- Frontend (Vite dev server): `http://localhost:5173`

Need a CLI shell without installing to PyPI? Use the dedicated `cli` service:

```bash
# From the repo root that owns docker-compose.yml
docker compose run --rm \
  -v /abs/path/to/target:/workspace-target \
  cli \
  aegisscan scan /workspace-target --mode adaptive
```

Artifacts continue to land in `./pentest_output` thanks to the shared volume mount.

