# 🛡️ RIPS Guard — Auditor de Facturación Médica con IA

> Sube tu RIPS Nueva Generación. La IA detecta y corrige errores en segundos.  
> Sin glosas. Sin reprocesos. Sin dinero congelado.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)
[![GitHub Pages](https://img.shields.io/badge/Landing-GitHub%20Pages-brightgreen)](https://fjfc1984-bit.github.io/ripsguard)

---

## ¿Qué problema resuelve?

Las IPS colombianas pierden entre **$12M y $40M COP al mes** por glosas de EPS causadas por errores en los archivos RIPS: códigos CUPS inválidos, diagnósticos CIE-10 incompatibles, campos vacíos, valores fuera de rango. El proceso manual de revisión toma horas y requiere personal experto.

**RIPS Guard** audita automáticamente los archivos JSON del **RIPS Nueva Generación** (Resolución 2275 de 2023) contra más de 3.000 reglas de validación y usa Claude (IA) para sugerir correcciones precisas antes de radicar a la EPS.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE                              │
│  Landing (GitHub Pages)  ·  App (Next.js 14)               │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS / X-Tenant-Id
┌──────────────────▼──────────────────────────────────────────┐
│                   BACKEND (FastAPI)                         │
│                                                             │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ rips_parser │  │validation_eng.│  │  ai_corrector    │  │
│  │  JSON→model │  │ 3.000+ reglas │  │  Claude API      │  │
│  └─────────────┘  └───────────────┘  └──────────────────┘  │
│                                                             │
│  ┌──────────────────┐  ┌───────────────────────────────┐   │
│  │ stripe_integr.   │  │ email_service (Resend)        │   │
│  │ Billing + Webhks │  │ Bienvenida/Trial/Pagos        │   │
│  └──────────────────┘  └───────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                 DATOS / SERVICIOS EXTERNOS                   │
│  Supabase (PostgreSQL + Auth + RLS)  ·  Stripe  ·  Resend   │
└─────────────────────────────────────────────────────────────┘
```

### Multi-tenancy

Cada IPS es un **tenant** aislado. El JWT de Supabase lleva `app_metadata.tenant_id`, y todas las tablas aplican RLS con la función `auth_tenant_id()`. El backend agrega el header `X-Tenant-Id` en cada request para trazabilidad.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Landing | HTML/CSS/JS estático → GitHub Pages |
| Frontend app | Next.js 14 (App Router) + Tailwind |
| Backend API | FastAPI + Uvicorn |
| IA | Anthropic Claude (claude-3-5-sonnet) |
| Base de datos | Supabase (PostgreSQL 15 + RLS + Auth) |
| Pagos | Stripe (COP, suscripciones) |
| Email | Resend |
| Deploy backend | Railway.app (Docker) |
| CI/CD | GitHub Actions |

---

## Archivos del proyecto

```
ripsguard/
├── index.html               # Landing page (GitHub Pages)
├── rips_demo_errores.json   # Archivo RIPS de demo con 8 errores sembrados
│
├── worker.py                # FastAPI app principal (orquestador)
├── rips_parser.py           # Parser RIPS Nueva Generación JSON
├── validation_engine.py     # Motor de 3.000+ reglas de validación
├── ai_corrector.py          # Integración Claude para correcciones
│
├── stripe_integration.py    # API de facturación (Stripe)
├── email_service.py         # Emails transaccionales (Resend)
│
├── supabase_setup.sql       # Schema completo + RLS + datos semilla
│
├── Dockerfile               # Imagen Python 3.11-slim (no-root)
├── docker-compose.yml       # Stack local (api + billing + stripe-cli)
├── railway.toml             # Config de deploy en Railway.app
├── requirements.txt         # Dependencias Python
├── .env.example             # Variables de entorno necesarias
│
└── ripsguard_nextjs_app.tsx # Scaffold Next.js (componente único)
```

---

## Configuración local

### 1. Clonar y crear entorno

```bash
git clone https://github.com/fjfc1984-bit/ripsguard.git
cd ripsguard
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

### 2. Variables de entorno

Edita `.env` con tus claves reales:

```env
# IA
ANTHROPIC_API_KEY=sk-ant-...

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...   # Después del setup
STRIPE_PRICE_PRO=price_...

# App
APP_URL=http://localhost:3000
API_URL=http://localhost:8000

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=RIPS Guard <noreply@ripsguard.co>
```

### 3. Configurar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** y ejecutar `supabase_setup.sql` completo
3. Copiar **URL** y **anon/service keys** al `.env`

### 4. Configurar Stripe

```bash
# Crear productos/precios en tu cuenta Stripe
python stripe_integration.py setup

# El comando imprime los price IDs — agrégalos al .env:
# STRIPE_PRICE_STARTER=price_xxxx
# STRIPE_PRICE_PRO=price_yyyy
```

Para webhooks locales instala [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to http://localhost:8001/billing/webhook
```

### 5. Levantar con Docker Compose

```bash
docker compose up --build
```

- API principal: http://localhost:8000
- API billing: http://localhost:8001
- Docs interactivas: http://localhost:8000/docs

### 6. Levantar sin Docker

```bash
# Terminal 1 — API principal
uvicorn worker:app --reload --port 8000

# Terminal 2 — Billing
uvicorn stripe_integration:app --reload --port 8001
```

---

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/audit/upload` | Subir archivo RIPS JSON |
| `GET` | `/audit/{session_id}` | Resultado de auditoría |
| `POST` | `/audit/{session_id}/accept` | Aceptar corrección de IA |
| `GET` | `/billing/plans` | Planes disponibles |
| `POST` | `/billing/checkout` | Crear sesión de pago |
| `POST` | `/billing/webhook` | Webhook Stripe |

Header requerido en todos los endpoints (excepto `/health`):
```
X-Tenant-Id: <uuid-del-tenant>
```

---

## Reglas de validación (muestra)

| Código | Tipo | Descripción |
|--------|------|-------------|
| R-CUPS-001 | ERROR | Código CUPS no existe en Manual CUPS vigente |
| R-CIE10-001 | ERROR | Código CIE-10 no existe en clasificación MSPS |
| R-CIE10-002 | WARNING | Diagnóstico incompatible con el procedimiento CUPS |
| R-VAL-001 | ERROR | Valor de servicio = $0 (excepto plan de beneficios) |
| R-VAL-002 | WARNING | Valor fuera del rango típico para el procedimiento |
| R-FECHA-001 | ERROR | Fecha de salida anterior a fecha de ingreso |
| R-DOC-001 | ERROR | Número de documento de identidad vacío |

Ver tabla completa en `supabase_setup.sql` (sección `INSERT INTO validation_rules`).

---

## Planes SaaS

| | Starter | Pro | Enterprise |
|--|---------|-----|-----------|
| **Precio/mes** | $350.000 COP | $1.200.000 COP | A convenir |
| **Registros/auditoría** | 50.000 | 500.000 | Ilimitados |
| **Usuarios** | 3 | 10 | Ilimitados |
| **Trial** | 14 días | 14 días | Demo personalizada |
| **Soporte** | Email | Email + WhatsApp | Dedicado |

---

## Deploy en producción

### Railway.app (recomendado)

1. Fork este repositorio
2. Ir a [railway.app/new](https://railway.app/new) → **Deploy from GitHub**
3. Seleccionar el repo
4. Agregar las variables de entorno del `.env.example`
5. Railway detecta automáticamente el `Dockerfile` y `railway.toml`

### Variables obligatorias en Railway

```
ANTHROPIC_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER
STRIPE_PRICE_PRO
APP_URL
```

---

## Normativa aplicada

- **Resolución 2275 de 2023** — RIPS Nueva Generación (estructura JSON)
- **Resolución 3100 de 2019** — Habilitación de servicios de salud
- **Resolución 2192 de 2023** — Manual CUPS actualizado
- **CIE-10 MSPS Colombia** — Versión vigente diagnósticos
- **Ley Estatutaria 1581 de 2012** — Habeas Data / privacidad
- **Decreto 2309 de 2002** — Sistema Obligatorio de Garantía de la Calidad

---

## Seguridad

- Multi-tenancy con RLS en todas las tablas de Supabase
- JWT verificado en cada request (Supabase Auth)
- Secrets nunca en el repositorio (`.env` en `.gitignore`)
- Contenedor Docker en usuario no-root (`appuser`)
- Webhook Stripe verificado con firma HMAC (`stripe.Webhook.construct_event`)
- Rate limiting recomendado: nginx/Cloudflare frente al API

---

## Licencia

Propietario — © 2026 RIPS Guard. Todos los derechos reservados.  
Para licencias de uso o API, contactar: hola@ripsguard.co

---

*Construido con ❤️ para el sector salud colombiano · 2026*
