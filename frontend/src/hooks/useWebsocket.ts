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
      console.log('[WebSocket] No scanId provided, skipping connection');
      return;
    }
    const wsUrl = `${backendBase.replace(/^http/, "ws").replace(/\/$/, "")}/ws/${scanId}`;
    console.log(`[WebSocket] Connecting to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[WebSocket] Connected successfully to scan ${scanId}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WebSocket] Received message:', data);
        if (onMessage) {
          // Pass the entire message - handler will decide what to do with it
          // For scan status updates, data will have a 'status' field
          // For voice focus commands, data will have 'type', 'action', 'data'
          onMessage(data?.status ? data.status : data);
        }
      } catch (error) {
        console.error("Failed to parse websocket payload", error);
      }
    };

    ws.onerror = (event) => {
      console.error(`[WebSocket] Error on scan ${scanId}:`, event);
    };

    ws.onclose = () => {
      console.log(`[WebSocket] Connection closed for scan ${scanId}`);
    };

    return () => {
      console.log(`[WebSocket] Cleaning up connection for scan ${scanId}`);
      ws.close();
      wsRef.current = null;
    };
  }, [scanId, onMessage]);
}
