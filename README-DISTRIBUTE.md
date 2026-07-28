# MIA - Asistente de Ventas

## Evaluation Edition

MIA es un asistente de ventas inteligente que aprende de tu negocio y conversa con tus clientes.

---

## Requisitos

- **Node.js** 18 o superior (https://nodejs.org)
- **Supabase** account (https://supabase.com)
- **OpenAI** API key (https://platform.openai.com)

---

## Instalación

### Windows

1. Extrae el ZIP en una carpeta
2. Edita el archivo `.env.local` con tus credenciales
3. Ejecuta `start.bat`

### Linux / Mac

1. Extrae el ZIP en una carpeta
2. Edita el archivo `.env.local` con tus credenciales
3. Ejecuta `chmod +x start.sh && ./start.sh`

---

## Configuración

Edita el archivo `.env.local`:

```bash
# Supabase
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# OpenAI
OPENAI_API_KEY=tu_api_key

# Edición (evaluation, professional, enterprise, cloud)
MIA_EDITION=evaluation
```

---

## Uso

1. Ejecuta `start.bat` (Windows) o `./start.sh` (Linux/Mac)
2. Abre tu navegador en `http://localhost:3000`
3. Crea tu cuenta y empieza a configurar tu asistente

---

## Edición Evaluation

| Recurso | Límite |
|---------|--------|
| Negocios | 1 |
| Asistentes | 1 |
| Usuarios | 1 |
| Canales | 1 |
| Conversaciones | 1,000 |
| Productos | Ilimitados |
| Conocimiento | Ilimitado |

### Funcionalidades incluidas

- Demo Chat
- Centro de Conocimiento
- Estudio de Conocimiento
- Simulador de Ventas
- Habilidades de IA
- Memoria del Negocio
- Aprendizaje
- Reportes Semanales
- Dashboard completo

---

## Soporte

- Documentación: `docs/`
- Problemas: https://github.com/arbojo/mia-platform/issues
