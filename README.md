# MIA — Asistente de Ventas IA

Plataforma de asistentes de ventas con inteligencia artificial.

## License

Este proyecto es **software propietario**. No es open source ni de uso libre.
Todos los derechos reservados. Ver [LICENSE](LICENSE) para los términos completos.

## Quality Gates

![Lines](badges/coverage-lines.svg)
![Branches](badges/coverage-branches.svg)
![Functions](badges/coverage-functions.svg)
![Statements](badges/coverage-statements.svg)
![E2E](badges/e2e.svg)

> Los badges se regeneran automáticamente tras cada ejecución de tests (local con `npm run test:coverage` / `npm run test:e2e`, y en CI con el job `badges`). Para actualizarlos localmente: `npm run test:badges`.

## Features

- Arquitectura multi-business preparada para SaaS
- Knowledge base con versionado y trazabilidad
- Asistentes con personalidad configurable
- Chat de entrenamiento estilo WhatsApp
- Laboratorio de pruebas con simuladores de clientes
- Sistema de aprendizaje por correcciones
- Tracking de costos de IA

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **UI:** shadcn/ui
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL via Supabase
- **Auth:** Supabase Auth (Email + Google OAuth)
- **AI:** OpenAI (GPT-4o-mini)

## Roadmap

- [x] v0.1 — Foundation (auth, onboarding, chat)
- [ ] v0.2 — Laboratory (simulation, analysis, teaching)
- [ ] v0.3 — WhatsApp integration
- [ ] v0.4 — Multi-channel assistants

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in your Supabase and OpenAI credentials

# Run development server
npm run dev
```

## Database

Run the migrations in `supabase/migrations/` in order:

1. `001_initial_schema.sql` — Core tables (businesses, assistants, products, etc.)
2. `002_lab_sessions.sql` — Laboratory tables
