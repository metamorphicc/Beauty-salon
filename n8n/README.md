# Lumi Studio n8n Workflow

This folder contains an importable n8n workflow for the portfolio case:

```text
Landing form -> duplicate check -> Google Sheets CRM -> Telegram admin alert -> reminder
```

## Files

- `lumi-lead-automation.workflow.json` - n8n workflow export.
- `test-payload.json` - sample body for webhook testing.

## Required n8n Environment Variables

```text
GOOGLE_SHEETS_SPREADSHEET_ID
GOOGLE_SHEETS_SHEET_NAME
TELEGRAM_BOT_TOKEN
ADMIN_CHAT_ID
N8N_WEBHOOK_SECRET
```

## Import

1. Open n8n.
2. Create a new workflow.
3. Import `n8n/lumi-lead-automation.workflow.json`.
4. Open both Google Sheets nodes and select your Google Sheets credential.
5. Check that the sheet tab has these headers:

```text
Дата заявки
Имя клиента
Телефон
Услуга
Цена
Мастер
Дата визита
Время визита
Статус
Источник
Telegram chat ID
```

## Connect The Landing Form

After activating the workflow, copy the production webhook URL from the n8n Webhook node and put it into `.env` or Vercel env:

```text
N8N_BOOKING_WEBHOOK_URL=https://your-n8n-domain/webhook/lumi-booking
N8N_WEBHOOK_SECRET=your-long-random-secret
```

When `N8N_BOOKING_WEBHOOK_URL` is set, the landing form backend sends sanitized leads to n8n first. If n8n fails, the project falls back to the built-in Google Sheets/Telegram automation.

## Test Payload

Use `test-payload.json` with the webhook test URL. Add this header if `N8N_WEBHOOK_SECRET` is set:

```text
x-lumi-webhook-secret: your-long-random-secret
```

## Notes

- The duplicate check compares phone and visit date.
- The reminder branch uses a one-day wait by default for demo stability.
- For a real client, change the Wait node to wait until `reminderAt` from the Normalize node.
