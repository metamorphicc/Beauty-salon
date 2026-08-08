import "dotenv/config";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { saveLead } from "./bot/leads.js";
import { optionalEnv } from "./bot/env.js";
import { callbackButton, keyboard, sendMessage } from "./bot/telegram.js";
import { services } from "./bot/catalog.js";
import { formatDateTime } from "./bot/leadFormat.js";
import { sendLeadToN8n } from "./bot/n8n.js";

const root = resolve(".");
const port = Number(process.env.PORT || 3000);
const adminChatId = optionalEnv("ADMIN_CHAT_ID");
const siteOrigin = optionalEnv("SITE_ORIGIN");
const maxBodyBytes = 16 * 1024;
const rateLimitWindowMs = 60 * 1000;
const rateLimitMax = 8;
const rateLimits = new Map();
const landingServiceAliases = ["Стрижка", "Окрашивание", "Маникюр", "Брови", "Уход лица"];
const allowedServices = new Set([
  ...services.map((service) => service.title),
  ...landingServiceAliases,
]);
const publicFiles = new Set(["index.html", "styles.css", "app.js"]);
const publicDirs = ["assets"];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function setCors(response) {
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (siteOrigin && origin === siteOrigin) {
    return true;
  }

  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  setCors(response);

  if (isAllowedOrigin(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin || `http://localhost:${port}`);
  }
}

function json(response, statusCode, body) {
  setCors(response);
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  if (!String(request.headers["content-type"] || "").includes("application/json")) {
    const error = new Error("Неверный тип запроса.");
    error.statusCode = 415;
    throw error;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error("Слишком большой запрос.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanName(value) {
  return cleanText(value)
    .replace(/[^\p{L}' -]/gu, "")
    .replace(/\s{2,}/g, " ")
    .replace(/-{2,}/g, "-")
    .slice(0, 40);
}

function cleanPhone(value) {
  const text = cleanText(value);
  const hasPlus = text.startsWith("+");
  const digits = text.replace(/\D/g, "").slice(0, 15);
  return `${hasPlus ? "+" : ""}${digits}`;
}

function isValidName(value) {
  return /^[\p{L}][\p{L}' -]{1,39}$/u.test(value);
}

function isValidPhone(value) {
  return /^\+?[0-9]{10,15}$/.test(value);
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const selectedDate = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Number.isFinite(selectedDate.getTime()) && selectedDate >= today;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeLead(body) {
  const clientName = cleanName(body.name);
  const phone = cleanPhone(body.phone);
  const serviceTitle = cleanText(body.service);
  const visitDate = cleanText(body.date);

  if (!isValidName(clientName)) {
    const error = new Error("Введите имя буквами, без цифр и лишних символов.");
    error.statusCode = 400;
    throw error;
  }

  if (!isValidPhone(phone)) {
    const error = new Error("Введите телефон в формате +79990000000.");
    error.statusCode = 400;
    throw error;
  }

  if (!allowedServices.has(serviceTitle)) {
    const error = new Error("Выберите услугу из списка.");
    error.statusCode = 400;
    throw error;
  }

  if (!isValidDate(visitDate)) {
    const error = new Error("Выберите сегодняшнюю или будущую дату.");
    error.statusCode = 400;
    throw error;
  }

  return {
    createdAt: formatDateTime(new Date().toISOString()),
    clientName,
    phone,
    serviceTitle,
    price: "уточнить",
    master: "любой свободный мастер",
    visitDate,
    visitTime: "уточнить",
    status: "new",
    source: "landing_form",
    telegramChatId: "",
  };
}

function leadMessage(lead, crmResult) {
  return [
    "Новая заявка с сайта Lumi Studio",
    "",
    `ID: ${escapeHtml(crmResult.leadId || lead.id || "new")}`,
    `Клиент: ${escapeHtml(lead.clientName)}`,
    `Телефон: ${escapeHtml(lead.phone)}`,
    `Услуга: ${escapeHtml(lead.serviceTitle)}`,
    `Дата: ${escapeHtml(lead.visitDate)}`,
    "Время: уточнить",
    "",
    `CRM: ${crmResult.type}${crmResult.fallback ? " fallback" : ""}`,
  ].join("\n");
}

function adminLeadKeyboard(leadId) {
  return keyboard([
    [
      callbackButton("Подтвердить", `admin:status:${leadId}:confirmed`),
      callbackButton("Выполнено", `admin:status:${leadId}:done`),
    ],
    [callbackButton("Отменить", `admin:status:${leadId}:cancelled`)],
  ]);
}

function getClientKey(request) {
  const forwardedFor = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwardedFor || request.socket.remoteAddress || "unknown";
}

function assertRateLimit(request) {
  const key = getClientKey(request);
  const now = Date.now();
  const current = rateLimits.get(key);

  if (!current || now > current.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return;
  }

  current.count += 1;
  if (current.count > rateLimitMax) {
    const error = new Error("Слишком много заявок. Попробуйте позже.");
    error.statusCode = 429;
    throw error;
  }
}

async function handleBooking(request, response) {
  try {
    if (!isAllowedOrigin(request.headers.origin)) {
      const error = new Error("Недопустимый источник запроса.");
      error.statusCode = 403;
      throw error;
    }

    assertRateLimit(request);
    const body = await readJsonBody(request);
    const lead = normalizeLead(body);
    let crmResult;
    try {
      crmResult = await sendLeadToN8n(lead);
    } catch (error) {
      console.error(`n8n pipeline failed, falling back to local automation: ${error.message}`);
    }

    if (crmResult?.duplicate) {
      json(response, 409, {
        ok: false,
        duplicate: true,
        crm: crmResult.type,
        leadId: crmResult.leadId,
        message: "Такая заявка уже есть. Администратор получил уведомление о дубле.",
      });
      return;
    }

    if (crmResult) {
      json(response, 200, {
        ok: true,
        crm: crmResult.type,
        adminNotified: true,
        adminError: "",
        message: "Мы передали заявку в n8n-сценарий. Администратор получил уведомление.",
      });
      return;
    }

    crmResult = await saveLead(lead);

    let adminNotified = false;
    let adminError = "";
    if (adminChatId) {
      try {
        await sendMessage(
          adminChatId,
          leadMessage(lead, crmResult),
          adminLeadKeyboard(crmResult.leadId),
        );
        adminNotified = true;
      } catch (error) {
        adminError = error.message || "Telegram notification failed";
        console.error(`Admin notification failed: ${adminError}`);
      }
    }

    json(response, 200, {
      ok: true,
      crm: crmResult.type,
      adminNotified,
      adminError: adminError ? "telegram_failed" : "",
      message: adminNotified
        ? "Мы сохранили ее в CRM и отправили уведомление в Telegram."
        : "Мы сохранили ее в CRM. Telegram-уведомление нужно проверить в терминале.",
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    json(response, statusCode, {
      ok: false,
      message:
        statusCode >= 500
          ? "Не удалось отправить заявку. Попробуйте позже."
          : error.message || "Не удалось отправить заявку.",
    });
  }
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = resolve(root, requestedPath);
  const relativePath = relative(root, filePath);
  const topLevel = relativePath.split(/[\\/]/)[0];

  if (
    relativePath.startsWith("..") ||
    relativePath.startsWith(".") ||
    relativePath.includes("..") ||
    (!publicFiles.has(relativePath) && !publicDirs.includes(topLevel))
  ) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const contentType = mimeTypes[extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "content-type": contentType });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  setSecurityHeaders(response);
  applyCors(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url?.startsWith("/api/booking") && request.method === "POST") {
    await handleBooking(request, response);
    return;
  }

  if (request.method === "GET") {
    await serveStatic(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`Lumi site server: http://localhost:${port}`);
});
