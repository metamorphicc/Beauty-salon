import "../bot/env.js";
import { saveLead } from "../bot/leads.js";
import { optionalEnv } from "../bot/env.js";
import { services } from "../bot/catalog.js";
import { formatDateTime } from "../bot/leadFormat.js";
import { callbackButton, keyboard, sendMessage } from "../bot/telegram.js";
import { sendLeadToN8n } from "../bot/n8n.js";

const adminChatId = optionalEnv("ADMIN_CHAT_ID");
const landingServiceAliases = ["Стрижка", "Окрашивание", "Маникюр", "Брови", "Уход лица"];
const allowedServices = new Set([
  ...services.map((service) => service.title),
  ...landingServiceAliases,
]);

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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

function adminLeadKeyboard(leadId) {
  return keyboard([
    [
      callbackButton("Подтвердить", `admin:status:${leadId}:confirmed`),
      callbackButton("Выполнено", `admin:status:${leadId}:done`),
    ],
    [callbackButton("Отменить", `admin:status:${leadId}:cancelled`)],
  ]);
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

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body || {};
    const lead = normalizeLead(body);
    let crmResult;
    try {
      crmResult = await sendLeadToN8n(lead);
    } catch (error) {
      console.error(`n8n pipeline failed, falling back to local automation: ${error.message}`);
    }

    if (crmResult?.duplicate) {
      response.status(409).json({
        ok: false,
        duplicate: true,
        crm: crmResult.type,
        leadId: crmResult.leadId,
        message: "Такая заявка уже есть. Администратор получил уведомление о дубле.",
      });
      return;
    }

    if (crmResult) {
      response.status(200).json({
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

    response.status(200).json({
      ok: true,
      crm: crmResult.type,
      adminNotified,
      adminError: adminError ? "telegram_failed" : "",
      message: adminNotified
        ? "Мы сохранили ее в CRM и отправили уведомление в Telegram."
        : "Мы сохранили ее в CRM. Telegram-уведомление нужно проверить в логах.",
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    response.status(statusCode).json({
      ok: false,
      message:
        statusCode >= 500
          ? "Не удалось отправить заявку. Попробуйте позже."
          : error.message || "Не удалось отправить заявку.",
    });
  }
}
