# n8n Autopilot MCP SaaS

> **AI-Powered Workflow Automation** — Just describe what you want, and we build & run it.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Setup environment
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# Run database migrations
pnpm db:push

# Start development servers
pnpm dev
```

## 📦 Project Structure

```
n8n-autopilot/
├── apps/
│   ├── backend/    # NestJS API + MCP Server
│   └── frontend/   # React + Vite UI
├── packages/
│   └── shared/     # Shared types & utilities
└── docs/           # Documentation
```

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS, TypeScript, Prisma |
| Frontend | React, Vite, TailwindCSS |
| Database | Supabase PostgreSQL + pgvector |
| AI | OpenAI GPT-4 |
| MCP | @modelcontextprotocol/sdk |
| n8n | Self-hosted instance |

## 📚 Documentation

- [Installation Guide](./docs/installation.md)
- [Architecture](./docs/architecture.md)
- [API Reference](./docs/api.md)
- [MCP Tools](./docs/mcp-tools.md)

## 🔑 Environment Variables

See `.env.example` files in each app directory.

## 📄 License

MIT
