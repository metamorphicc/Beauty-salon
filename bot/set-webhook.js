import "dotenv/config";
import { optionalEnv, requireEnv } from "./env.js";
import { setWebhook } from "./telegram.js";

function resolveWebhookUrl() {
  const explicitUrl = optionalEnv("TELEGRAM_WEBHOOK_URL");
  if (explicitUrl) {
    return explicitUrl;
  }

  const vercelUrl = optionalEnv("VERCEL_URL");
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "")}/api/telegram`;
  }

  return "";
}

const webhookUrl = resolveWebhookUrl();
if (!webhookUrl) {
  throw new Error("Set TELEGRAM_WEBHOOK_URL=https://your-domain.vercel.app/api/telegram");
}

requireEnv("TELEGRAM_BOT_TOKEN");

const result = await setWebhook(webhookUrl, optionalEnv("TELEGRAM_WEBHOOK_SECRET"));
console.log(`Telegram webhook is set: ${webhookUrl}`);
console.log(JSON.stringify(result, null, 2));
