# Google Sheets CRM

The bot writes leads to Google Sheets when these variables are set:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_SHEET_NAME`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

If any of them are missing, the bot writes the same lead row to `crm/leads.local.csv`.
If Google Sheets is configured but returns an error, the bot also falls back to CSV so the booking flow does not break during demos.

## Sheet Columns

Create a tab named `Leads`, or set `GOOGLE_SHEETS_SHEET_NAME` to the exact tab name. The app will create and format these headers automatically in row 1 before writing a lead:

| Column | Field |
| --- | --- |
| A | Дата заявки |
| B | Имя клиента |
| C | Телефон |
| D | Услуга |
| E | Цена |
| F | Мастер |
| G | Дата визита |
| H | Время визита |
| I | Статус |
| J | Источник |
| K | Telegram chat ID |

## Service Account Setup

1. Create a Google Cloud service account.
2. Create a JSON key for it.
3. Share the target spreadsheet with `client_email` from the JSON key.
4. Put `client_email` into `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
5. Put `private_key` into `GOOGLE_PRIVATE_KEY`, keeping `\n` line breaks.
