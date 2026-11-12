"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import type {
  CreateMcpServerDto,
  McpOverview,
  McpServerStatus,
} from "@/types/project";

interface McpServersPanelProps {
  mcpOverview?: McpOverview;
  canEdit: boolean;
  onCreateServer: (dto: CreateMcpServerDto) => Promise<unknown>;
  onToggleServer: (serverId: string, isEnabled: boolean) => Promise<unknown>;
  onRefreshServer: (serverId: string) => Promise<unknown>;
  onDeleteServer: (serverId: string) => Promise<unknown>;
}

export function McpServersPanel({
  mcpOverview,
  canEdit,
  onCreateServer,
  onToggleServer,
  onRefreshServer,
  onDeleteServer,
}: McpServersPanelProps) {
  const servers = mcpOverview?.servers ?? [];
  const totalTools = mcpOverview?.totalTools ?? 0;

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    "pulseos-builtin": true,
  });
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<"streamable_http" | "sse">(
    "streamable_http"
  );
  const [authHeader, setAuthHeader] = useState("");
  const [description, setDescription] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddServer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!name.trim() || !url.trim()) {
      setErrorMessage("Server name and HTTP(S) endpoint URL are required.");
      return;
    }

    setIsAdding(true);
    try {
      await onCreateServer({
        name: name.trim(),
        url: url.trim(),
        transport,
        ...(authHeader.trim() ? { authHeader: authHeader.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        isEnabled: true,
      });
      setName("");
      setUrl("");
      setAuthHeader("");
      setDescription("");
      setStatusMessage(
        "External MCP server added and tool discovery completed."
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to register MCP server."
      );
    } finally {
      setIsAdding(false);
    }
  };

  const runServerAction = async (
    server: McpServerStatus,
    action: () => Promise<unknown>,
    successMsg: string
  ) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setBusyId(server.id);
    try {
      await action();
      setStatusMessage(successMsg);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "MCP server action failed."
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-[#e7f3ff]/60 dark:bg-[#0084ff]/10 border border-[#0084ff]/20 px-3 py-2.5 text-xs text-[#050505] dark:text-[#d1d7db] space-y-1">
        <div className="flex items-center justify-between gap-2 font-semibold text-[#0084ff] dark:text-[#4599ff]">
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Model Context Protocol (MCP) Integration</span>
          </span>
          <span className="font-mono text-[11px]">
            {servers.filter((s) => s.isEnabled && s.status === "connected").length}{" "}
            active · {totalTools} tools
          </span>
        </div>
        <p className="text-[11px] text-[#65676b] dark:text-[#8696a0] leading-relaxed">
          The chatbot knows all connected MCP tools from the beginning of every
          chat. Use{" "}
          <code className="font-mono text-[#050505] dark:text-[#e9edef]">
            @context
          </code>{" "}
          for company info or{" "}
          <code className="font-mono text-[#050505] dark:text-[#e9edef]">
            @linkedin
          </code>
          ,{" "}
          <code className="font-mono text-[#050505] dark:text-[#e9edef]">
            @website
          </code>
          ,{" "}
          <code className="font-mono text-[#050505] dark:text-[#e9edef]">
            @x
          </code>
          ,{" "}
          <code className="font-mono text-[#050505] dark:text-[#e9edef]">
            @telegram
          </code>
          ,{" "}
          <code className="font-mono text-[#050505] dark:text-[#e9edef]">
            @scrape
          </code>{" "}
          in chat to query backend contexts or scrape links via your Python
          scraper.
        </p>
      </div>

      <div aria-live="polite" className="space-y-2">
        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 font-medium"
          >
            {errorMessage}
          </div>
        )}
        {statusMessage && (
          <div className="rounded-xl bg-emerald-500/12 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
            {statusMessage}
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {servers.map((server) => {
          const isExpanded = Boolean(expandedIds[server.id]);
          const isBusy = busyId === server.id;

          return (
            <div
              key={server.id}
              className="rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(server.id)}
                  className="flex items-start gap-2 text-left min-w-0 flex-1 cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-[#65676b]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-[#65676b]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Server
                        className="w-3.5 h-3.5 text-[#0084ff] shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-bold text-[#050505] dark:text-[#e9edef] truncate">
                        {server.name}
                      </span>
                      {server.isBuiltIn && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]">
                          Built-in
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          server.status === "connected"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : server.status === "error"
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                              : "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {server.status === "connected" ? (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        ) : (
                          <XCircle className="w-2.5 h-2.5" />
                        )}
                        <span>{server.status}</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#65676b] dark:text-[#8696a0]">
                        {server.tools.length} tool
                        {server.tools.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {server.description && (
                      <p className="mt-0.5 text-[11px] text-[#65676b] dark:text-[#8696a0]">
                        {server.description}
                      </p>
                    )}
                    {server.url && (
                      <p className="mt-0.5 text-[10px] font-mono text-[#65676b] dark:text-[#8696a0] truncate">
                        {server.transport}: {server.url}
                      </p>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {canEdit && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void runServerAction(
                          server,
                          () => onRefreshServer(server.id),
                          `Refreshed MCP tools from "${server.name}".`
                        )
                      }
                      title="Refresh tools/list from MCP server"
                      className="p-1.5 rounded-lg text-[#65676b] hover:text-[#0084ff] dark:text-[#8696a0] dark:hover:text-[#4599ff] disabled:opacity-50 transition cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isBusy ? "animate-spin" : ""}`}
                      />
                    </button>
                  )}
                  {canEdit && !server.isBuiltIn && (
                    <>
                      <label className="inline-flex items-center gap-1 text-[10px] font-medium text-[#65676b] dark:text-[#d1d7db] cursor-pointer px-1">
                        <input
                          type="checkbox"
                          checked={server.isEnabled}
                          disabled={isBusy}
                          onChange={(e) =>
                            void runServerAction(
                              server,
                              () => onToggleServer(server.id, e.target.checked),
                              `${server.name} ${e.target.checked ? "enabled" : "disabled"}.`
                            )
                          }
                          className="checkbox-native"
                        />
                        <span>On</span>
                      </label>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void runServerAction(
                            server,
                            () => onDeleteServer(server.id),
                            `Removed external MCP server "${server.name}".`
                          )
                        }
                        title="Remove external MCP server"
                        className="p-1.5 rounded-lg text-[#65676b] hover:text-rose-600 dark:text-[#8696a0] dark:hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {server.lastError && (
                <div className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-700 dark:text-rose-300">
                  {server.lastError}
                </div>
              )}

              {isExpanded && (
                <div className="pt-1.5 border-t border-[#e4e6eb] dark:border-[#374045] space-y-1.5">
                  {server.tools.length === 0 ? (
                    <p className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
                      No tools discovered yet.
                    </p>
                  ) : (
                    server.tools.map((tool) => (
                      <div
                        key={tool.qualifiedName}
                        className="rounded-lg bg-white dark:bg-[#111b21] px-2.5 py-2 space-y-0.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <Wrench
                            className="w-3 h-3 text-[#00a884] shrink-0"
                            aria-hidden="true"
                          />
                          <code className="text-[11px] font-mono font-semibold text-[#050505] dark:text-[#e9edef]">
                            {tool.qualifiedName}
                          </code>
                        </div>
                        {tool.description && (
                          <p className="text-[11px] text-[#65676b] dark:text-[#8696a0] leading-snug">
                            {tool.description}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <form
          onSubmit={handleAddServer}
          className="p-3.5 rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] space-y-2.5"
        >
          <span className="block text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
            Connect External MCP Server (Streamable HTTP / SSE)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Server Name (e.g., LinkedIn MCP)"
              className="px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
            />
            <select
              value={transport}
              onChange={(e) =>
                setTransport(e.target.value as "streamable_http" | "sse")
              }
              aria-label="MCP transport protocol"
              className="px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
            >
              <option value="streamable_http">Streamable HTTP</option>
              <option value="sse">SSE (Legacy MCP)</option>
            </select>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mcp.example.com/mcp"
              className="px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="password"
              value={authHeader}
              onChange={(e) => setAuthHeader(e.target.value)}
              placeholder="Optional Bearer token / Authorization header"
              className="px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isAdding}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAdding ? "Connecting..." : "Add MCP Server"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
