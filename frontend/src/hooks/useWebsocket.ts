import { useEffect, useRef } from "react";

import type { ScanStatus } from "../types/api";

interface UseWebsocketOptions {
  scanId?: string;
  onMessage?: (status: ScanStatus) => void;
}

const backendBase = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

export function useScanWebsocket({ scanId, onMessage }: UseWebsocketOptions): void {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!scanId) {
      return;
    }
    const ws = new WebSocket(
      `${backendBase.replace(/^http/, "ws").replace(/\/$/, "")}/ws/${scanId}`,
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.status && onMessage) {
          onMessage(data.status as ScanStatus);
        }
      } catch (error) {
        console.error("Failed to parse websocket payload", error);
      }
    };

    ws.onerror = (event) => {
      console.error("Websocket error", event);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [scanId, onMessage]);
}
