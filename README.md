# 🟢 WhatsApp Business AI Assistant

An enterprise-ready, high-performance web dashboard and integration gateway connecting the **Meta WhatsApp Business Cloud API** with **Groq Cloud Large Language Models (LLMs)**. Features a real-time conversation management console, an integrated knowledge retrieval base (RAG), and a seamless automated-to-human escalation flow.

---

## 📸 Interface Preview

### Live Conversation Console
![Live Conversation Dashboard](/public/screenshots/dashboard.png)

### Knowledge Base & Similarity Testing Sandbox
![Knowledge Base Management](/public/screenshots/knowledge.png)

---

## 🚀 Key Features

* **Sub-Second Webhook Handshake**: Decouples API receipt from AI response logic, acknowledging incoming requests instantly with an HTTP `200 OK` to satisfy Meta's strict timeout limits.
* **Groq Cloud LPU Integration**: Ultra-fast inference using the `openai` SDK pointing to Groq's low-latency endpoints (`/openai/v1/chat/completions`), utilizing the **Llama-3.3** model class.
* **Dynamic Knowledge Base (RAG)**: Create, read, update, and delete business documents directly from the web panel (`/knowledge`). Entries undergo full-text lexical ranking in PostgreSQL and are dynamically embedded as system-prompt updates at query time.
* **Supabase Realtime Synchronization**: Interactive chat console syncing message logs and conversation threads instantaneously via Supabase Realtime subscriptions.
* **Hybrid Agent Routing**: Allows operators to switch between **Agent** (fully automated AI responses) and **Human** (manual chat panel inputs) modes dynamically per recipient.
* **Robust Loop Protection**: Built-in exception thresholds, history limiting, and message sanitization (such as parsing out `<think>` tags returned by reasoning models) to prevent loops or crashes.

---

## 🛠️ Architectural Workflow

```
Recipient Sends Message 
   ──> Meta WhatsApp Webhook (POST /api/webhook)
   ──> Instantly returns 200 OK to Meta (Acks in <50ms)
   ──> Triggers background job:
       ├── Queries conversation state (Supabase)
       ├── Runs search_knowledge() full-text query to retrieve details
       ├── Appends latest 20 chronological messages (user & assistant)
       ├── Injects retrieved knowledge into Groq Chat API prompt context
       ├── Generates completion using Groq Cloud API
       ├── Dispatches reply to Recipient using WhatsApp Graph API
       └── Logs assistant response to DB (Updates dashboard in real-time)
```

---

## 📦 Tech Stack

* **Core Framework**: Next.js 16 (App Router, TypeScript)
* **Database & Subscriptions**: Supabase (PostgreSQL, Realtime Engine, Full-Text indexing)
* **AI Model Engine**: Groq Cloud API (via `openai` SDK mapped to `https://api.groq.com/openai/v1`)
* **Styling & Layout**: Custom HSL Dark-Themed UI System (CSS)

---

## ⚙️ Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env.local` file by copying the template:

```bash
cp .env.example .env.local
```

Fill in the following variables:

| Variable Name | Description | Source |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | System User Access Token | Meta Developer Settings |
| `WHATSAPP_PHONE_NUMBER_ID` | Sandbox or production Phone ID | Meta Developers > WhatsApp > API Setup |
| `WHATSAPP_VERIFY_TOKEN` | Custom secure verification string | Configured on your webhook |
| `GROQ_API_KEY` | Developer API Key (`gsk_...`) | [Groq Console](https://console.groq.com) |
| `GROQ_MODEL` | Serverless Chat Model (e.g. `llama-3.3-70b-versatile`) | [Groq Models List](https://console.groq.com/docs/models) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase endpoint URL | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client anon key | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for backend authentication bypass | Supabase Dashboard > Settings > API |

---

### 3. Initialize Database Schema

The database table definitions, full-text indexes, and similarity search functions are separated into a dedicated SQL file. Complete the schema initialization step:

👉 Execute the SQL queries inside: **[supabase/schema.sql](./supabase/schema.sql)** inside your Supabase project's **SQL Editor**.

This script sets up:
* `conversations` table (tracks routing status, phone number tags, and metadata).
* `messages` table (stores historical logs).
* `knowledge_base` table (holds the text data used by the RAG backend).
* `search_knowledge` Postgres stored procedure (used to measure relevance using Postgres Full-Text Search vectors).

---

### 4. Populate the Knowledge Base

1. Navigate to **`http://localhost:3000/knowledge`**.
2. Click the **`+ Add Document`** button in the top-right corner.
3. Fill in the fields:

   | Field | Description | Example |
   |---|---|---|
   | **Title** | Short, descriptive name for reference | `Clinic Location & Hours` |
   | **Content / Facts** | The exact facts the Groq engine should know and cite | `We are located at 123 Main St, open Mon–Fri 9am–6pm.` |
   | **Tags** | Comma-separated search helper terms | `location, hours, address, parking` |

4. Click **Save Document**. The data is active immediately.

---

### 5. Similarity Sandbox (Query Tester)

The side panel on the `/knowledge` page allows debugging relevance scores:
1. Type a sample question (e.g. `"What is your location?"`).
2. Click **Run Match Test**.
3. Real-time scores will return (ranging from `0.000` to `1.000`) based on relevance, helping you tune your document tag and context keywords prior to production.

---

### 6. Local Setup and HTTPS Tunneling

Start the local server:

```bash
npm run dev
```

Expose the Next.js target server to Meta's public Webhook listener:

```bash
ngrok http 3000
```

### 7. Webhook Registration (Meta Developers)

1. Log into your app at [Meta Developers Portal](https://developers.facebook.com/).
2. Select **WhatsApp** product > **Configuration**.
3. Supply:
   * **Callback URL**: `https://<your-ngrok-subdomain>.ngrok-free.app/api/webhook`
   * **Verify Token**: Token matching your local `WHATSAPP_VERIFY_TOKEN`.
4. Subscribe to **messages** under Webhook Fields.
5. Save changes and white-list recipient phone numbers if working on a sandbox development profile.

---

## 🌎 Production Vercel Deployment

1. Push your clean code to your repository.
2. Link the repository to [Vercel](https://vercel.com).
3. Import the system variables from `.env.local` to Vercel's Settings.
4. Deploy the project and update the Meta Developers Callback URL: `https://your-production-app.vercel.app/api/webhook`.

---

## 🔍 Troubleshooting FAQ

| Problem | Root Cause | Resolution |
|---|---|---|
| Webhook handshake error | Verify tokens do not match. | Validate `WHATSAPP_VERIFY_TOKEN` matches in both your local environment and Meta app configs. |
| Message arrives, but AI auto-replies fail | API Authentications or model mismatches. | Check that `GROQ_API_KEY` is fully configured and the value of `GROQ_MODEL` is active. |
| Duplicate assistant responses | Meta webhook retries when responses exceed 5s. | Ensure the background worker completes asynchronously and the webhook handles incoming posts immediately inside <50ms with `200 OK`. |
| Outdated message histories | Sequential array limits. | History mapping recovers the latest 20 messages sorted chronologically dynamically. |