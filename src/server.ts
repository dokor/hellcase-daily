import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { getAutomation, listAutomations } from "./automations/index.js";
import { config } from "./config.js";

const running = new Set<string>();

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function isAuthorized(request: IncomingMessage): boolean {
  if (!config.apiToken) return true;
  return request.headers.authorization === "Bearer " + config.apiToken;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (url.pathname === "/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (!isAuthorized(request)) {
    sendJson(response, 401, { ok: false, error: "Unauthorized" });
    return;
  }

  if (url.pathname === "/automations" && request.method === "GET") {
    sendJson(response, 200, { automations: listAutomations() });
    return;
  }

  if (url.pathname.startsWith("/run/") && request.method === "POST") {
    const automationId = decodeURIComponent(url.pathname.slice("/run/".length));
    const automation = getAutomation(automationId);

    if (!automation) {
      sendJson(response, 404, {
        ok: false,
        error: "Unknown automation: " + automationId,
      });
      return;
    }

    if (running.has(automationId)) {
      sendJson(response, 409, {
        ok: false,
        error: "Automation already running: " + automationId,
      });
      return;
    }

    running.add(automationId);

    try {
      const result = await automation.run();
      sendJson(response, result.ok ? 200 : 207, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, 500, {
        automation: automationId,
        ok: false,
        error: message,
      });
    } finally {
      running.delete(automationId);
    }

    return;
  }

  sendJson(response, 404, { ok: false, error: "Not found" });
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(
    "Browser automation worker listening on 0.0.0.0:" + config.port
  );
});
