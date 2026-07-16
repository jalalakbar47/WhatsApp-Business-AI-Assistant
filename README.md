# WhatsApp Business AI Assistant

An enterprise-ready, high-performance Next.js integration gateway connecting the **Meta WhatsApp Business Cloud API** with **Groq Cloud Large Language Models (LLMs)**. Features a real-time conversation management dashboard, an integrated knowledge retrieval base, and a seamless automated-to-human escalation flow.

## 🚀 Key Features

* **Sub-Second Webhook Handshake**: Decouples API receipt from AI response logic, acknowledging incoming requests instantly with an HTTP `200 OK` to satisfy Meta's strict timeout limits.
* **Groq Cloud Integration**: High-performance inference using the official `openai` SDK pointing to Groq's low-latency endpoints, with custom system prompts.
* **Dynamic Knowledge Base**: Add, edit, and delete business documents directly from the dashboard (`/knowledge`). Each entry is indexed with PostgreSQL full-text search and retrieved at query time to ground every AI response in accurate, up-to-date context (RAG pattern).
* **Supabase Realtime Synchronization**: Interactive dashboard syncing message logs and conversation threads instantaneously via Supabase Realtime subscriptions.
* **Hybrid Agent Routing**: Allows operators to switch between **Agent** (fully automated AI responses) and **Human** (manual chat panel inputs) modes dynamically per recipient.
* **Robust Loop Protection**: Built-in exception thresholds and quota fallbacks to prevent messaging loops or crashing during service limitations.

---

## 🛠️ Architecture Flow

```
Recipient Sends Message 
   ──> Meta WhatsApp Webhook (POST /api/webhook)
   ──> Instantly returns 200 OK to Meta (Acks in <50ms)
   ──> Triggers background job:
       ├── Queries conversation state (Supabase)
       ├── Performs text similarity index search to retrieve details from Knowledge Base
       ├── Retrieves relevant contextual context
       ├── Generates completion using Groq Cloud API
       ├── Dispatches reply to Recipient using WhatsApp Graph API
       └── Logs assistant response to DB (Updates dashboard in real-time)
```

---

## 📦 Tech Stack

* **Core Framework**: Next.js 16 (App Router, TypeScript)
* **Database & Subscriptions**: Supabase (PostgreSQL, Realtime Engine, Full-Text indexing)
* **AI Model Engine**: Google Gemini API (via `@google/genai`)
* **Styling & Layout**: HSL Tailored UI Design System (CSS)

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

| Variable Name | Description |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | System User Access Token from Meta Business settings |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID from WhatsApp > API Setup |
| `WHATSAPP_VERIFY_TOKEN` | Secure verification string configured on webhooks |
| `GROQ_API_KEY` | Developer API Key from Groq Console |
| `GROQ_MODEL` | Intended active Groq model (e.g. `llama-3.3-70b-versatile`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase endpoint URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for database interactions |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for backend transaction bypass |

---

### 3. Initialize Database

You can configure your database either by copying and running the entire contents of the `supabase-schema.sql` file provided in the root of this repository, or by executing the SQL block below inside your Supabase project's SQL Editor:

```sql
create table conversations (
  id uuid default gen_random_uuid() primary key,
  phone text unique not null,
  name text,
  mode text not null default 'agent' check (mode in ('agent', 'human')),
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create table messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  whatsapp_msg_id text unique,
  created_at timestamp with time zone default now()
);

create index idx_messages_conversation on messages(conversation_id);
create index idx_conversations_updated on conversations(updated_at desc);

-- Enable Realtime for the dashboard
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;

-- Create Knowledge Base table
create table knowledge_base (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  tags text[] default '{}',
  created_at timestamp with time zone default now()
);

-- Register full-text search similarity function
create or replace function search_knowledge(search_query text)
 returns table(id uuid, title text, content text, tags text[], similarity real)
 language sql
 security definer
as $function$
  select 
    id, 
    title, 
    content, 
    tags,
    ts_rank(to_tsvector('english', title || ' ' || content), regexp_replace(plainto_tsquery('english', search_query)::text, ' & ', ' | ', 'g')::tsquery) as similarity
  from 
    knowledge_base
  where 
    to_tsvector('english', title || ' ' || content) @@ regexp_replace(plainto_tsquery('english', search_query)::text, ' & ', ' | ', 'g')::tsquery
  order by 
    similarity desc;
$function$;
```

---

### 4. Populate Your Knowledge Base

After running the schema above, open the Knowledge Base dashboard at **`http://localhost:3000/knowledge`** and add your first documents. This is the content your AI will use to answer questions.

#### How It Works

```
User asks a question via WhatsApp
   ──> Webhook receives message
   ──> search_knowledge() runs a full-text similarity query
   ──> Top matching documents are injected into Gemini's system prompt
   ──> Gemini generates a contextualized, grounded reply
   ──> Reply is sent back via WhatsApp Graph API
```

#### Adding a Document (UI)

1. Navigate to **`http://localhost:3000/knowledge`**.
2. Click the **`+ Add Document`** button in the top-right corner.
3. Fill in the three fields:

   | Field | Description | Example |
   |---|---|---|
   | **Title** | Short, descriptive name for the document | `Clinic Location & Hours` |
   | **Content / Facts** | The exact facts the AI should know and cite | `We are located at 123 Main St, open Mon–Fri 9am–6pm.` |
   | **Tags** | Comma-separated keywords to aid search retrieval | `location, hours, address, parking` |

4. Click **Save Document**. The entry is immediately active — the AI will use it on the very next relevant message.

#### Editing & Deleting Documents

- **Edit**: Hover over any document card and click the ✏️ pencil icon. The form re-opens pre-filled.
- **Delete**: Click the 🗑️ trash icon. A confirmation overlay appears before anything is removed.
- **Search**: Use the search bar at the top of the page to filter documents by title, content snippet, or tag.

#### Knowledge Sandbox (Match Tester)

The right-hand panel on the Knowledge page lets you test how user queries map to your documents **before going live**:

1. Type a sample user question (e.g. `"What are your fees?"`).
2. Click **Run Match Test**.
3. The panel shows the top matching documents ranked by similarity score (`0.000 – 1.000`).

Use this to verify that your tags and content are worded in a way that will surface the right documents at the right time.

#### Document Content Best Practices

| ✅ Good | ❌ Avoid |
|---|---|
| Write complete sentences your AI can quote | Single-word bullet lists with no context |
| Include synonyms in tags (`fee, price, cost, pricing`) | Using only one tag per document |
| One topic per document | Mixing unrelated topics in a single entry |
| Keep content concise (50–300 words per doc) | Extremely long documents (dilutes relevance scores) |

#### Example Knowledge Entries

```
Title:   Consultation Fees
Content: A standard consultation is PKR 2,500. Specialist reviews start at PKR 4,000.
         All rates include a follow-up call within 48 hours.
Tags:    fees, pricing, cost, consultation, charges
```

```
Title:   Refund Policy
Content: We offer a full refund within 7 days of purchase if no work has been started.
         Partial refunds are available at the team lead's discretion after work begins.
Tags:    refund, money-back, cancellation, policy
```

---

### 5. Running Locally

Start the development server:

```bash
npm run dev
```

Expose the local server to Meta via an HTTPS tunnel (such as ngrok):

```bash
ngrok http 3000
```

### 6. Webhook Setup on Meta Developer Portal

1. Access your App dashboard at [Meta Developers](https://developers.facebook.com/).
2. Add the **WhatsApp** product.
3. In **Configuration**, specify:
   * **Callback URL**: `https://your-tunnel-subdomain.ngrok-free.app/api/webhook`
   * **Verify Token**: Must match your `WHATSAPP_VERIFY_TOKEN` setup.
4. Go to **Webhook Fields** > **Manage** and subscribe to **messages**.
5. Add target verification phone numbers to your Sandbox recipient whitelist under **API Setup** when running in developer mode.

---

---

## 🌎 Deployment to Production (Vercel)

1. Push your sanitized codebase to a private/public GitHub repository.
2. Initialize/Connect the repository on [Vercel](https://vercel.com).
3. Import the system variables from `.env.local` into Vercel's Environment Settings.
4. Deploy the application.
5. Update the Callback URL inside the Meta Developers WhatsApp Configuration pane to your production domain: `https://your-app.vercel.app/api/webhook`.

---

## 📊 Dashboard Features

### Conversation Dashboard (`/`)
* **Conversation Sidebar**: Lists all active threads sorted by latest activity. Each row shows the contact avatar, name/phone, last message preview, timestamp, and AI/Human mode badge.
* **Live Chat Panel**: WhatsApp-styled dark UI with authentic message bubbles — dark green for AI replies, dark grey for user messages, double-tick indicators, and smooth auto-scroll.
* **Hybrid Mode Switcher**: Per-conversation toggle button in the chat header instantly switches between **AI Active** (automated) and **Human Mode** (manual operator replies).
* **Realtime Sync**: Supabase Realtime subscriptions push new messages and conversation updates to the dashboard without polling.

### Knowledge Base Dashboard (`/knowledge`)
* **Document Grid**: Responsive 3-column card layout with title, content preview, and color-coded tag pills.
* **Inline Search**: Filters cards client-side by title, content, or tag as you type.
* **Add / Edit Modal**: Dark overlay form with Title, Content, and Tags fields. All inputs are saved directly to `knowledge_base` via the REST API.
* **Hover Actions**: Edit (✏️) and Delete (🗑️) icon buttons appear on card hover, with a confirmation overlay before deletion.
* **Knowledge Sandbox**: Right-panel query tester — type any sample question and run `search_knowledge()` to see which documents would be retrieved and their similarity scores.

---

## 🔌 Knowledge Base API Reference

All endpoints are served from `/api/knowledge` and use the Supabase service-role key on the server side.

| Method | Endpoint | Body / Params | Description |
|---|---|---|---|
| `GET` | `/api/knowledge` | — | Returns all documents ordered by `created_at DESC` |
| `POST` | `/api/knowledge` | `{ title, content, tags[] }` | Creates a new knowledge document |
| `PATCH` | `/api/knowledge` | `{ id, title?, content?, tags? }` | Updates an existing document by ID |
| `DELETE` | `/api/knowledge?id=<uuid>` | Query param `id` | Permanently deletes a document by ID |

### Full-Text Search Function

The `search_knowledge(search_query text)` PostgreSQL function is called by the AI layer at response time:

```sql
-- Called internally by the AI service on every incoming message
SELECT * FROM search_knowledge('consultation fee');
-- Returns: id, title, content, tags, similarity (0.0 – 1.0)
```

The function uses `ts_rank` with OR-joined terms so partial matches (e.g. `"fee"` matching `"fees"`) still surface relevant documents.

---

## 🔍 Troubleshooting FAQ

| Incident | Root Cause | Resolution |
|---|---|---|
| Webhook Verification Fails | Mismatch in verify tokens. | Confirm `WHATSAPP_VERIFY_TOKEN` matches in both your local env and Meta portal. |
| Message received, but no AI auto-reply | API Authentication error. | Verify that your `GEMINI_API_KEY` is active and you are targeting a supported `AI_MODEL`. Check runtime logs. |
| Duplicate assistant responses | Meta webhook retries when responses exceed 5 seconds. | Ensure that you have deferred the response generation to a background task so the webhook hook returns `200 OK` in <50ms. |
| Delivery exceptions | Expired Meta tokens. | Make sure to generate and use a permanent System User Token instead of the developer temp token. |
#   W h a t s A p p - B u s i n e s s - A I - A s s i s t a n t  
 