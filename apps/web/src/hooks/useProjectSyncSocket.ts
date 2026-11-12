"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, getSyncWebSocketUrl } from "@/services/apiClient";
import type {
  SyncJobState,
  SyncLogEntry,
  SyncProjectsDto,
} from "@/types/project";
import { queryKeys } from "./useServerState";

const MAX_CLIENT_LOGS = 200;
const PROJECT_REFRESH_THROTTLE_MS = 2500;

const INITIAL_SYNC_JOB_STATE: SyncJobState = {
  isRunning: false,
  isFetchingBatch: false,
  provider: "coingecko",
  providerName: null,
  limit: 50,
  noLimit: false,
  continuous: true,
  currentPage: 1,
  countdownSeconds: null,
  totalCreated: 0,
  totalUpdated: 0,
  pagesCompleted: 0,
  lastError: null,
  logs: [],
};

type IncomingWsMessage =
  | {
      type: "sync:init";
      state: SyncJobState;
    }
  | {
      type: "sync:update";
      state: Omit<SyncJobState, "logs">;
      newLogs: SyncLogEntry[];
      projectsChanged: boolean;
    }
  | {
      type: "sync:cleared";
      state: SyncJobState;
    };

export function useProjectSyncSocket(enabled = true) {
  const queryClient = useQueryClient();
  const [jobState, setJobState] = useState<SyncJobState>(
    INITIAL_SYNC_JOB_STATE
  );
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const wasRunningRef = useRef<boolean>(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const pendingRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const scheduleProjectsRefresh = useCallback(
    (immediate = false) => {
      const doRefresh = () => {
        lastRefreshTimeRef.current = Date.now();
        startTransition(() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.projects.all,
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.users.auditLogs,
          });
        });
      };

      if (immediate) {
        if (pendingRefreshTimerRef.current) {
          clearTimeout(pendingRefreshTimerRef.current);
          pendingRefreshTimerRef.current = null;
        }
        doRefresh();
        return;
      }

      const elapsed = Date.now() - lastRefreshTimeRef.current;
      if (elapsed >= PROJECT_REFRESH_THROTTLE_MS) {
        doRefresh();
      } else if (!pendingRefreshTimerRef.current) {
        pendingRefreshTimerRef.current = setTimeout(() => {
          pendingRefreshTimerRef.current = null;
          doRefresh();
        }, PROJECT_REFRESH_THROTTLE_MS - elapsed);
      }
    },
    [queryClient]
  );

  // Connect to WebSocket for real-time sync state & log streaming
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    // Fetch initial snapshot over HTTP so state is ready immediately
    void apiClient
      .fetchSyncStatus()
      .then((snapshot) => {
        if (disposed) return;
        wasRunningRef.current = snapshot.isRunning;
        setJobState({
          ...snapshot,
          logs: snapshot.logs.slice(-MAX_CLIENT_LOGS),
        });
      })
      .catch(() => {
        // Ignore initial status error if not ready
      });

    function connect() {
      if (disposed) return;

      try {
        const wsUrl = getSyncWebSocketUrl();
        ws = new WebSocket(wsUrl);
      } catch {
        reconnectTimer = setTimeout(connect, 2500);
        return;
      }

      ws.onopen = () => {
        if (disposed) return;
        setWsConnected(true);
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send("ping");
            } catch {
              // ignore
            }
          }
        }, 25_000);
      };

      ws.onmessage = (event) => {
        if (disposed || typeof event.data !== "string") return;
        try {
          const parsed = JSON.parse(event.data) as IncomingWsMessage;
          if (parsed.type === "sync:init" || parsed.type === "sync:cleared") {
            const nextRunning = parsed.state.isRunning;
            const justFinished = wasRunningRef.current && !nextRunning;
            wasRunningRef.current = nextRunning;

            startTransition(() => {
              setJobState({
                ...parsed.state,
                logs: parsed.state.logs.slice(-MAX_CLIENT_LOGS),
              });
            });

            if (justFinished) {
              scheduleProjectsRefresh(true);
            }
          } else if (parsed.type === "sync:update") {
            const nextRunning = parsed.state.isRunning;
            const justFinished = wasRunningRef.current && !nextRunning;
            wasRunningRef.current = nextRunning;

            startTransition(() => {
              setJobState((prev) => {
                const combinedLogs =
                  parsed.newLogs.length > 0
                    ? [...prev.logs, ...parsed.newLogs].slice(-MAX_CLIENT_LOGS)
                    : prev.logs;
                return {
                  ...parsed.state,
                  logs: combinedLogs,
                };
              });
            });

            if (justFinished) {
              scheduleProjectsRefresh(true);
            } else if (parsed.projectsChanged) {
              scheduleProjectsRefresh(false);
            }
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onclose = () => {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (disposed) return;
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          // ignore
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (pendingRefreshTimerRef.current) {
        clearTimeout(pendingRefreshTimerRef.current);
        pendingRefreshTimerRef.current = null;
      }
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [enabled, scheduleProjectsRefresh]);

  // Fallback polling only if WebSocket is disconnected while a job is active
  useEffect(() => {
    if (!enabled || wsConnected) return;

    const timer = setInterval(() => {
      void apiClient
        .fetchSyncStatus()
        .then((snapshot) => {
          const justFinished = wasRunningRef.current && !snapshot.isRunning;
          wasRunningRef.current = snapshot.isRunning;
          startTransition(() => {
            setJobState({
              ...snapshot,
              logs: snapshot.logs.slice(-MAX_CLIENT_LOGS),
            });
          });
          if (justFinished || snapshot.isRunning) {
            scheduleProjectsRefresh(justFinished);
          }
        })
        .catch(() => {
          // ignore
        });
    }, 1500);

    return () => clearInterval(timer);
  }, [enabled, wsConnected, scheduleProjectsRefresh]);

  const applySnapshot = useCallback((snapshot: SyncJobState) => {
    wasRunningRef.current = snapshot.isRunning;
    setJobState({
      ...snapshot,
      logs: snapshot.logs.slice(-MAX_CLIENT_LOGS),
    });
  }, []);

  const startSync = useCallback(
    async (dto: SyncProjectsDto) => {
      const snapshot = await apiClient.startAsyncProjectSync(dto);
      applySnapshot(snapshot);
      return snapshot;
    },
    [applySnapshot]
  );

  const stopSync = useCallback(async () => {
    const snapshot = await apiClient.stopAsyncProjectSync();
    applySnapshot(snapshot);
    scheduleProjectsRefresh(true);
    return snapshot;
  }, [applySnapshot, scheduleProjectsRefresh]);

  const triggerNextPage = useCallback(async () => {
    const snapshot = await apiClient.triggerNextSyncPage();
    applySnapshot(snapshot);
    return snapshot;
  }, [applySnapshot]);

  const resetCursor = useCallback(async () => {
    const snapshot = await apiClient.resetProjectSyncCursor();
    applySnapshot(snapshot);
    return snapshot;
  }, [applySnapshot]);

  const clearLogs = useCallback(async () => {
    const snapshot = await apiClient.clearProjectSyncLogs();
    applySnapshot(snapshot);
    return snapshot;
  }, [applySnapshot]);

  return {
    jobState,
    wsConnected,
    startSync,
    stopSync,
    triggerNextPage,
    resetCursor,
    clearLogs,
  };
}
