import { useCallback, useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";
import { FileText, Download, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

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

export function ReportActions({ scanId }: Props) {
  const [info, setInfo] = useState<ReportInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

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

    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        console.warn(`PDF fetch failed with status ${response.status}`);
        setPreviewDataUrl(null);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdfDocument.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        console.warn("Canvas context unavailable");
        setPreviewDataUrl(null);
        return;
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      setPreviewDataUrl(canvas.toDataURL("image/png"));
    } catch (err) {
      console.error("Preview render error:", err);
      setPreviewDataUrl(null);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!scanId) return;

    setLoading(true);
    setError(null);
    setPreviewDataUrl(null);

    try {
      const data = await fetchReport(scanId);
      setInfo(data);

      if (data.pdf_url) {
        await loadPreview(resolveApiUrl(data.pdf_url));
      }
    } catch (err) {
      console.error("Report generation error:", err);
      setError("Report not ready. Ensure all agents have completed.");
      setInfo(null);
    } finally {
      setLoading(false);
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

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/50 p-6 shadow-xl backdrop-blur">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">Report Center</h3>
        </div>
        <p className="text-sm text-slate-400">Generate and download security reports</p>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!scanId || loading}
        className="w-full mb-6 flex items-center justify-center gap-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-6 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/30 hover:border-cyan-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4" />
            Generate Report
          </>
        )}
      </button>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {!scanId && (
        <div className="mb-6 p-4 rounded-lg bg-slate-500/10 border border-slate-500/20">
          <p className="text-sm text-slate-400">Start a scan to generate reports</p>
        </div>
      )}

      {/* Preview */}
      {(previewDataUrl || loading) && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Preview</p>
            {previewDataUrl && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                  disabled={zoom <= 0.5}
                  className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 transition-all"
                >
                  <ZoomOut className="w-4 h-4 text-slate-400" />
                </button>
                <span className="text-xs text-slate-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(prev => Math.min(2, prev + 0.25))}
                  disabled={zoom >= 2}
                  className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 transition-all"
                >
                  <ZoomIn className="w-4 h-4 text-slate-400" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                >
                  <RotateCcw className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            )}
          </div>

          <div className="relative rounded-lg bg-slate-950/70 border border-white/5 overflow-auto" style={{ height: "500px" }}>
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                <p className="text-xs text-slate-400">Rendering preview...</p>
              </div>
            )}

            {previewDataUrl && !loading && (
              <div className="p-6 flex items-start justify-center min-h-full">
                <img
                  src={previewDataUrl}
                  alt="PDF preview"
                  className="rounded shadow-lg"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease-out',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Download Buttons */}
      {info?.pdf_available && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => handleDownload(downloadTargets.pdf)}
            disabled={!downloadTargets.pdf}
            className="flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button
            onClick={() => handleDownload(downloadTargets.markdown)}
            disabled={!downloadTargets.markdown}
            className="flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Download Markdown
          </button>
        </div>
      )}
    </div>
  );
}
