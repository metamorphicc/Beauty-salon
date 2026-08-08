# Lumi Studio - Beauty Salon Automation System

Production-style portfolio case for a fictional beauty salon. The project shows how a small service business can automate lead capture, booking, admin notifications, CRM updates, AI consultations, and reminders.

## Business Problem

Beauty salons often lose bookings because requests come from different channels: website forms, Telegram messages, direct messages, and calls. Administrators have to copy data manually, check duplicates, answer the same questions about prices, and remember to follow up with clients.

This project solves that flow as one connected system:

```text
Landing page -> Booking API -> n8n / CRM -> Google Sheets -> Telegram admin alert -> Reminder
                           |
                           -> Telegram bot -> AI/RAG service consultant -> Booking flow
```

## What Is Included

- Editorial landing page for a beauty salon.
- Protected booking form with input validation.
- Telegram booking bot with clean step-by-step flow.
- Client menu and owner-only admin panel.
- AI/RAG consultant that recommends services from the salon knowledge base.
- Google Sheets CRM integration.
- CSV/local JSON fallback for demos without cloud credentials.
- n8n workflow for duplicate checks, CRM write, admin alerts, and reminders.
- Vercel-ready webhook mode for Telegram and the landing form API.

## Key Features

### Landing Page

The website is built as a realistic salon landing page, not a generic template. The booking form validates client name, phone number, service, and date before sending data to the backend.

### Telegram Booking Bot

The bot guides the client through:

```text
service -> master -> date -> time -> name -> phone -> CRM -> admin notification
```

It keeps the chat clean by removing previous flow messages where Telegram allows it. The client can move back through the booking steps.

### AI/RAG Consultant

The button `Подобрать услугу` lets the client describe what they need in plain language. The bot retrieves relevant services and FAQ entries from the local Lumi knowledge base and recommends the best options.

If `OPENAI_API_KEY` is configured, the consultant can use OpenAI Responses API. If not, it falls back to local RAG recommendations.

### CRM And Admin Flow

Leads are written to Google Sheets. If Google Sheets is unavailable or not configured, the project falls back to local CSV/JSON storage. Admins receive Telegram notifications with lead details and inline status actions.

### n8n Automation

The importable n8n workflow lives here:

```text
n8n/lumi-lead-automation.workflow.json
```

Scenario:

```text
Webhook -> Normalize + Validate -> Read CRM Rows -> Check Duplicate
       -> Google Sheets -> Telegram Admin Alert -> Response
       -> Wait -> Telegram Reminder
```

If a duplicate is detected, the workflow does not write a second CRM row. Instead, it alerts the admin and returns a duplicate response.

## Architecture

Detailed architecture diagram:

```text
docs/architecture.md
```

Case study text for portfolio use:

```text
docs/case-study.md
```

## Tech Stack

- HTML, CSS, JavaScript
- Node.js
- Telegram Bot API
- Google Sheets API
- n8n
- OpenAI API, optional
- Vercel serverless functions, optional

## Local Run

Requires Node.js 18+.

1. Copy `.env.example` to `.env`.
2. Fill Telegram variables.
3. Optional: configure Google Sheets using `docs/google-sheets.md`.
4. Start the landing backend:

```powershell
npm run site
```

Open:

```text
http://localhost:3000
```

Start the bot in local polling mode:

```powershell
npm run bot
```

Check the project:

```powershell
npm run check
```

## Telegram Commands

- `/start` - show main menu
- `/book` - start booking flow
- `/ask` - AI/RAG service consultant
- `/prices` - show services and prices
- `/address` - show address and working hours
- `/admin` - owner-only admin panel
- `/restart` - reset booking flow

## Vercel Webhook Mode

Local development uses polling. Vercel should use Telegram webhook mode:

```text
Telegram -> https://your-project.vercel.app/api/telegram -> bot handler
```

Required Vercel environment variables:

```text
TELEGRAM_BOT_TOKEN
ADMIN_CHAT_ID
TELEGRAM_WEBHOOK_URL=https://your-project.vercel.app/api/telegram
TELEGRAM_WEBHOOK_SECRET
```

After deployment:

```powershell
npm run webhook:set
```

To return to local polling:

```powershell
npm run webhook:delete
```

Polling and webhook should not run at the same time for the same Telegram bot.

## n8n Lead Pipeline

To route landing leads through n8n:

```text
N8N_BOOKING_WEBHOOK_URL=https://your-n8n-domain/webhook/lumi-booking
N8N_WEBHOOK_SECRET=your-long-random-secret
```

If n8n is unavailable, the backend falls back to the built-in Google Sheets/Telegram automation.

## Portfolio Positioning

This can be presented as:

> A full automation system for a beauty salon: landing page, Telegram booking bot, AI/RAG service consultant, Google Sheets CRM, n8n duplicate protection, admin notifications, and reminders.
