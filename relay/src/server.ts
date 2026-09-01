import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import crypto from "node:crypto";

const PORT = Number(process.env.RELAY_PORT ?? "80");
const TLS_PORT = Number(process.env.TLS_PORT ?? "443");
const TLS_CERT_PATH = process.env.TLS_CERT_PATH ?? "";
const TLS_KEY_PATH = process.env.TLS_KEY_PATH ?? "";
const UPSTREAM_ORIGIN = "https://api.weixin.qq.com";
const ALLOWED_PATH_PREFIXES = ["/cgi-bin/"];
const MAX_BODY_BYTES = 64 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 90_000;
const RELAY_TOKEN = process.env.RELAY_API_KEY ?? "";

if (!RELAY_TOKEN) {
  console.error(JSON.stringify({ t: new Date().toISOString(), event: "fatal", message: "RELAY_API_KEY is not set" }));
  process.exit(1);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length === bb.length) {
    return crypto.timingSafeEqual(ab, bb);
  }
  crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
  return false;
}

// Error messages from undici/fetch can embed the full request URL, which carries
// access_token / appSecret as query params. Strip every URL before it reaches logs.
function redactUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]");
}

function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...fields }));
}

type ForwardResult = { status: number; contentType: string | null; body: Buffer };

async function forwardUpstream(
  method: string,
  pathWithQuery: string,
  contentType: string | null,
  body: Buffer | null,
): Promise<ForwardResult> {
  const headers: Record<string, string> = {};
  if (body && body.length > 0) {
    if (contentType) headers["content-type"] = contentType;
    headers["content-length"] = String(body.length);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(`${UPSTREAM_ORIGIN}${pathWithQuery}`, {
      method,
      headers,
      body: body && body.length > 0 ? new Uint8Array(body) : undefined,
      signal: controller.signal,
      redirect: "error",
    });
    const buf = Buffer.from(await response.arrayBuffer());
    return { status: response.status, contentType: response.headers.get("content-type"), body: buf };
  } finally {
    clearTimeout(timer);
  }
}

function readBody(req: http.IncomingMessage, limit: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    req.on("data", (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        settled = true;
        chunks.length = 0;
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });
    req.on("error", () => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    });
  });
}

// Calls the token endpoint with a dummy secret; WeChat rejects with 40164 whose
// errmsg names the exact egress IP it observed. The IP whitelist is checked after
// appid existence but before secret validation, so pass a real appid (never the
// secret) to see 40164; a fake appid stops at 40013 invalid appid instead.
async function handleEgressCheck(appid: string): Promise<{ status: number; payload: Record<string, unknown> }> {
  const result = await forwardUpstream(
    "GET",
    `/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=egress-check`,
    null,
    null,
  );
  let parsed: { errcode?: number; errmsg?: string } = {};
  try {
    parsed = JSON.parse(result.body.toString("utf8")) as { errcode?: number; errmsg?: string };
  } catch {
    return { status: 502, payload: { error: "unexpected_upstream_response" } };
  }
  const match = /invalid ip ([0-9a-fA-F.:]+)/.exec(parsed.errmsg ?? "");
  return {
    status: 200,
    payload: {
      egressIp: match ? match[1] : null,
      errcode: parsed.errcode ?? null,
      errmsg: parsed.errmsg ?? null,
    },
  };
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const started = Date.now();
  const method = (req.method ?? "GET").toUpperCase();
  let path = "/";
  let search = "";
  let appidParam: string | null = null;
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    path = url.pathname;
    search = url.search;
    appidParam = url.searchParams.get("appid");
  } catch {
    res.destroy();
    return;
  }

  const respond = (status: number, body: Buffer | string, contentType = "application/json; charset=utf-8") => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const payload = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    res.writeHead(status, { "content-type": contentType, "content-length": String(payload.length) });
    res.end(payload);
  };

  try {
    if (path === "/healthz" && method === "GET") {
      respond(200, JSON.stringify({ ok: true }));
      return;
    }

    const token = req.headers["x-relay-token"];
    const tokenOk = typeof token === "string" && timingSafeEqualStr(token, RELAY_TOKEN);
    if (!tokenOk) {
      log("auth_rejected", { method, path });
      respond(401, JSON.stringify({ error: "unauthorized" }));
      return;
    }

    if (path === "/debug/egress-ip" && method === "GET") {
      const result = await handleEgressCheck(appidParam ?? "egress-check");
      log("egress_check", { ms: Date.now() - started });
      respond(result.status, JSON.stringify(result.payload));
      return;
    }

    if (!ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      log("path_rejected", { method, path });
      respond(404, JSON.stringify({ error: "not_found" }));
      return;
    }

    if (method !== "GET" && method !== "POST") {
      respond(405, JSON.stringify({ error: "method_not_allowed" }));
      return;
    }

    let body: Buffer | null = null;
    if (method === "POST") {
      body = await readBody(req, MAX_BODY_BYTES);
      if (body === null) {
        log("body_rejected", { method, path });
        respond(413, JSON.stringify({ error: "payload_too_large" }));
        return;
      }
    }

    const contentTypeHeader = req.headers["content-type"];
    const upstream = await forwardUpstream(
      method,
      path + search,
      typeof contentTypeHeader === "string" ? contentTypeHeader : null,
      body,
    );

    log("forwarded", {
      method,
      path,
      status: upstream.status,
      ms: Date.now() - started,
      bytes: upstream.body.length,
    });
    respond(upstream.status, upstream.body, upstream.contentType ?? "application/json; charset=utf-8");
  } catch (error) {
    const message = error instanceof Error ? redactUrls(error.message) : "unknown_error";
    log("upstream_error", { method, path, ms: Date.now() - started, message });
    respond(502, JSON.stringify({ error: "bad_gateway" }));
  }
}

function tune(server: http.Server): http.Server {
  server.requestTimeout = 300_000;
  server.headersTimeout = 120_000;
  server.keepAliveTimeout = 65_000;
  return server;
}

const httpServer = tune(http.createServer(handleRequest));
const servers: http.Server[] = [httpServer];
httpServer.listen(PORT, "0.0.0.0", () => {
  log("listening", { port: PORT });
});

// Optional TLS listener for Cloudflare Full (strict) origin pulls. Enabled only
// when both cert paths resolve; keeps local/dev runs HTTP-only without certs.
if (TLS_CERT_PATH && TLS_KEY_PATH) {
  try {
    const tlsServer = tune(
      https.createServer(
        {
          cert: fs.readFileSync(TLS_CERT_PATH),
          key: fs.readFileSync(TLS_KEY_PATH),
        },
        handleRequest,
      ),
    );
    tlsServer.listen(TLS_PORT, "0.0.0.0", () => {
      log("listening_tls", { port: TLS_PORT });
    });
    servers.push(tlsServer);
  } catch (error) {
    log("tls_disabled", {
      reason: error instanceof Error ? redactUrls(error.message) : "unknown_error",
    });
  }
}

process.on("SIGTERM", () => {
  log("sigterm");
  let pending = servers.length;
  for (const server of servers) {
    server.close(() => {
      if (--pending === 0) process.exit(0);
    });
  }
  setTimeout(() => process.exit(0), 5_000).unref();
});
