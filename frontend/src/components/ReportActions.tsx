import { useCallback, useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";

import { fetchReport } from "../lib/api";
import type { ReportInfo } from "../types/api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface Props {
  scanId?: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");

const resolveApiUrl = (path?: string | null) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
};

type PanelStatus = "idle" | "loading" | "ready" | "error";

export function ReportActions({ scanId }: Props) {
  const [info, setInfo] = useState<ReportInfo | null>(null);
  const [panelStatus, setPanelStatus] = useState<PanelStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isPreviewLoading, setPreviewLoading] = useState(false);

  const downloadTargets = useMemo(() => {
    return {
      pdf: resolveApiUrl(info?.pdf_url),
      markdown: resolveApiUrl(info?.report_url ?? info?.report_path),
    };
  }, [info]);

  const loadPreview = useCallback(async (pdfUrl: string | null) => {
    if (!pdfUrl) {
      setPreviewDataUrl(null);
      return;
    }
    setPreviewLoading(true);
    setMessage(null);
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF preview (${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdfDocument.getPage(1);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas context unavailable");
      }
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      setPreviewDataUrl(canvas.toDataURL("image/png"));
    } catch (error) {
      console.error("[ReportActions] Failed to render preview", error);
      setPreviewDataUrl(null);
      setMessage("Preview unavailable. Download the PDF to view the full report.");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleFetch = useCallback(async () => {
    if (!scanId) return;
    setPanelStatus("loading");
    setMessage(null);
    setPreviewDataUrl(null);
    try {
      const data = await fetchReport(scanId);
      setInfo(data);
      setPanelStatus("ready");
      if (data.pdf_url) {
        await loadPreview(resolveApiUrl(data.pdf_url));
      } else {
        setMessage("PDF not available yet. Ensure the report agent completed successfully.");
      }
    } catch (error) {
      console.error("[ReportActions] Failed to fetch report", error);
      setPanelStatus("error");
      setInfo(null);
      setMessage("Report not ready yet. Let all agents finish before exporting.");
    }
  }, [loadPreview, scanId]);

  const handleDownload = useCallback((url: string | null) => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }, []);

  const statusLabel = useMemo(() => {
    if (panelStatus === "loading") return "Generating PDF...";
    if (panelStatus === "ready" && info?.pdf_available) return "PDF ready";
    if (panelStatus === "error") return "Report unavailable";
    return "Awaiting latest report";
  }, [info?.pdf_available, panelStatus]);

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-slate-900/30 to-slate-900/10 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Report Center
            </p>
            <h3 className="text-2xl font-semibold text-white">Executive PDF export</h3>
            <p className="text-sm text-slate-400">
              Generate a shareable PDF dossier and preview the first page before downloading. Reports
              are refreshed when the Reporting Agent finishes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleFetch}
              disabled={!scanId || panelStatus === "loading"}
              className="rounded-full border-2 border-white/20 bg-white/90 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:border-white hover:bg-white hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {panelStatus === "loading" ? "Syncing…" : "Generate latest PDF"}
            </button>
            <button
              onClick={() => handleDownload(downloadTargets.pdf)}
              disabled={!downloadTargets.pdf}
              className="rounded-full border-2 border-cyan-400/50 bg-cyan-500/10 px-5 py-2 text-sm font-semibold text-cyan-100 shadow-md transition hover:border-cyan-400 hover:bg-cyan-500/20 hover:shadow-lg disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800/20 disabled:text-slate-500 disabled:opacity-50"
            >
              Download PDF
            </button>
            <button
              onClick={() => handleDownload(downloadTargets.markdown)}
              disabled={!downloadTargets.markdown}
              className="rounded-full border-2 border-blue-400/40 bg-blue-500/10 px-5 py-2 text-sm font-semibold text-blue-100 shadow-md transition hover:border-blue-400 hover:bg-blue-500/20 hover:shadow-lg disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800/20 disabled:text-slate-500 disabled:opacity-50"
            >
              Download Markdown
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-200">
            <p className="font-semibold text-white">{statusLabel}</p>
            {info?.pdf_available && info?.pdf_path && (
              <p className="text-xs text-slate-400">Stored at {info.pdf_path}</p>
            )}
            {message && <p className="mt-2 text-xs text-rose-300">{message}</p>}
            {!scanId && (
              <p className="mt-1 text-xs text-slate-400">Start a scan to unlock PDF exports.</p>
            )}
          </div>
        </div>

        <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 lg:w-72">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
            Preview
          </p>
          <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-slate-950/70">
            {isPreviewLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs uppercase tracking-[0.3em] text-white/70">
                Rendering…
              </div>
            )}
            {!previewDataUrl && !isPreviewLoading && (
              <p className="px-6 text-center text-xs text-slate-400">
                Generate the PDF to view a live preview of the first page.
              </p>
            )}
            {previewDataUrl && (
              <img
                src={previewDataUrl}
                alt="PDF preview"
                className="h-full w-full rounded-xl object-cover shadow-2xl shadow-black/40"
              />
            )}
          </div>
          {info?.pdf_available && (
            <p className="mt-3 text-center text-[11px] uppercase tracking-[0.3em] text-emerald-300">
              Ready to share
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
