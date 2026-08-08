import "dotenv/config";
import { pathToFileURL } from "node:url";
import { salon, services, timeSlots, findService } from "./catalog.js";
import { optionalEnv } from "./env.js";
import {
  answerCallbackQuery,
  buttonRows,
  callbackButton,
  deleteMessage,
  getUpdates,
  keyboard,
  replyKeyboard,
  sendMessage,
  setMyCommands,
} from "./telegram.js";
import { saveLead } from "./leads.js";
import { formatDateTime } from "./leadFormat.js";
import { getLeadStats, listLeads, updateLeadStatus } from "./leadArchive.js";
import { consultServices } from "./consultant.js";

const adminChatId = optionalEnv("ADMIN_CHAT_ID");
const sessions = new Map();
const lastFlowMessages = new Map();
let offset = 0;

const defaultCommands = [
  { command: "start", description: "Открыть меню" },
  { command: "book", description: "Записаться" },
  { command: "ask", description: "Подобрать услугу" },
  { command: "prices", description: "Прайс" },
  { command: "address", description: "Адрес и график" },
];

const adminCommands = [
  ...defaultCommands,
  { command: "admin", description: "Админ-панель" },
];

function isAdmin(chatId) {
  return adminChatId && String(chatId) === String(adminChatId);
}

function menuKeyboard(chatId) {
  const rows = [
    ["Запись", "Подобрать услугу"],
    ["Прайс", "Адрес"],
    ["Связаться"],
  ];

  if (isAdmin(chatId)) {
    rows.push(["Админ"]);
  }

  return replyKeyboard(rows);
}

function tomorrowDate(offsetDays = 1) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function startSession(chatId) {
  const session = { step: "service" };
  sessions.set(chatId, session);
  return session;
}

function getSession(chatId) {
  return sessions.get(chatId) || startSession(chatId);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function sendCleanMessage(chatId, text, replyMarkup) {
  const previousMessageId = lastFlowMessages.get(chatId);
  if (previousMessageId) {
    try {
      await deleteMessage(chatId, previousMessageId);
    } catch {
      // Telegram may reject deletion for old messages. The flow should continue.
    }
  }

  const message = await sendMessage(chatId, text, replyMarkup);
  lastFlowMessages.set(chatId, message.message_id);
  return message;
}

async function deleteUserMessage(chatId, messageId) {
  if (!messageId) {
    return;
  }

  try {
    await deleteMessage(chatId, messageId);
  } catch {
    // Private chats usually allow this, but the bot should not break if Telegram refuses.
  }
}

function backButton(data = "back:menu") {
  return callbackButton("← Назад", data);
}

function singleBackKeyboard(data) {
  return keyboard([[backButton(data)]]);
}

function consultantKeyboard(servicesToBook) {
  const serviceRows = servicesToBook.map((service) => [
    callbackButton(`Записаться: ${service.title}`, `consultBook:${service.id}`),
  ]);

  return keyboard([...serviceRows, [backButton("back:menu")]]);
}

function serviceKeyboard() {
  return keyboard(
    [
      ...services.map((service) => [
        callbackButton(`${service.title} · ${service.price}`, `service:${service.id}`),
      ]),
      [backButton("back:menu")],
    ],
  );
}

function masterKeyboard(service) {
  return keyboard([
    ...service.masters.map((master) => [callbackButton(master, `master:${master}`)]),
    [backButton("back:service")],
  ]);
}

function dateKeyboard() {
  const buttons = [1, 2, 3, 4].map((day) => {
    const date = tomorrowDate(day);
    return callbackButton(date, `date:${date}`);
  });
  return keyboard([...buttonRows(buttons, 2), [backButton("back:master")]]);
}

function slotKeyboard() {
  return keyboard([
    ...buttonRows(timeSlots.map((slot) => callbackButton(slot, `slot:${slot}`)), 2),
    [backButton("back:date")],
  ]);
}

function adminPanelKeyboard() {
  return keyboard([
    [callbackButton("Новые заявки", "admin:list:new")],
    [callbackButton("Последние заявки", "admin:list:all")],
    [callbackButton("Статистика", "admin:stats")],
  ]);
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

function leadSummary(lead, leadId) {
  return [
    "Новая запись в Lumi Studio",
    "",
    `ID: ${escapeHtml(leadId || lead.id || "new")}`,
    `Клиент: ${escapeHtml(lead.clientName)}`,
    `Телефон: ${escapeHtml(lead.phone)}`,
    `Услуга: ${escapeHtml(lead.serviceTitle)} (${escapeHtml(lead.price)})`,
    `Мастер: ${escapeHtml(lead.master)}`,
    `Визит: ${escapeHtml(lead.visitDate)} в ${escapeHtml(lead.visitTime)}`,
    `Источник: ${escapeHtml(lead.source)}`,
  ].join("\n");
}

function shortLead(lead) {
  return [
    `${lead.id} · ${lead.status}`,
    `${lead.clientName} · ${lead.phone}`,
    `${lead.serviceTitle} · ${lead.visitDate} ${lead.visitTime}`,
    `Мастер: ${lead.master}`,
    `CRM: ${lead.crm}${lead.crmFallback ? " fallback" : ""}`,
  ].join("\n");
}

async function showMainMenu(chatId) {
  sessions.delete(chatId);
  await sendCleanMessage(
    chatId,
    [
      `Меню ${salon.name}`,
      "",
      "Выберите действие. Для записи нажмите «Запись».",
    ].join("\n"),
    menuKeyboard(chatId),
  );
}

async function showBookingServices(chatId) {
  startSession(chatId);
  await sendCleanMessage(chatId, "Выберите услугу.", serviceKeyboard());
}

async function showConsultantPrompt(chatId) {
  sessions.set(chatId, { step: "consult" });
  await sendCleanMessage(
    chatId,
    [
      "Опишите, что хотите решить.",
      "",
      "Например: «сухие волосы», «нужны аккуратные ногти к встрече», «хочу освежить лицо перед событием».",
    ].join("\n"),
    singleBackKeyboard("back:menu"),
  );
}

async function showPrices(chatId) {
  const priceText = services
    .map((service) => `${service.title}: ${service.price}, ${service.duration}`)
    .join("\n");
  await sendCleanMessage(chatId, priceText, menuKeyboard(chatId));
}

async function showAddress(chatId) {
  await sendCleanMessage(chatId, `${salon.address}\n${salon.hours}`, menuKeyboard(chatId));
}

async function showContact(chatId) {
  await sendCleanMessage(
    chatId,
    "Администратор на связи: @lumi_booking\nТелефон: +7 383 000 00 00",
    menuKeyboard(chatId),
  );
}

async function showAdminPanel(chatId) {
  if (!isAdmin(chatId)) {
    await showMainMenu(chatId);
    return;
  }

  const stats = await getLeadStats();
  await sendMessage(
    chatId,
    [
      "Админ-панель Lumi Studio",
      "",
      `Всего заявок: ${stats.total}`,
      `Новые: ${stats.new}`,
      `Подтверждены: ${stats.confirmed}`,
      `Выполнены: ${stats.done}`,
      `Отменены: ${stats.cancelled}`,
    ].join("\n"),
    adminPanelKeyboard(),
  );
}

async function showLeadList(chatId, status) {
  if (!isAdmin(chatId)) {
    await showMainMenu(chatId);
    return;
  }

  const leads = await listLeads({ status, limit: 6 });
  if (!leads.length) {
    await sendMessage(
      chatId,
      status === "new" ? "Новых заявок нет." : "Заявок пока нет.",
      adminPanelKeyboard(),
    );
    return;
  }

  for (const lead of leads) {
    await sendMessage(chatId, shortLead(lead), adminLeadKeyboard(lead.id));
  }
}

async function handleCommand(chatId, text) {
  if (text === "/start" || text === "/restart") {
    await showMainMenu(chatId);
    return;
  }

  if (text === "/book") {
    await showBookingServices(chatId);
    return;
  }

  if (text === "/ask") {
    await showConsultantPrompt(chatId);
    return;
  }

  if (text === "/prices") {
    await showPrices(chatId);
    return;
  }

  if (text === "/address") {
    await showAddress(chatId);
    return;
  }

  if (text === "/admin") {
    await showAdminPanel(chatId);
    return;
  }

  await showMainMenu(chatId);
}

async function handleText(chatId, text, from, messageId) {
  await deleteUserMessage(chatId, messageId);

  if (text.startsWith("/")) {
    await handleCommand(chatId, text);
    return;
  }

  if (text === "Запись" || text === "Записаться") {
    await showBookingServices(chatId);
    return;
  }

  if (text === "Подобрать услугу") {
    await showConsultantPrompt(chatId);
    return;
  }

  if (text === "Прайс") {
    await showPrices(chatId);
    return;
  }

  if (text === "Адрес") {
    await showAddress(chatId);
    return;
  }

  if (text === "Связаться") {
    await showContact(chatId);
    return;
  }

  if (text === "Админ" || text === "Админ-панель") {
    await showAdminPanel(chatId);
    return;
  }

  const session = sessions.get(chatId);
  if (!session) {
    await showMainMenu(chatId);
    return;
  }

  if (session.step === "consult") {
    const result = await consultServices(text);
    await sendCleanMessage(
      chatId,
      escapeHtml(result.answer),
      consultantKeyboard(result.services),
    );
    return;
  }

  if (session.step === "name") {
    session.clientName = text.trim();
    session.step = "phone";
    await sendCleanMessage(
      chatId,
      [
        `Имя: ${escapeHtml(session.clientName)}`,
        "",
        "Оставьте телефон для подтверждения записи.",
      ].join("\n"),
      singleBackKeyboard("back:name"),
    );
    return;
  }

  if (session.step === "phone") {
    const phone = text.replace(/[^\d+]/g, "");
    if (phone.length < 10) {
      await sendCleanMessage(
        chatId,
        "Похоже, телефон слишком короткий. Пришлите номер еще раз.",
        singleBackKeyboard("back:name"),
      );
      return;
    }

    const service = findService(session.serviceId);
    const lead = {
      createdAt: formatDateTime(new Date().toISOString()),
      clientName: session.clientName || from.first_name || "Клиент",
      phone,
      serviceTitle: service.title,
      price: service.price,
      master: session.master,
      visitDate: session.visitDate,
      visitTime: session.visitTime,
      status: "new",
      source: "telegram_bot",
      telegramChatId: chatId,
    };

    const saveResult = await saveLead(lead);
    sessions.delete(chatId);

    await sendCleanMessage(
      chatId,
      [
        "Заявка принята.",
        "",
        `${lead.serviceTitle}, ${lead.visitDate} в ${lead.visitTime}`,
        `Мастер: ${lead.master}`,
        "Администратор подтвердит запись в ближайшее время.",
      ].join("\n"),
      menuKeyboard(chatId),
    );

    if (adminChatId) {
      await sendMessage(
        adminChatId,
        `${leadSummary(lead, saveResult.leadId)}\n\nCRM: ${saveResult.type}`,
        adminLeadKeyboard(saveResult.leadId),
      );
    }
    return;
  }

  await showMainMenu(chatId);
}

async function handleAdminCallback(chatId, data) {
  if (!isAdmin(chatId)) {
    await showMainMenu(chatId);
    return true;
  }

  if (data === "admin:stats") {
    await showAdminPanel(chatId);
    return true;
  }

  if (data === "admin:list:new") {
    await showLeadList(chatId, "new");
    return true;
  }

  if (data === "admin:list:all") {
    await showLeadList(chatId);
    return true;
  }

  if (data.startsWith("admin:status:")) {
    const [, , leadId, status] = data.split(":");
    const lead = await updateLeadStatus(leadId, status);
    if (!lead) {
      await sendMessage(chatId, "Заявка не найдена.");
      return true;
    }

    await sendMessage(chatId, `Статус обновлен: ${lead.id} -> ${lead.status}`, adminPanelKeyboard());
    return true;
  }

  return false;
}

async function handleBack(chatId, data, session) {
  if (data === "back:menu") {
    sessions.delete(chatId);
    await showMainMenu(chatId);
    return;
  }

  if (data === "back:service") {
    session.step = "service";
    delete session.serviceId;
    delete session.master;
    delete session.visitDate;
    delete session.visitTime;
    delete session.clientName;
    await sendCleanMessage(chatId, "Выберите услугу.", serviceKeyboard());
    return;
  }

  if (data === "back:master") {
    const service = findService(session.serviceId);
    if (!service) {
      await showBookingServices(chatId);
      return;
    }

    session.step = "master";
    delete session.master;
    delete session.visitDate;
    delete session.visitTime;
    delete session.clientName;
    await sendCleanMessage(
      chatId,
      `${service.title}\n${service.price}, ${service.duration}\n\nВыберите мастера.`,
      masterKeyboard(service),
    );
    return;
  }

  if (data === "back:date") {
    session.step = "date";
    delete session.visitDate;
    delete session.visitTime;
    delete session.clientName;
    await sendCleanMessage(chatId, "Выберите дату визита.", dateKeyboard());
    return;
  }

  if (data === "back:slot") {
    session.step = "slot";
    delete session.visitTime;
    delete session.clientName;
    await sendCleanMessage(chatId, "Выберите удобное время.", slotKeyboard());
    return;
  }

  if (data === "back:name") {
    session.step = "name";
    delete session.clientName;
    await sendCleanMessage(
      chatId,
      "Как вас записать? Пришлите имя одним сообщением.",
      singleBackKeyboard("back:slot"),
    );
    return;
  }

  await showBookingServices(chatId);
}

async function handleCallback(callback) {
  const chatId = callback.message.chat.id;
  const data = callback.data || "";

  await answerCallbackQuery(callback.id);

  if (data.startsWith("admin:")) {
    const handled = await handleAdminCallback(chatId, data);
    if (handled) {
      return;
    }
  }

  lastFlowMessages.set(chatId, callback.message.message_id);
  const session = getSession(chatId);

  if (data.startsWith("back:")) {
    await handleBack(chatId, data, session);
    return;
  }

  if (data.startsWith("consultBook:")) {
    const serviceId = data.slice("consultBook:".length);
    const service = findService(serviceId);
    if (!service) {
      await showBookingServices(chatId);
      return;
    }

    session.serviceId = service.id;
    session.step = "master";
    await sendCleanMessage(
      chatId,
      `${service.title}\n${service.price}, ${service.duration}\n\nВыберите мастера.`,
      masterKeyboard(service),
    );
    return;
  }

  if (data.startsWith("service:")) {
    const serviceId = data.split(":")[1];
    const service = findService(serviceId);
    if (!service) {
      await sendCleanMessage(chatId, "Не нашла эту услугу. Выберите из списка.", serviceKeyboard());
      return;
    }

    session.serviceId = service.id;
    session.step = "master";
    await sendCleanMessage(
      chatId,
      `${service.title}\n${service.price}, ${service.duration}\n\nВыберите мастера.`,
      masterKeyboard(service),
    );
    return;
  }

  if (data.startsWith("master:")) {
    session.master = data.slice("master:".length);
    session.step = "date";
    await sendCleanMessage(chatId, "Выберите дату визита.", dateKeyboard());
    return;
  }

  if (data.startsWith("date:")) {
    session.visitDate = data.slice("date:".length);
    session.step = "slot";
    await sendCleanMessage(chatId, "Выберите удобное время.", slotKeyboard());
    return;
  }

  if (data.startsWith("slot:")) {
    session.visitTime = data.slice("slot:".length);
    session.step = "name";
    await sendCleanMessage(
      chatId,
      "Как вас записать? Пришлите имя одним сообщением.",
      singleBackKeyboard("back:slot"),
    );
    return;
  }

  await showBookingServices(chatId);
}

export async function handleUpdate(update) {
  if (update.message?.chat?.id && update.message.text) {
    await handleText(
      update.message.chat.id,
      update.message.text,
      update.message.from || {},
      update.message.message_id,
    );
    return;
  }

  if (update.callback_query) {
    await handleCallback(update.callback_query);
  }
}

export async function setupCommandMenus() {
  await setMyCommands(defaultCommands, { type: "default" });

  if (adminChatId) {
    await setMyCommands(adminCommands, { type: "chat", chat_id: Number(adminChatId) || adminChatId });
  }
}

export async function poll() {
  for (;;) {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (error) {
      console.error(error);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function startPollingBot() {
  console.log(`Starting ${salon.name} Telegram bot...`);
  try {
    await setupCommandMenus();
  } catch (error) {
    console.error(`Telegram command menu setup failed: ${error.message}`);
  }
  await poll();
}

function isDirectRun() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isDirectRun()) {
  await startPollingBot();
}
