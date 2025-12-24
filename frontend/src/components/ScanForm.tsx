import { useState } from "react";

import { startScan } from "../lib/api";
import type { ScanRequest } from "../types/api";

interface Props {
  onStart: (scanId: string) => void;
}

const modes = ["adaptive", "standard", "fast", "deep"];

export function ScanForm({ onStart }: Props) {
  const [form, setForm] = useState<ScanRequest>({
    github_url: "",
    github_branch: "main",
    target_url: "",
    mode: "adaptive"
  });
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Validate at least one source is provided
    if (!form.github_url && !form.target_url) {
      setError("Please provide at least a GitHub URL or Target URL");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Only send non-empty fields
      const payload: ScanRequest = {
        mode: form.mode,
      };

      if (form.github_url?.trim()) {
        payload.github_url = form.github_url.trim();
        payload.github_branch = form.github_branch || "main";
        if (form.github_token?.trim()) {
          payload.github_token = form.github_token.trim();
        }
      }

      if (form.target_url?.trim()) {
        payload.target_url = form.target_url.trim();
      }

      const { scan_id } = await startScan(payload);
      onStart(scan_id);
    } catch (err) {
      console.error(err);
      setError("Failed to start scan. Ensure backend is running and inputs are valid.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-slate-800 bg-slate-900/50 p-6">
      {/* Code Source Section */}
      <div className="space-y-4">
        <div className="border-b border-slate-700 pb-2">
          <h3 className="text-base font-semibold text-slate-200">Code Source</h3>
          <p className="text-xs text-slate-400 mt-1">Scan a GitHub repository for static analysis</p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300">
            GitHub Repository URL
          </label>
          <input
            className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            placeholder="https://github.com/username/repository"
            value={form.github_url || ""}
            onChange={(event) => setForm((prev) => ({ ...prev, github_url: event.target.value }))}
          />
        </div>

        {form.github_url && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-300">Branch</label>
                <input
                  className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none focus:border-primary-500"
                  placeholder="main"
                  value={form.github_branch || "main"}
                  onChange={(event) => setForm((prev) => ({ ...prev, github_branch: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">
                  Token <span className="text-xs text-slate-500">(optional, for private repos)</span>
                </label>
                <input
                  type="password"
                  className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none focus:border-primary-500"
                  placeholder="ghp_..."
                  value={form.github_token || ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, github_token: event.target.value }))}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Live Application Section */}
      <div className="space-y-4">
        <div className="border-b border-slate-700 pb-2">
          <h3 className="text-base font-semibold text-slate-200">Live Application (Optional)</h3>
          <p className="text-xs text-slate-400 mt-1">Test a running application with dynamic analysis</p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300">
            Target URL
          </label>
          <input
            className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            placeholder="http://localhost:4000 or https://myapp.com"
            value={form.target_url || ""}
            onChange={(event) => setForm((prev) => ({ ...prev, target_url: event.target.value }))}
          />
          <p className="text-xs text-slate-500 mt-1.5">
            For DAST, fuzzing, and live vulnerability testing
          </p>
        </div>
      </div>

      {/* Scan Configuration */}
      <div>
        <label className="text-sm font-medium text-slate-300">Scan Mode</label>
        <select
          className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white cursor-pointer"
          value={form.mode}
          onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value }))}
        >
          {modes.map((mode) => (
            <option key={mode} value={mode} className="bg-slate-900">
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md bg-rose-500/10 border border-rose-500/50 p-3">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Starting scan..." : "Start Scan"}
      </button>
    </form>
  );
}
