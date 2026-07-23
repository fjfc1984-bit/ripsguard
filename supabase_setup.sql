-- ═══════════════════════════════════════════════════════════════════
-- RIPS Guard — Supabase Setup Completo
-- Ejecutar en Supabase SQL Editor (en orden)
-- ═══════════════════════════════════════════════════════════════════

-- ── 0. EXTENSIONES ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. ENUMs ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE tipo_prestador AS ENUM (
    'hospital','clinica','ips_ambulatoria',
    'profesional_independiente','laboratorio','imagenes','otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE plan_tipo AS ENUM ('starter','pro','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE suscripcion_estado AS ENUM (
    'trial','activa','pausada','cancelada','vencida'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_rol AS ENUM (
    'owner','admin','auditor','viewer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE archivo_tipo AS ENUM ('json','zip','xml');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_estado AS ENUM (
    'pending','processing','completado','error'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE error_tipo AS ENUM (
    'CUPS_INVALIDO','CUPS_INACTIVO',
    'CIE10_INVALIDO','CIE10_INCOMPATIBLE_PROCEDIMIENTO',
    'VALOR_CERO','VALOR_FUERA_RANGO',
    'FECHA_INVALIDA','FECHA_FUTURA','FECHA_ANTERIOR_NACIMIENTO',
    'DUPLICADO_REGISTRO',
    'CAMPO_OBLIGATORIO_VACIO','TIPO_DOCUMENTO_INVALIDO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE error_severidad AS ENUM ('critico','advertencia','informativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE correccion_origen AS ENUM ('ia','manual','regla');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE correccion_estado AS ENUM ('pendiente','aceptada','rechazada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. TABLAS ────────────────────────────────────────────────────────

-- 2.1 TENANTS (clínicas / IPS)
CREATE TABLE IF NOT EXISTS tenants (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre           TEXT NOT NULL,
  nit              TEXT UNIQUE,
  tipo_prestador   tipo_prestador NOT NULL DEFAULT 'clinica',
  ciudad           TEXT,
  departamento     TEXT,
  telefono         TEXT,
  email_contacto   TEXT,
  logo_url         TEXT,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 SUSCRIPCIONES
CREATE TABLE IF NOT EXISTS subscriptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan             plan_tipo NOT NULL DEFAULT 'starter',
  estado           suscripcion_estado NOT NULL DEFAULT 'trial',
  trial_ends_at    TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  stripe_customer_id   TEXT,
  stripe_subscription_id TEXT,
  precio_cop       NUMERIC(12,0) DEFAULT 350000,
  max_registros_mes INTEGER DEFAULT 50000,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- 2.3 USUARIOS (extiende auth.users de Supabase)
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  cargo            TEXT,
  rol              user_rol NOT NULL DEFAULT 'auditor',
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_acceso    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 SESIONES DE AUDITORÍA
CREATE TABLE IF NOT EXISTS audit_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id),
  nombre_archivo      TEXT NOT NULL,
  tipo_archivo        archivo_tipo NOT NULL DEFAULT 'json',
  tamaño_bytes        BIGINT,
  estado              session_estado NOT NULL DEFAULT 'pending',
  total_registros     INTEGER DEFAULT 0,
  total_errores       INTEGER DEFAULT 0,
  total_criticos      INTEGER DEFAULT 0,
  total_advertencias  INTEGER DEFAULT 0,
  valor_total_cop     NUMERIC(16,0) DEFAULT 0,
  valor_en_riesgo_cop NUMERIC(16,0) DEFAULT 0,
  porcentaje_riesgo   NUMERIC(5,2) DEFAULT 0,
  periodo_facturacion TEXT,                     -- ej: "2024-06"
  eps_destino         TEXT,                     -- ej: "SURA", "SANITAS"
  procesado_at        TIMESTAMPTZ,
  error_mensaje       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 REGISTROS RIPS (individual por fila del JSON)
CREATE TABLE IF NOT EXISTS rips_records (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  seccion          TEXT NOT NULL,               -- AC, AP, AU, AH, AN, AM, AT, AD
  numero_fila      INTEGER NOT NULL,
  num_documento    TEXT,
  fecha_servicio   DATE,
  codigo_cups      TEXT,
  codigo_cie10     TEXT,
  valor_servicio   NUMERIC(14,0),
  datos_raw        JSONB,                       -- fila completa del RIPS
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 REGLAS DE VALIDACIÓN (catálogo configurable)
CREATE TABLE IF NOT EXISTS validation_rules (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo           TEXT UNIQUE NOT NULL,        -- ej: "R-CUPS-001"
  nombre           TEXT NOT NULL,
  descripcion      TEXT,
  tipo_error       error_tipo NOT NULL,
  severidad        error_severidad NOT NULL DEFAULT 'critico',
  activa           BOOLEAN NOT NULL DEFAULT TRUE,
  solo_para_plan   plan_tipo,                   -- NULL = aplica a todos
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.7 FINDINGS (errores encontrados)
CREATE TABLE IF NOT EXISTS audit_findings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  record_id        UUID REFERENCES rips_records(id),
  regla_id         UUID REFERENCES validation_rules(id),
  tipo_error       error_tipo NOT NULL,
  severidad        error_severidad NOT NULL DEFAULT 'critico',
  seccion          TEXT NOT NULL,
  numero_fila      INTEGER NOT NULL,
  campo            TEXT NOT NULL,
  valor_incorrecto TEXT,
  descripcion      TEXT NOT NULL,
  valor_en_riesgo  NUMERIC(14,0) DEFAULT 0,
  sugerencia_ia    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 CORRECCIONES (aceptadas / rechazadas por el auditor)
CREATE TABLE IF NOT EXISTS corrections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  finding_id       UUID NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id),
  origen           correccion_origen NOT NULL DEFAULT 'ia',
  estado           correccion_estado NOT NULL DEFAULT 'pendiente',
  campo            TEXT NOT NULL,
  valor_original   TEXT,
  valor_sugerido   TEXT NOT NULL,
  valor_aplicado   TEXT,
  justificacion    TEXT,
  confianza_ia     NUMERIC(3,2),               -- 0.00 a 1.00
  alternativas     TEXT[],
  revisado_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.9 REPORTES GENERADOS
CREATE TABLE IF NOT EXISTS audit_reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL DEFAULT 'pdf',  -- pdf, xlsx, json
  url              TEXT,
  generado_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_at        TIMESTAMPTZ
);

-- ── 3. ÍNDICES ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_tenant     ON audit_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_estado     ON audit_sessions(estado);
CREATE INDEX IF NOT EXISTS idx_sessions_created    ON audit_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_session    ON audit_findings(session_id);
CREATE INDEX IF NOT EXISTS idx_findings_tenant     ON audit_findings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_findings_severidad  ON audit_findings(severidad);
CREATE INDEX IF NOT EXISTS idx_findings_tipo_error ON audit_findings(tipo_error);
CREATE INDEX IF NOT EXISTS idx_records_session     ON rips_records(session_id);
CREATE INDEX IF NOT EXISTS idx_records_cups        ON rips_records(codigo_cups);
CREATE INDEX IF NOT EXISTS idx_records_cie10       ON rips_records(codigo_cie10);
CREATE INDEX IF NOT EXISTS idx_corrections_finding ON corrections(finding_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant        ON users(tenant_id);

-- ── 4. TRIGGERS updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'tenants','users','audit_sessions','subscriptions'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON %I;
       CREATE TRIGGER trg_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at();', t, t
    );
  END LOOP;
END $$;

-- ── 5. ROW LEVEL SECURITY ────────────────────────────────────────────

-- Helper: extrae tenant_id del JWT de Supabase Auth
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID;
$$;

-- Helper: extrae el rol del JWT
CREATE OR REPLACE FUNCTION auth_user_rol() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'rol';
$$;

-- Habilitar RLS
ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rips_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports    ENABLE ROW LEVEL SECURITY;

-- Política base: cada tenant ve solo sus propios datos
CREATE POLICY "tenant_isolation_tenants"     ON tenants          USING (id = auth_tenant_id());
CREATE POLICY "tenant_isolation_subs"        ON subscriptions    USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_isolation_users"       ON users            USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_isolation_sessions"    ON audit_sessions   USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_isolation_records"     ON rips_records     USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_isolation_findings"    ON audit_findings   USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_isolation_corrections" ON corrections      USING (tenant_id = auth_tenant_id());
CREATE POLICY "tenant_isolation_reports"     ON audit_reports    USING (tenant_id = auth_tenant_id());

-- Solo owners y admins pueden insertar/actualizar tenants
CREATE POLICY "admin_write_tenants" ON tenants
  FOR ALL USING (
    id = auth_tenant_id() AND
    auth_user_rol() IN ('owner','admin')
  );

-- validation_rules es pública (lectura)
ALTER TABLE validation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_rules" ON validation_rules FOR SELECT USING (TRUE);

-- ── 6. SEED: REGLAS DE VALIDACIÓN ────────────────────────────────────
INSERT INTO validation_rules (codigo, nombre, tipo_error, severidad, descripcion) VALUES
  ('R-CUPS-001', 'CUPS inválido',              'CUPS_INVALIDO',                    'critico',      'El código CUPS no existe en el Manual CUPS vigente (Res. 2192/2023)'),
  ('R-CUPS-002', 'CUPS inactivo',              'CUPS_INACTIVO',                    'advertencia',  'El código CUPS existe pero fue eliminado o reemplazado en la versión vigente'),
  ('R-CIE10-001','CIE-10 inválido',            'CIE10_INVALIDO',                   'critico',      'El código CIE-10 no existe en la clasificación MSPS Colombia vigente'),
  ('R-CIE10-002','CIE-10 incompatible',        'CIE10_INCOMPATIBLE_PROCEDIMIENTO', 'critico',      'El diagnóstico CIE-10 es clínicamente incompatible con el procedimiento CUPS'),
  ('R-VAL-001',  'Valor en cero',              'VALOR_CERO',                       'critico',      'El vrServicio es $0. Todo servicio prestado debe tener un valor positivo'),
  ('R-VAL-002',  'Valor fuera de rango',       'VALOR_FUERA_RANGO',                'advertencia',  'El vrServicio está fuera del rango tarifario esperado para este CUPS'),
  ('R-FECHA-001','Fecha inválida',             'FECHA_INVALIDA',                   'critico',      'La fechaFin es anterior a la fechaInicio o el formato es incorrecto'),
  ('R-FECHA-002','Fecha futura',               'FECHA_FUTURA',                     'advertencia',  'La fecha de atención es posterior a la fecha de generación del RIPS'),
  ('R-FECHA-003','Fecha anterior al nacimiento','FECHA_ANTERIOR_NACIMIENTO',        'critico',      'La fecha de atención es anterior a la fecha de nacimiento del paciente'),
  ('R-DUP-001',  'Registro duplicado',         'DUPLICADO_REGISTRO',               'advertencia',  'Existe otro registro idéntico (mismo paciente, fecha, CUPS y valor) en el RIPS'),
  ('R-CAMP-001', 'Campo obligatorio vacío',    'CAMPO_OBLIGATORIO_VACIO',          'critico',      'Un campo requerido por la Resolución 2275/2023 está vacío o nulo'),
  ('R-DOC-001',  'Tipo de documento inválido', 'TIPO_DOCUMENTO_INVALIDO',          'critico',      'El tipo de documento de identidad no está en la lista oficial MSPS')
ON CONFLICT (codigo) DO NOTHING;

-- ── 7. SEED: TENANT DE PRUEBA (DEMO) ─────────────────────────────────
DO $$
DECLARE
  v_tenant_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  -- Insertar tenant demo
  INSERT INTO tenants (id, nombre, nit, tipo_prestador, ciudad, departamento, email_contacto)
  VALUES (
    v_tenant_id,
    'Clínica Medisalud S.A.S. (DEMO)',
    '900123456-7',
    'clinica',
    'Bogotá',
    'Cundinamarca',
    'facturacion@medisalud.com.co'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Suscripción trial 30 días
  INSERT INTO subscriptions (
    tenant_id, plan, estado,
    trial_ends_at,
    current_period_start, current_period_end,
    precio_cop, max_registros_mes
  )
  VALUES (
    v_tenant_id, 'pro', 'trial',
    NOW() + INTERVAL '30 days',
    NOW(), NOW() + INTERVAL '30 days',
    1200000, 500000
  )
  ON CONFLICT (tenant_id) DO NOTHING;

END $$;

-- ── 8. FUNCIÓN: Estadísticas del tenant ──────────────────────────────
CREATE OR REPLACE FUNCTION get_tenant_stats(p_tenant_id UUID)
RETURNS TABLE (
  total_sesiones         BIGINT,
  sesiones_este_mes      BIGINT,
  total_registros_mes    BIGINT,
  total_errores_mes      BIGINT,
  valor_en_riesgo_mes    NUMERIC,
  tasa_error_promedio    NUMERIC
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COUNT(*)                                      AS total_sesiones,
    COUNT(*) FILTER (
      WHERE created_at >= date_trunc('month', NOW())
    )                                             AS sesiones_este_mes,
    COALESCE(SUM(total_registros) FILTER (
      WHERE created_at >= date_trunc('month', NOW())
    ), 0)                                         AS total_registros_mes,
    COALESCE(SUM(total_errores) FILTER (
      WHERE created_at >= date_trunc('month', NOW())
    ), 0)                                         AS total_errores_mes,
    COALESCE(SUM(valor_en_riesgo_cop) FILTER (
      WHERE created_at >= date_trunc('month', NOW())
    ), 0)                                         AS valor_en_riesgo_mes,
    CASE WHEN SUM(total_registros) > 0
      THEN ROUND(SUM(total_errores)::NUMERIC / SUM(total_registros) * 100, 2)
      ELSE 0
    END                                           AS tasa_error_promedio
  FROM audit_sessions
  WHERE tenant_id = p_tenant_id
    AND estado = 'completado';
$$;

-- ── 9. STORAGE BUCKET (para archivos RIPS subidos) ───────────────────
-- Ejecutar desde Supabase Dashboard → Storage → New Bucket
-- Nombre: "rips-files" | Privado (no público)
-- O via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('rips-files', 'rips-files', false);

-- ── 10. VERIFICACIÓN FINAL ───────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_activo
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
