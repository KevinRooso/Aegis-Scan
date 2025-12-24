# AegisScan Frontend

Vite + React dashboard that visualizes agent progress, findings, logs, and report status from the FastAPI backend.

## Commands

```bash
cd frontend
pnpm install # or npm/yarn
pnpm dev
```

The dev server proxies `/api` calls to `http://localhost:8000` (see `vite.config.ts`).

## Features

- Scan starter form with mode selection
- Real-time WebSocket updates for agent progress
- Findings table + logs viewer
- Report fetch helper once the reporting agent finishes
- Styled with Tailwind + Radix progress primitives
