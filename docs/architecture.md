# Architecture

## System Overview

```mermaid
flowchart LR
  Client["Client"] --> Landing["Landing Page"]
  Client --> TGBot["Telegram Bot"]

  Landing --> BookingAPI["Booking API<br/>/api/booking"]
  TGBot --> BotFlow["Booking Flow"]
  TGBot --> Consultant["AI/RAG Consultant"]

  Consultant --> KnowledgeBase["Local Knowledge Base<br/>Services, Prices, FAQ"]
  Consultant -. optional .-> OpenAI["OpenAI Responses API"]

  BotFlow --> LeadService["Lead Service"]
  BookingAPI --> N8NBridge{"N8N Webhook URL set?"}

  N8NBridge -- yes --> N8N["n8n Workflow"]
  N8NBridge -- no --> LeadService
  N8N -- fallback on failure --> LeadService

  N8N --> DuplicateCheck["Duplicate Check"]
  DuplicateCheck -- duplicate --> DuplicateAlert["Telegram Duplicate Alert"]
  DuplicateCheck -- new lead --> Sheets["Google Sheets CRM"]
  DuplicateCheck -- new lead --> AdminAlert["Telegram Admin Alert"]
  DuplicateCheck -- new lead --> Reminder["Wait + Reminder"]

  LeadService --> Sheets
  LeadService --> LocalFallback["CSV / JSON Fallback"]
  LeadService --> AdminAlert

  AdminAlert --> Admin["Salon Admin"]
  DuplicateAlert --> Admin
  Reminder --> ClientReminder["Client/Admin Reminder"]
```

## Landing Form Flow

```mermaid
sequenceDiagram
  participant C as Client
  participant L as Landing Page
  participant API as Booking API
  participant N as n8n
  participant S as Google Sheets
  participant T as Telegram Admin

  C->>L: Fill booking form
  L->>L: Validate name, phone, service, date
  L->>API: POST /api/booking
  API->>API: Sanitize and validate request

  alt n8n webhook configured
    API->>N: Send lead to workflow
    N->>S: Read existing CRM rows
    N->>N: Check duplicate
    alt Duplicate
      N->>T: Send duplicate alert
      N->>API: Return duplicate response
    else New lead
      N->>S: Append CRM row
      N->>T: Send admin alert
      N->>N: Wait until reminder window
      N->>T: Send reminder
      N->>API: Return accepted response
    end
  else n8n unavailable
    API->>S: Append lead directly
    API->>T: Send admin alert
  end

  API->>L: Return result
  L->>C: Show success toast
```

## Telegram Bot Flow

```mermaid
stateDiagram-v2
  [*] --> MainMenu
  MainMenu --> Booking: Запись
  MainMenu --> Consultant: Подобрать услугу
  MainMenu --> Prices: Прайс
  MainMenu --> Address: Адрес
  MainMenu --> AdminPanel: Админ, owner only

  Consultant --> Recommendations: Client describes need
  Recommendations --> Booking: Choose recommended service

  Booking --> Service
  Service --> Master
  Master --> Date
  Date --> Time
  Time --> Name
  Name --> Phone
  Phone --> CRM
  CRM --> AdminNotification
  AdminNotification --> MainMenu
```

## Runtime Modes

| Mode | Use Case | Entry Point |
| --- | --- | --- |
| Local site | Test landing and booking API | `npm run site` |
| Local bot | Test Telegram bot with polling | `npm run bot` |
| Vercel site/API | Deploy landing and serverless endpoints | `/api/booking`, `/api/telegram` |
| n8n local | Test visual workflow | `npx n8n` |
| n8n production | Real automation runner | production webhook URL |

## Data Destinations

| Destination | Purpose |
| --- | --- |
| Google Sheets | Main CRM table for demo/client use |
| CSV fallback | Local backup when Google credentials are missing |
| JSON archive | Local admin panel source for recent leads and statuses |
| Telegram | Admin alerts, duplicate alerts, reminders |
