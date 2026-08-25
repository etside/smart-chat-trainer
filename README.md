# Daddy AI — Voice-First AI Sales Training Platform

A production-ready, voice-first training console for AI sales agents. Train agents through natural conversation, sync inventory in real time, and deploy across omnichannel platforms.

**Built with [Lovable](https://lovable.dev)**

## Features

- **Voice Training** — Record voice messages to train AI agents. Transcription and structured extraction built in.
- **Omnichannel Deploy** — Connect trained agents to WhatsApp, Instagram, Facebook, and web chat.
- **Real-time Inventory Sync** — Direct ERP integration keeps pricing, stock, and product data current.
- **Skill Builder** — Generate customer-facing questions from training data using LLM-powered pipelines.
- **API & White Label** — REST API for programmatic access. White-label program for reselling under your brand.
- **MCP Integration** — Connect ChatGPT, Claude, and Claude Code directly to your training data.
- **RBAC** — Role-based access control (admin / editor / viewer) for team management.
- **GDPR Compliant** — Data encryption, privacy requests, and full data portability.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (SSR) + TanStack Router |
| UI | shadcn/ui + Tailwind CSS |
| Auth & DB | Supabase (Auth + PostgreSQL) |
| AI | Google Gemini (via API gateway) |
| Voice | Web Speech API / browser transcription |
| MCP | `@lovable.dev/mcp-js` |
| Hosting | Vercel / Lovable |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun
- Supabase project (database + auth)

### Installation

```bash
git clone <repository-url>
cd smart-chat-trainer
npm install
```

### Environment Variables

Create a `.env.local` file with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Development

```bash
npm run dev
```

The app runs at `http://localhost:3000` by default.

### Production Build

```bash
npm run build
npm run start
```

> **Note:** `vite build` generates `src/routeTree.gen.ts` from file-based routes. Always run build before type-checking.

## Project Structure

```
src/
├── routes/                  # File-based routes (TanStack Router)
│   ├── index.tsx            # Landing page
│   ├── auth.tsx             # Login / signup
│   ├── connect.tsx          # MCP integration guide
│   ├── faq.tsx              # Frequently asked questions
│   ├── api.tsx              # API docs & white-label info
│   ├── privacy.tsx          # Privacy policy
│   ├── terms.tsx            # Terms of service
│   ├── admin.tsx            # Admin layout (sidebar + nav)
│   ├── admin.index.tsx      # Dashboard
│   ├── admin.training.tsx   # Training data management
│   ├── admin.playground.tsx # AI playground
│   ├── admin.skill-builder.tsx # Skill generation wizard
│   ├── admin.api-keys.tsx   # API key management
│   └── ...
├── lib/
│   ├── console.functions.ts # Server functions (stats, API keys, export)
│   ├── skill-builder.functions.ts # Skill generation pipeline
│   └── supabase/            # Supabase client config
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── ConfirmModal.tsx
│   ├── SupportModal.tsx
│   └── VoiceRecorder.tsx
└── integrations/supabase/   # Supabase type definitions
```

## API

Daddy AI provides a REST API for programmatic access.

### Authentication

```bash
Authorization: Bearer <your_api_key>
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/training-pairs` | List training data |
| `POST` | `/api/v1/training-pairs` | Create training pair |
| `GET` | `/api/v1/conversations` | List conversations |
| `GET` | `/api/v1/analytics` | Usage analytics |
| `POST` | `/api/v1/sync` | Trigger inventory sync |

### Rate Limits

- Default: 60 requests/minute per key
- Configurable per key
- Token caps available

See the [API documentation page](/api) for full details.

## MCP Integration

Connect AI assistants to Daddy AI via the Model Context Protocol.

```bash
# Claude Code
claude mcp add --transport sse daddy-ai https://your-app.vercel.app/mcp
```

Supported clients: ChatGPT, Claude.ai, Claude Code, and any MCP-compatible tool.

See the [Connect page](/connect) for setup instructions.

## White Label

Resell Daddy AI under your own brand:
- Custom-branded dashboard
- Isolated infrastructure per partner
- Full API access
- SDKs for JavaScript, Python, and Go

See the [API & White Label page](/api) for partnership details.

## Deployment

### Lovable (Recommended)

Push to `main` and Lovable auto-deploys. Every commit triggers a build.

### Vercel

```bash
npm run build
vercel deploy
```

### CI/CD

GitHub Actions workflow (`.github/workflows/build.yml`) runs build and type-check on every push.

## License

Proprietary. All rights reserved.
