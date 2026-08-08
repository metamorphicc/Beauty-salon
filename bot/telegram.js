import { requireEnv } from "./env.js";

const token = requireEnv("TELEGRAM_BOT_TOKEN");
const apiUrl = `https://api.telegram.org/bot${token}`;

export async function telegram(method, payload) {
  const response = await fetch(`${apiUrl}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!result.ok) {
    throw new Error(`Telegram ${method} failed: ${JSON.stringify(result)}`);
  }

  return result.result;
}

export function buttonRows(buttons, columns = 1) {
  const rows = [];
  for (let index = 0; index < buttons.length; index += columns) {
    rows.push(buttons.slice(index, index + columns));
  }
  return rows;
}

export function callbackButton(text, data) {
  return { text, callback_data: data };
}

export function keyboard(rows) {
  return { inline_keyboard: rows };
}

export function replyKeyboard(rows) {
  return {
    keyboard: rows,
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: "Выберите действие",
  };
}

export async function sendMessage(chatId, text, replyMarkup) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
}

export async function answerCallbackQuery(callbackQueryId) {
  return telegram("answerCallbackQuery", { callback_query_id: callbackQueryId });
}

export async function deleteMessage(chatId, messageId) {
  return telegram("deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
}

export async function setMyCommands(commands, scope) {
  return telegram("setMyCommands", scope ? { commands, scope } : { commands });
}

export async function setWebhook(url, secretToken) {
  return telegram("setWebhook", {
    url,
    allowed_updates: ["message", "callback_query"],
    ...(secretToken ? { secret_token: secretToken } : {}),
  });
}

export async function deleteWebhook(dropPendingUpdates = false) {
  return telegram("deleteWebhook", {
    drop_pending_updates: dropPendingUpdates,
  });
}

export async function getUpdates(offset) {
  return telegram("getUpdates", {
    offset,
    timeout: 25,
    allowed_updates: ["message", "callback_query"],
  });
}
