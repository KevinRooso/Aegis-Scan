export type AgentName =
  | "static"
  | "dependency"
  | "secret"
  | "fuzzer"
  | "dast"
  | "template"
  | "adaptive"
  | "threat"
  | "report";

export type AgentStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface AgentProgress {
  agent: AgentName;
  status: AgentStatus;
  started_at?: string;
  ended_at?: string;
  percent_complete: number;
  message?: string;
}

export interface Finding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  description: string;
  remediation: string;
  source_agent: AgentName;
  metadata: Record<string, unknown>;
}

export type VoiceEventType =
  | "greeting"
  | "agent_start"
  | "finding"
  | "completion"
  | "thinking";

export interface VoiceEvent {
  scan_id: string;
  event_type: VoiceEventType;
  message: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ScanStatus {
  scan_id: string;
  target: string;
  mode: string;
  created_at: string;
  progress: AgentProgress[];
  findings: Finding[];
  logs: string[];
  voice_events?: VoiceEvent[];
  github_url?: string;
  github_branch?: string;
  target_url?: string;
  workspace_path?: string;
}

export interface ScanRequest {
  // Source configuration (at least one required)
  github_url?: string;
  github_branch?: string;
  github_token?: string;

  // Target configuration (optional - for dynamic scanning)
  target_url?: string;

  // Legacy support (deprecated)
  target?: string;

  // Scan configuration
  mode?: string;
  no_docker?: boolean;
  out_dir?: string;
  max_memory?: number;
  concurrency?: number;
  enabled_agents?: string[];
  scan_name?: string;
}

export interface ReportInfo {
  scan_id: string;
  report_path: string;
  report_url: string;
  pdf_path?: string | null;
  pdf_url?: string | null;
  pdf_available: boolean;
}
