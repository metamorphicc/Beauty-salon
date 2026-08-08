import "../bot/env.js";
import { handleUpdate, setupCommandMenus } from "../bot/index.js";
import { optionalEnv, requireEnv } from "../bot/env.js";

let commandMenuReady = false;

function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

function isAuthorizedTelegramRequest(request) {
  const secret = optionalEnv("TELEGRAM_WEBHOOK_SECRET");
  if (!secret) {
    return true;
  }

  return request.headers["x-telegram-bot-api-secret-token"] === secret;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { ok: false, message: "Method not allowed" });
    return;
  }

  if (!isAuthorizedTelegramRequest(request)) {
    sendJson(response, 401, { ok: false, message: "Unauthorized" });
    return;
  }

  try {
    requireEnv("TELEGRAM_BOT_TOKEN");

    if (!commandMenuReady) {
      try {
        await setupCommandMenus();
        commandMenuReady = true;
      } catch (error) {
        console.error(`Telegram command menu setup failed: ${error.message}`);
      }
    }

    const update = typeof request.body === "string" ? JSON.parse(request.body) : request.body || {};
    await handleUpdate(update);
    sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error(`Telegram webhook failed: ${error.message}`);
    sendJson(response, 200, { ok: true, handled: false });
  }
}
