import "dotenv/config";
import { requireEnv } from "./env.js";
import { deleteWebhook } from "./telegram.js";

requireEnv("TELEGRAM_BOT_TOKEN");

const dropPendingUpdates = process.argv.includes("--drop-pending");
const result = await deleteWebhook(dropPendingUpdates);
console.log(`Telegram webhook is deleted. drop_pending_updates=${dropPendingUpdates}`);
console.log(JSON.stringify(result, null, 2));
