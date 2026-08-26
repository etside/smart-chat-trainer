import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import * as handler from "./dist/server/server.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_DIR = join(__dirname, "dist", "client");
const port = process.env.PORT || 3000;

const MIME = {".css":"text/css",".js":"application/javascript",".mjs":"application/javascript",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".gif":"image/gif",".svg":"image/svg+xml",".ico":"image/x-icon",".woff":"font/woff",".woff2":"font/woff2",".ttf":"font/ttf",".webp":"image/webp"};

function collectBody(req){return new Promise(r=>{const c=[];req.on("data",d=>c.push(d));req.on("end",()=>r(Buffer.concat(c)))})}

async function serveStatic(path,res){try{const d=await readFile(join(CLIENT_DIR,path));const e=extname(path);res.writeHead(200,{"Content-Type":MIME[e]||"application/octet-stream","Cache-Control":(e===".css"||e===".js")?"public,max-age=31536000,immutable":"public,max-age=3600"});res.end(d);return true}catch{return false}}

// ---------------------------------------------------------------------------
// WebSocket chat server
// ---------------------------------------------------------------------------
// Lightweight WebSocket implementation using Node.js built-in http upgrade.
// No external dependencies required.

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-5AB9FC1B7B07";
import { createHash } from "crypto";

/** Active chat sessions: conversationId -> { ws, userId, lastActivity } */
const activeSessions = new Map();

/** Rate limiting: ip -> { count, resetAt } */
const rateLimits = new Map();
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX = 30; // max messages per window

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_MAX;
}

function acceptWebSocket(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) { socket.destroy(); return null; }

  const accept = createHash("sha1")
    .update(key + WS_MAGIC)
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  return socket;
}

function encodeWsFrame(data) {
  const payload = Buffer.from(typeof data === "string" ? data : JSON.stringify(data));
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function decodeWsFrame(buffer) {
  if (buffer.length < 2) return null;
  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const opcode = firstByte & 0x0f;
  const masked = (secondByte & 0x80) !== 0;
  let payloadLen = secondByte & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buffer.length < 4) return null;
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null;
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let mask = null;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    mask = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + payloadLen) return null;
  const payload = Buffer.from(buffer.slice(offset, offset + payloadLen));

  if (mask) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= mask[i % 4];
    }
  }

  return { opcode, payload, totalLen: offset + payloadLen };
}

/**
 * Process a chat message through the sales pipeline.
 * Calls the internal REST API to reuse the same logic.
 */
async function processWsChatMessage(message, conversationId, history, apiKey) {
  const res = await fetch(`http://127.0.0.1:${port}/api/public/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      history: history || [],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat API failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    reply: data.reply || "Sorry, I could not generate a reply.",
    sentiment: data.sentiment,
    leadScore: data.lead_score,
    leadTier: data.lead_tier,
    escalated: data.escalated,
    signals: data.signals,
  };
}

function handleWsUpgrade(req, socket, head) {
  const url = new URL(req.url, "http://localhost");

  // Only handle /ws/chat
  if (url.pathname !== "/ws/chat") {
    socket.destroy();
    return;
  }

  // Rate limit by IP
  const ip = req.headers["x-real-ip"] || req.socket.remoteAddress;
  if (!checkRateLimit(ip)) {
    socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
    socket.destroy();
    return;
  }

  const ws = acceptWebSocket(req, socket);
  if (!ws) return;

  const conversationId = url.searchParams.get("conversation_id") || randomUUID();
  const apiKey = url.searchParams.get("api_key") || "";

  // Validate API key (same as REST endpoint)
  import("./dist/server/assets/client.server-D9zXSXxA.js").then(async (mod) => {
    // We'll validate on first message instead of at connection time
    // to keep connection fast
  }).catch(() => {});

  const session = {
    ws,
    conversationId,
    apiKey,
    history: [],
    connectedAt: Date.now(),
    lastActivity: Date.now(),
    messageCount: 0,
  };
  activeSessions.set(conversationId, session);

  // Send connection confirmation
  ws.write(encodeWsFrame(JSON.stringify({
    type: "connected",
    conversation_id: conversationId,
    message: "Connected to Daddy AI chat",
  })));

  let buffer = Buffer.alloc(0);

  ws.on("data", async (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Process complete frames
    while (buffer.length > 0) {
      const frame = decodeWsFrame(buffer);
      if (!frame) break;

      buffer = buffer.slice(frame.totalLen);

      if (frame.opcode === 0x08) {
        // Close frame
        ws.write(encodeWsFrame({ type: "close" }));
        ws.end();
        activeSessions.delete(conversationId);
        return;
      }

      if (frame.opcode === 0x09) {
        // Ping - send pong
        ws.write(encodeWsFrame({ type: "pong" }));
        continue;
      }

      if (frame.opcode !== 0x01) continue; // Only text frames

      let msg;
      try {
        msg = JSON.parse(frame.payload.toString());
      } catch {
        ws.write(encodeWsFrame(JSON.stringify({ type: "error", error: "Invalid JSON" })));
        continue;
      }

      session.lastActivity = Date.now();
      session.messageCount++;

      // Handle different message types
      if (msg.type === "chat") {
        const userMessage = msg.message?.trim();
        if (!userMessage) {
          ws.write(encodeWsFrame(JSON.stringify({ type: "error", error: "Empty message" })));
          continue;
        }

        // Rate limit per conversation
        if (!checkRateLimit(`ws:${conversationId}`)) {
          ws.write(encodeWsFrame(JSON.stringify({
            type: "error",
            error: "Rate limit exceeded. Please wait before sending more messages.",
          })));
          continue;
        }

        // Send typing indicator
        ws.write(encodeWsFrame(JSON.stringify({ type: "typing", status: true })));

        try {
          const result = await processWsChatMessage(
            userMessage,
            conversationId,
            session.history,
            session.apiKey
          );

          // Add to conversation history
          session.history.push({ role: "user", content: userMessage });
          session.history.push({ role: "assistant", content: result.reply });

          // Keep history manageable (last 20 turns)
          if (session.history.length > 40) {
            session.history = session.history.slice(-40);
          }

          // Send response
          ws.write(encodeWsFrame(JSON.stringify({
            type: "reply",
            reply: result.reply,
            conversation_id: conversationId,
            sentiment: result.sentiment,
            lead_score: result.leadScore,
            lead_tier: result.leadTier,
            escalated: result.escalated,
            signals: result.signals,
            message_count: session.messageCount,
          })));

        } catch (err) {
          console.error("WS chat error:", err);
          ws.write(encodeWsFrame(JSON.stringify({
            type: "error",
            error: "Failed to generate reply. Please try again.",
          })));
        }

      } else if (msg.type === "ping") {
        ws.write(encodeWsFrame(JSON.stringify({ type: "pong", timestamp: Date.now() })));

      } else if (msg.type === "history") {
        ws.write(encodeWsFrame(JSON.stringify({
          type: "history",
          history: session.history,
          message_count: session.messageCount,
        })));
      }
    }
  });

  ws.on("close", () => {
    activeSessions.delete(conversationId);
    console.log(`WS closed: ${conversationId} (${session.messageCount} messages)`);
  });

  ws.on("error", (err) => {
    console.error(`WS error [${conversationId}]:`, err.message);
    activeSessions.delete(conversationId);
  });
}

// ---------------------------------------------------------------------------
// Cleanup stale sessions every 5 minutes
// ---------------------------------------------------------------------------
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    if (now - session.lastActivity > 30 * 60_000) { // 30 min idle
      try { session.ws.end(); } catch {}
      activeSessions.delete(id);
    }
  }
  // Clean rate limits
  for (const [ip, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(ip);
  }
}, 5 * 60_000);

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://" + req.headers.host);
    const ext = extname(url.pathname);

    // Static assets
    if (url.pathname.startsWith("/assets/") || MIME[ext]) {
      if (await serveStatic(url.pathname, res)) return;
    }

    // Health check
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        uptime: process.uptime(),
        active_ws_sessions: activeSessions.size,
      }));
      return;
    }

    // WS stats (admin only - protected by Nginx)
    if (url.pathname === "/ws/stats") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        active_sessions: activeSessions.size,
        sessions: Array.from(activeSessions.values()).map(s => ({
          conversation_id: s.conversationId,
          message_count: s.messageCount,
          connected_at: s.connectedAt,
          last_activity: s.lastActivity,
        })),
      }));
      return;
    }

    // Proxy to TanStack Start handler
    const h = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v) h[k] = Array.isArray(v) ? v.join(", ") : v;
    }
    const body = ["GET", "HEAD"].includes(req.method) ? undefined : await collectBody(req);
    const request = new Request(url.toString(), { method: req.method, headers: h, body });
    const sh = handler.default ?? handler;
    const fn = sh.fetch ?? sh.default?.fetch;
    const response = await fn.call(sh, request, process.env, {});
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("Server error:", err);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

// Handle WebSocket upgrades
server.on("upgrade", handleWsUpgrade);

server.listen(port, "0.0.0.0", () => {
  console.log(`Daddy AI listening on http://localhost:${port}/`);
  console.log(`WebSocket chat available at ws://localhost:${port}/ws/chat`);
});
