# RIPS Guard - Frontend Next.js 14

Aplicación web para auditoría de archivos RIPS Nueva Generación (Resolución 2275 de 2023).

## Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: Supabase SSR
- **Styling**: Tailwind CSS
- **Deploy**: Vercel

## Variables de entorno

Copiar `.env.local.example` a `.env.local` y completar:

```bash
cp .env.local.example .env.local
```

## Desarrollo local

```bash
npm install
npm run dev
```

## Estructura

```
app/
  layout.tsx          # Root layout
  page.tsx            # Landing page
  globals.css
  auth/
    callback/route.ts # OAuth callback
    signout/route.ts  # Signout handler
  dashboard/
    layout.tsx        # Dashboard layout con sidebar
    page.tsx          # Dashboard home
    audit/
      page.tsx        # Upload y validar RIPS
      results/page.tsx # Resultados de auditoría
    billing/page.tsx  # Suscripción y pagos
  login/page.tsx
  register/page.tsx
lib/
  api.ts             # Cliente FastAPI
  supabase/
    client.ts         # Supabase browser client
    server.ts         # Supabase server client
```
