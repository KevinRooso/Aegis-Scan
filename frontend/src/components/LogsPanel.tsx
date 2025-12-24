interface Props {
  logs: string[];
}

export function LogsPanel({ logs }: Props) {
  return (
    <div className="h-64 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm font-mono text-slate-300">
      {!logs.length && <p className="text-slate-500">Logs will show here once the scan starts.</p>}
      {logs.map((log, index) => (
        <p key={`${log}-${index}`} className="whitespace-pre-wrap">
          {log}
        </p>
      ))}
    </div>
  );
}
