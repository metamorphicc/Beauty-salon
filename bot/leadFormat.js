import { optionalEnv } from "./env.js";

const timezone = optionalEnv("TIMEZONE") || "Asia/Novosibirsk";

export const leadHeaders = [
  "Дата заявки",
  "Имя клиента",
  "Телефон",
  "Услуга",
  "Цена",
  "Мастер",
  "Дата визита",
  "Время визита",
  "Статус",
  "Источник",
  "Telegram chat ID",
];

export function formatDateTime(value) {
  if (/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(String(value || ""))) {
    return value;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return String(value || "");
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", "");
}

export function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return String(value || "");
  }

  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function formatLeadRow(lead) {
  return [
    formatDateTime(lead.createdAt),
    lead.clientName,
    lead.phone,
    lead.serviceTitle,
    lead.price,
    lead.master,
    formatDate(lead.visitDate),
    lead.visitTime,
    lead.status,
    lead.source,
    lead.telegramChatId,
  ];
}
