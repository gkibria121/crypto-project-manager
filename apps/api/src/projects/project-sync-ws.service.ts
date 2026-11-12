import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type { SyncJobState, SyncLogEntry } from "@repo/shared";
import { createHash } from "node:crypto";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";

export type SyncWsMessage =
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

const WS_MAGIC_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function encodeWsTextFrame(payload: string): Buffer {
  const data = Buffer.from(payload, "utf8");
  const len = data.length;

  let header: Buffer;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[0] = 0x81; // FIN + text frame
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, data]);
}

@Injectable()
export class ProjectSyncWsService implements OnModuleDestroy {
  private readonly logger = new Logger(ProjectSyncWsService.name);
  private readonly clients = new Set<Duplex>();
  private pendingLogs: SyncLogEntry[] = [];
  private pendingState: Omit<SyncJobState, "logs"> | null = null;
  private pendingProjectsChanged = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  attachServer(
    server: HttpServer,
    getSnapshot: () => SyncJobState
  ): void {
    server.on(
      "upgrade",
      (req: IncomingMessage, socket: Duplex, _head: Buffer) => {
        const url = req.url ?? "";
        if (
          !url.startsWith("/ws/sync") &&
          !url.startsWith("/api/v1/projects/sync/ws")
        ) {
          return;
        }

        const key = req.headers["sec-websocket-key"];
        if (!key || typeof key !== "string") {
          socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
          socket.destroy();
          return;
        }

        const acceptKey = createHash("sha1")
          .update(key + WS_MAGIC_GUID)
          .digest("base64");

        const responseHeaders = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${acceptKey}`,
          "\r\n",
        ];

        socket.write(responseHeaders.join("\r\n"));
        if (
          "setNoDelay" in socket &&
          typeof (socket as { setNoDelay?: (noDelay?: boolean) => void })
            .setNoDelay === "function"
        ) {
          (socket as { setNoDelay: (noDelay?: boolean) => void }).setNoDelay(
            true
          );
        }
        this.clients.add(socket);

        const cleanup = () => {
          this.clients.delete(socket);
        };

        socket.on("close", cleanup);
        socket.on("end", cleanup);
        socket.on("error", cleanup);

        socket.on("data", (buffer: Buffer) => {
          if (buffer.length < 2) return;
          const opcode = buffer[0]! & 0x0f;
          if (opcode === 0x08) {
            // Client close frame
            cleanup();
            socket.end();
          } else if (opcode === 0x09) {
            // Ping -> Pong
            const pong = Buffer.from([0x8a, 0x00]);
            try {
              socket.write(pong);
            } catch {
              cleanup();
            }
          }
        });

        try {
          const initMsg: SyncWsMessage = {
            type: "sync:init",
            state: getSnapshot(),
          };
          socket.write(encodeWsTextFrame(JSON.stringify(initMsg)));
        } catch {
          cleanup();
        }
      }
    );

    this.logger.log("WebSocket sync stream attached at /ws/sync");
  }

  queueUpdate(
    state: Omit<SyncJobState, "logs">,
    newLogs: SyncLogEntry[] = [],
    projectsChanged = false,
    immediate = false
  ): void {
    this.pendingState = state;
    if (newLogs.length > 0) {
      this.pendingLogs.push(...newLogs);
      if (this.pendingLogs.length > 200) {
        this.pendingLogs = this.pendingLogs.slice(-200);
      }
    }
    if (projectsChanged) {
      this.pendingProjectsChanged = true;
    }

    if (immediate) {
      this.flush();
      return;
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, 100);
    }
  }

  broadcastCleared(state: SyncJobState): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.pendingLogs = [];
    this.pendingState = null;
    this.pendingProjectsChanged = false;
    this.broadcastRaw({
      type: "sync:cleared",
      state,
    });
  }

  private flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.pendingState) return;

    const msg: SyncWsMessage = {
      type: "sync:update",
      state: this.pendingState,
      newLogs: this.pendingLogs,
      projectsChanged: this.pendingProjectsChanged,
    };

    this.pendingLogs = [];
    this.pendingState = null;
    this.pendingProjectsChanged = false;

    this.broadcastRaw(msg);
  }

  private broadcastRaw(message: SyncWsMessage): void {
    if (this.clients.size === 0) return;
    const frame = encodeWsTextFrame(JSON.stringify(message));
    for (const client of this.clients) {
      if (client.destroyed || !client.writable) {
        this.clients.delete(client);
        continue;
      }
      try {
        client.write(frame);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  onModuleDestroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    for (const client of this.clients) {
      try {
        client.destroy();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }
}
