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

## Desarrollo en Windows

El repositorio es **100% multiplataforma**: todos los scripts (`dev`, `build`, `lint`, `test:unit`, `test:e2e`, `governance`, `subaru`, `doctor`) usan únicamente `npx`/`node`/`next`/`vitest`/`playwright`/`tsx`, sin dependencia de shell Unix (verificado: cero `spawn`/`bash -c`/`process.platform` en `src/`, `scripts/`, `workshop/` y `services/`). Las reglas de fin de línea están selladas en [`.gitattributes`](.gitattributes): **LF en el repositorio**, checkout nativo según el sistema.

### Requisitos

- **Node.js 22** (`>=22 <23`): usa [fnm](https://github.com/Schniz/fnm) o [nvm-windows](https://github.com/coreybutler/nvm-windows). El instalador genérico de nodejs.org puede darte otra versión.
- **npm ≥ 10**.
- **git-crypt** para descifrar `.env.local` y `services/whatsapp-bridge/.env`.
- **Playwright**: `npx playwright install chromium` (o `npm run test:install`).

### Puesta en marcha (PowerShell / cmd)

```powershell
# 1. Clonar y descifrar las variables de entorno (requiere la llave git-crypt del equipo)
git clone https://github.com/arbojo/mia-platform.git
cd mia-platform
git-crypt unlock path\to\llave

# 2. Dependencias e inicio — idéntico a Linux
npm ci
npm run dev
```

Los comandos de calidad son los mismos que en Linux: `npm run lint`, `npm run build`, `npm run test:unit`, `npm test` (e2e), `npm run governance`, `npm run subaru`. El bridge (`services/whatsapp-bridge`) corre igual: `npm install && npm run dev`.

### Notas

- **Fin de línea**: no edites `.gitattributes`. `* text=auto` normaliza a LF en el repositorio y hace checkout con CRLF en Windows. `*.sh` queda forzado a LF (un CRLF en el shebang rompería WSL/Git-Bash) y `*.bat` a CRLF.
- **git-crypt**: `.env.local` y `services/whatsapp-bridge/.env` están cifrados en el repo. Sin `git-crypt unlock`, el login y la IA fallarán en runtime. Nunca los subas en claro.
- **Alternativa**: si prefieres un clon exacto del entorno Linux (incluye `start.sh`, `doctor`, etc.), usa **WSL2** y trabaja sobre el repo montado.
- **Distribución**: en Windows, `npm run distribute` genera `mia-evaluation.zip` con `start.bat` y `start.sh` incluidos. Ver [README-DISTRIBUTE.md](README-DISTRIBUTE.md).

## Database

Run the migrations in `supabase/migrations/` in order:

1. `001_initial_schema.sql` — Core tables (businesses, assistants, products, etc.)
2. `002_lab_sessions.sql` — Laboratory tables
