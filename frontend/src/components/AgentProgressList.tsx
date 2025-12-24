import * as Progress from "@radix-ui/react-progress";
import { clsx } from "clsx";

import type { AgentProgress } from "../types/api";

interface Props {
  items: AgentProgress[];
}

const statusColors: Record<AgentProgress["status"], string> = {
  pending: "bg-slate-700",
  running: "bg-primary-500",
  completed: "bg-emerald-500",
  failed: "bg-rose-500",
  skipped: "bg-amber-400",
};

export function AgentProgressList({ items }: Props) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.agent} className="rounded-lg border border-slate-800 p-3">
          <div className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-slate-300">
            <span>{item.agent}</span>
            <span>{item.status}</span>
          </div>
          <Progress.Root className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-800" value={item.percent_complete}>
            <Progress.Indicator
              className={clsx("h-full w-full transition-all", statusColors[item.status])}
              style={{ transform: `translateX(${item.percent_complete - 100}%)` }}
            />
          </Progress.Root>
          {item.message && <p className="mt-2 text-xs text-slate-400">{item.message}</p>}
        </div>
      ))}
    </div>
  );
}
