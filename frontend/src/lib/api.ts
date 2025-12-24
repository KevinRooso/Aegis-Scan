import axios from "axios";

import type { ReportInfo, ScanRequest, ScanStatus } from "../types/api";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? "/api",
});

export interface ScanResponse {
  scan_id: string;
  status: ScanStatus;
}

export const startScan = async (payload: ScanRequest): Promise<ScanResponse> => {
  const { data } = await client.post<ScanResponse>("/scan/start", payload);
  return data;
};

export const fetchScanStatus = async (scanId: string): Promise<ScanStatus> => {
  const { data } = await client.get<ScanStatus>(`/scan/status/${scanId}`);
  return data;
};

export const fetchScanLogs = async (
  scanId: string
): Promise<{ scan_id: string; logs: string[] }> => {
  const { data } = await client.get(`/scan/logs/${scanId}`);
  return data;
};

export const fetchReport = async (scanId: string): Promise<ReportInfo> => {
  const { data } = await client.get<ReportInfo>(`/report/latest/${scanId}`);
  return data;
};
