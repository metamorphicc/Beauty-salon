# Lumi Studio Automation Demo

Demo project for a beauty salon portfolio case:

- landing page for `Lumi Studio`;
- Telegram booking bot;
- landing form endpoint;
- Google Sheets CRM write;
- local CSV fallback for demos without credentials.

## Run The Landing Form

The form sends requests to `POST /api/booking`, so the site must be opened through the Node server:

```powershell
npm run site
```

Then open:

```text
http://localhost:3000
```

If you open `index.html` directly or use a plain static server, the form cannot reach Telegram safely because the bot token must stay on the backend.

## Run The Bot

Requires Node.js 18+.

1. Copy `.env.example` to `.env`.
2. Fill `TELEGRAM_BOT_TOKEN`.
3. Fill `ADMIN_CHAT_ID` if you want admin notifications.
4. Optional: fill Google Sheets variables from `docs/google-sheets.md`.
5. Start the bot:

```powershell
npm run bot
```

Direct Node alternative:

```powershell
node bot/index.js
```

Optional environment check:

```powershell
npm run check:env
```

Direct Node alternative:

```powershell
node bot/check-env.js
```

## Bot Commands

- `/start` - show main menu;
- `/book` - start booking flow;
- `/prices` - show services and prices;
- `/address` - show salon address and working hours;
- `/admin` - open Telegram admin panel, owner only;
- `/restart` - reset booking flow.

## Telegram Menus

Client keyboard:

```text
Запись | Прайс
Адрес  | Связаться
```

Owner keyboard adds one extra button:

```text
Админ
```

The owner is the chat from `ADMIN_CHAT_ID`. Regular users do not see the admin button, and the default Telegram command menu does not show `/admin`.

Booking flow behavior:

- bot removes previous booking-step messages when moving forward;
- user text replies in the booking flow are deleted after processing;
- each step has a `Назад` inline button;
- the final booking receipt stays visible as the clean summary.

Admin panel actions:

- view lead stats;
- view new leads;
- view recent leads;
- set lead status to `confirmed`, `done`, or `cancelled`.

## Booking Flow

```text
service -> master -> date -> time -> name -> phone -> CRM row -> admin Telegram notification
```

## Demo CRM

When Google credentials are not configured, leads are written to:

```text
crm/leads.local.csv
```

If Google Sheets credentials are present but invalid, the bot falls back to the same CSV file and prints the Sheets error in the terminal.
