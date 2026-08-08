# Case Study: Beauty Salon Automation System

## Project

`Lumi Studio` is a fictional beauty salon used as a realistic portfolio case. The goal was to build a compact automation system that looks and behaves like a real client project.

## Client Problem

The salon receives requests from different places: website forms, Telegram messages, and direct client questions. Without automation, the administrator has to manually copy leads into a table, check if the client already submitted a request, answer repeated questions about services and prices, and remember to send reminders.

This creates four business risks:

- missed bookings;
- duplicate rows in CRM;
- slow replies to clients;
- forgotten reminders before visits.

## Solution

The project connects the landing page, Telegram bot, CRM, and n8n into one booking pipeline.

```text
Client -> Landing form / Telegram bot -> Backend -> CRM -> Admin notification -> Reminder
```

The system can work in two modes:

- built-in backend automation with Google Sheets and Telegram;
- n8n workflow mode for visual automation, duplicate checks, and reminders.

## User Flow

### Website Booking

1. Client opens the salon landing page.
2. Client fills name, phone, service, and visit date.
3. Form validates input before submit.
4. Backend sanitizes the lead.
5. Lead goes to n8n or built-in automation.
6. CRM row is created.
7. Admin receives Telegram notification.
8. Client sees a successful booking toast.

### Telegram Booking

1. Client opens the Telegram bot.
2. Bot shows a clean client menu.
3. Client chooses service, master, date, and time.
4. Bot asks for name and phone.
5. Lead is saved to CRM.
6. Admin receives a Telegram card with status actions.

### AI/RAG Consultant

1. Client taps `Подобрать услугу`.
2. Client describes the need in natural language.
3. Bot searches the local knowledge base of services, prices, masters, and FAQ.
4. Bot recommends relevant services.
5. Client can continue directly into booking.

## n8n Workflow

The workflow is importable from:

```text
n8n/lumi-lead-automation.workflow.json
```

Pipeline:

```text
Webhook
-> Normalize + Validate
-> Read CRM Rows
-> Check Duplicate
-> Duplicate?
   -> true: Telegram Duplicate Alert -> Duplicate Response
   -> false: Prepare CRM Row -> Google Sheets -> Telegram Admin Alert -> Accepted Response
                         -> Wait -> Telegram Reminder
```

Duplicate logic:

```text
same phone + same visit date + status is not cancelled
```

If the lead is a duplicate, the workflow does not write a second row to CRM. It sends a separate alert to the administrator.

## Admin Experience

The admin receives Telegram notifications for new leads. The bot also includes an owner-only admin panel with lead stats, recent leads, new leads, and status changes.

Regular users do not see the admin menu.

## Reliability

The backend includes:

- input validation;
- basic rate limiting;
- CORS checks;
- security headers;
- Telegram token kept server-side;
- Google Sheets fallback to local CSV/JSON;
- n8n fallback to built-in automation.

## Stack

- HTML, CSS, JavaScript
- Node.js
- Telegram Bot API
- Google Sheets API
- n8n
- OpenAI API, optional
- Vercel serverless functions, optional

## Result

The final system turns a simple salon website into a full booking automation pipeline. It demonstrates practical business value: faster client response, cleaner CRM, duplicate protection, admin alerts, and automated reminders.

Portfolio positioning:

> I built an end-to-end automation system for a beauty salon: landing page, Telegram booking bot, AI/RAG consultant, Google Sheets CRM, n8n duplicate protection, admin notifications, and reminders.
