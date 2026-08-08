import "dotenv/config";

const required = ["TELEGRAM_BOT_TOKEN"];
const optional = [
  "ADMIN_CHAT_ID",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SHEETS_SHEET_NAME",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
];

let hasError = false;

for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing required variable: ${name}`);
    hasError = true;
  }
}

for (const name of optional) {
  const status = process.env[name] ? "set" : "empty";
  console.log(`${name}: ${status}`);
}

if (hasError) {
  process.exitCode = 1;
} else {
  console.log("Environment looks ready for Telegram bot startup.");
}
