"""Typer-based CLI for running local AegisScan workflows."""

from __future__ import annotations

import asyncio
import json
from importlib import metadata
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from app.config import Settings, get_settings
from app.orchestrator import Orchestrator
from app.schemas import AgentStatus, ScanRequest, ScanStatus
from app.web.websocket_manager import WebsocketManager

console = Console()
cli = typer.Typer(help="AegisScan — adaptive multi-agent pentest assistant")
TERMINAL_STATUSES = {AgentStatus.COMPLETED, AgentStatus.FAILED, AgentStatus.SKIPPED}


def _build_settings(results_dir: Optional[Path]) -> Settings:
    settings = get_settings()
    if results_dir is not None:
        settings.results_dir = results_dir
    return settings


async def _monitor_logs(orch: Orchestrator, scan_id: str) -> None:
    last_log_count = 0
    while True:
        status = orch.get_status(scan_id)
        if not status:
            break
        new_logs = status.logs[last_log_count:]
        for line in new_logs:
            console.print(f"[cyan]•[/] {line}")
        last_log_count += len(new_logs)
        if all(progress.status in TERMINAL_STATUSES for progress in status.progress):
            break
        await asyncio.sleep(0.5)


async def _execute_scan(settings: Settings, request: ScanRequest) -> ScanStatus:
    orch = Orchestrator(ws_manager=WebsocketManager(), settings=settings)
    status = await orch.start_scan(request)
    console.print(f"[bold green]Started scan {status.scan_id}[/] targeting {status.target}")
    await asyncio.gather(
        orch.wait_for_completion(status.scan_id),
        _monitor_logs(orch, status.scan_id),
    )
    final_status = orch.get_status(status.scan_id)
    if not final_status:
        raise RuntimeError("Scan status missing after completion")
    return final_status


def _render_findings(status: ScanStatus) -> None:
    if not status.findings:
        console.print("[yellow]No findings were produced during this scan.[/]")
        return

    table = Table(title="Findings", show_lines=False)
    table.add_column("Severity", style="bold")
    table.add_column("Title")
    table.add_column("Agent")
    table.add_column("Remediation")

    for finding in status.findings:
        table.add_row(
            finding.severity.value.upper(),
            finding.title,
            finding.source_agent.value,
            finding.remediation,
        )

    console.print(table)


def _render_summary(status: ScanStatus, results_dir: Path) -> None:
    console.print(
        f"[bold]Scan {status.scan_id} complete[/] — target: {status.target}, mode: {status.mode}"
    )
    summary = Table(show_header=True)
    summary.add_column("Agent")
    summary.add_column("Status")
    summary.add_column("Message")
    for progress in status.progress:
        summary.add_row(progress.agent.value, progress.status.value, progress.message or "")
    console.print(summary)
    console.print(
        f"Artifacts saved under {results_dir / (status.scan_id + '.json')}"
    )


@cli.command()
def scan(
    target: str = typer.Argument(..., help="Path or URL to scan"),
    mode: str = typer.Option("adaptive", help="Scan mode"),
    out: Optional[Path] = typer.Option(None, "--out", "-o", help="Directory for results"),
    no_docker: bool = typer.Option(False, help="Run without Docker"),
    max_memory: Optional[int] = typer.Option(None, help="Container memory cap (MB)"),
    concurrency: Optional[int] = typer.Option(None, help="Parallel agent limit"),
) -> None:
    settings = _build_settings(out)
    request = ScanRequest(
        target=target,
        mode=mode,
        no_docker=no_docker,
        out_dir=str(out) if out else None,
        max_memory=max_memory,
        concurrency=concurrency,
    )
    try:
        final_status = asyncio.run(_execute_scan(settings, request))
    except Exception as exc:  # pragma: no cover - CLI surface
        console.print(f"[red]Scan failed:[/] {exc}")
        raise typer.Exit(code=1) from exc
    _render_summary(final_status, settings.results_dir)
    _render_findings(final_status)


@cli.command()
def report(results: Path = typer.Argument(..., exists=True, help="Path to scan results JSON")) -> None:
    payload = json.loads(results.read_text(encoding="utf-8"))
    status = ScanStatus.model_validate(payload)
    _render_summary(status, results.parent)
    _render_findings(status)


@cli.command()
def serve(
    host: str = typer.Option("0.0.0.0", help="Bind address"),
    port: int = typer.Option(8000, help="Port for the API server"),
    reload: bool = typer.Option(False, help="Enable autoreload"),
) -> None:
    import uvicorn

    console.print(f"Starting API server on http://{host}:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)


@cli.command()
def ui(
    api_host: str = typer.Option("0.0.0.0", help="Backend bind address"),
    api_port: int = typer.Option(8000, help="Backend port"),
) -> None:
    console.print(
        "Launching backend API. Start the React dev server (pnpm dev) in another terminal for the dashboard."
    )
    serve(host=api_host, port=api_port, reload=False)


@cli.command()
def config() -> None:
    settings = get_settings()
    table = Table(title="Configuration", show_header=True)
    table.add_column("Key")
    table.add_column("Value")
    for key in [
        "environment",
        "llm_provider",
        "results_dir",
        "docker_network",
        "enabled_agents",
    ]:
        table.add_row(key, str(getattr(settings, key)))
    console.print(table)


@cli.command()
def version() -> None:
    try:
        pkg_version = metadata.version("aegisscan-backend")
    except metadata.PackageNotFoundError:  # pragma: no cover - editable install fallback
        pkg_version = "0.0.0"
    console.print(f"AegisScan CLI version {pkg_version}")


def main() -> None:
    cli()


if __name__ == "__main__":
    main()
