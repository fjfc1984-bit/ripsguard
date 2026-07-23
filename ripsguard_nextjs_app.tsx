/**
 * RIPS Guard — Next.js App (Scaffold Completo)
 * =============================================
 * Archivo único con todos los componentes principales.
 * Para producción, dividir en archivos separados siguiendo la estructura
 * de carpetas comentada al inicio.
 *
 * Estructura de carpetas Next.js 14 (App Router):
 * ─────────────────────────────────────────────
 * app/
 *   layout.tsx              ← RootLayout (providers, fonts)
 *   page.tsx                ← Redirect a /dashboard o /login
 *   login/page.tsx          ← LoginPage (exportado aquí)
 *   register/page.tsx       ← RegisterPage (exportado aquí)
 *   dashboard/
 *     layout.tsx            ← DashboardLayout (sidebar, nav)
 *     page.tsx              ← DashboardHome (KPIs, sesiones recientes)
 *     nueva-auditoria/
 *       page.tsx            ← UploadPage (drag & drop)
 *     auditoria/[id]/
 *       page.tsx            ← ResultsPage (findings, correcciones)
 *     configuracion/
 *       page.tsx            ← SettingsPage (plan, Stripe portal)
 * lib/
 *   supabase/
 *     client.ts             ← createBrowserClient()
 *     server.ts             ← createServerClient() para RSC
 *     middleware.ts         ← refreshSession en cada request
 *   api.ts                  ← Llamadas al FastAPI backend
 *   utils.ts                ← formatCOP, formatDate, cn()
 * middleware.ts             ← Proteger rutas autenticadas
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

interface Finding {
  tipo_error: string;
  severidad: 'critico' | 'advertencia' | 'informativo';
  campo: string;
  valor_incorrecto: string | null;
  descripcion: string;
  seccion: string;
  numero_fila: number;
  valor_en_riesgo: number;
  regla_codigo: string;
  sugerencia_ia: string | null;
}

interface AuditSession {
  session_id: string;
  estado: string;
  nombre_archivo: string;
  created_at: string;
  total_registros: number;
  total_errores: number;
  total_criticos: number;
  valor_en_riesgo: number;
}

interface AuditReport extends AuditSession {
  total_advertencias: number;
  valor_total: number;
  porcentaje_riesgo: number;
  findings: Finding[];
}

type Screen = 'login' | 'register' | 'dashboard' | 'upload' | 'results';

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(' ');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function callAPI(path: string, options?: RequestInit, tenantId = 'demo-tenant') {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'X-Tenant-Id': tenantId, ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────
// ESTILOS (CSS-in-JS inline para demo)
// En producción: usar Tailwind classes
// ─────────────────────────────────────────────

const S = {
  app: { minHeight: '100vh', background: '#0a0e1a', color: '#f9fafb', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" } as React.CSSProperties,
  card: { background: '#111827', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 24 } as React.CSSProperties,
  btn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all .15s', fontFamily: 'inherit' } as React.CSSProperties,
  input: { width: '100%', background: '#1f2937', border: '1px solid rgba(255,255,255,.08)', color: '#f9fafb', fontSize: 14, padding: '10px 14px', borderRadius: 10, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' } as React.CSSProperties,
};

// ─────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────

export function LoginPage({ onLogin, onGoRegister }: { onLogin: () => void; onGoRegister: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      // En producción: supabase.auth.signInWithPassword({ email, password })
      await new Promise(r => setTimeout(r, 800)); // Simular delay
      if (email && password) onLogin();
      else setError('Credenciales incorrectas');
    } catch {
      setError('Error al iniciar sesión');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>🛡️ RIPS<span style={{ color: '#60a5fa' }}>Guard</span></div>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Ingresa a tu cuenta</p>
        </div>
        <div style={S.card}>
          {error && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#f87171', fontSize: 13 }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Correo electrónico</label>
              <input style={S.input} type="email" placeholder="tu@clinica.com.co" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Contraseña</label>
              <input style={S.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} style={{ ...S.btn, background: '#3b82f6', color: '#fff', width: '100%', justifyContent: 'center', opacity: loading ? .7 : 1 }}>
              {loading ? 'Ingresando...' : 'Ingresar →'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 16 }}>
            ¿No tienes cuenta?{' '}
            <button onClick={onGoRegister} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Regístrate gratis</button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REGISTER PAGE
// ─────────────────────────────────────────────

export function RegisterPage({ onRegister, onGoLogin }: { onRegister: () => void; onGoLogin: () => void }) {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', institucion: '', tipo: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // En producción: supabase.auth.signUp() → crear tenant → asignar trial
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    onRegister();
  };

  return (
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>🛡️ RIPS<span style={{ color: '#60a5fa' }}>Guard</span></div>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>Prueba gratis 30 días · Sin tarjeta de crédito</p>
        </div>
        <div style={S.card}>
          <form onSubmit={handleSubmit}>
            {[
              { key: 'nombre', label: 'Nombre completo', placeholder: 'Dr. Juan Pérez', type: 'text' },
              { key: 'email', label: 'Correo electrónico', placeholder: 'juan@clinica.com.co', type: 'email' },
              { key: 'password', label: 'Contraseña', placeholder: '8 caracteres mínimo', type: 'password' },
              { key: 'institucion', label: 'Nombre de la institución', placeholder: 'Clínica San José S.A.S.', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>{f.label}</label>
                <input style={S.input} type={f.type} placeholder={f.placeholder}
                  value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Tipo de institución</label>
              <select style={S.input} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} required>
                <option value="">Selecciona...</option>
                {['Hospital', 'Clínica', 'IPS ambulatoria', 'Profesional independiente', 'Laboratorio / Imágenes'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={loading} style={{ ...S.btn, background: '#3b82f6', color: '#fff', width: '100%', justifyContent: 'center', opacity: loading ? .7 : 1 }}>
              {loading ? 'Creando cuenta...' : 'Comenzar prueba gratis →'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', marginTop: 12 }}>
            Al registrarte aceptas nuestros Términos de Uso y la Política de Privacidad (Ley 1581/2012)
          </p>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 12 }}>
            ¿Ya tienes cuenta?{' '}
            <button onClick={onGoLogin} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Iniciar sesión</button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// UPLOAD PAGE (Nueva Auditoría)
// ─────────────────────────────────────────────

export function UploadPage({ onResult }: { onResult: (report: AuditReport) => void }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (f: File) => {
    setFile(f); setLoading(true);
    const steps = ['Parseando archivo RIPS...', 'Ejecutando 3.000+ reglas de validación...', 'Aplicando correcciones con IA...', 'Generando reporte...'];

    // Simular progreso visual
    for (const step of steps) {
      setProgress(p => [...p, step]);
      await new Promise(r => setTimeout(r, 700));
    }

    try {
      const formData = new FormData();
      formData.append('file', f);
      const session: AuditSession = await callAPI('/audit/upload', { method: 'POST', body: formData });
      const report: AuditReport = await callAPI(`/audit/${session.session_id}/report`);
      onResult(report);
    } catch {
      // En demo: usar datos simulados
      onResult(DEMO_REPORT);
    } finally { setLoading(false); }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.json') || f.name.endsWith('.zip'))) processFile(f);
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
      <div style={{ fontSize: 48 }}>🔍</div>
      <h2 style={{ color: '#f9fafb', marginBottom: 8 }}>Auditando {file?.name}</h2>
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {progress.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: i === progress.length - 1 ? '#60a5fa' : '#22c55e', fontSize: 14 }}>
            <span>{i === progress.length - 1 ? '⏳' : '✅'}</span>
            {step}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Nueva Auditoría</h1>
      <p style={{ color: '#9ca3af', marginBottom: 24 }}>Sube tu archivo RIPS en formato JSON o ZIP (Resolución 2275 de 2023)</p>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#3b82f6' : 'rgba(255,255,255,.12)'}`,
          borderRadius: 16,
          padding: '64px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(59,130,246,.05)' : 'rgba(255,255,255,.02)',
          transition: 'all .2s',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Arrastra tu archivo RIPS aquí</h3>
        <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 16 }}>o haz click para seleccionar</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['.json — RIPS Nueva Generación', '.zip — Paquete de archivos'].map(t => (
            <span key={t} style={{ background: 'rgba(59,130,246,.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,.2)', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>{t}</span>
          ))}
        </div>
        <input ref={inputRef} type="file" accept=".json,.zip" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 24 }}>
        {[
          { icon: '⚡', title: 'Resultados en < 30 seg', desc: 'Análisis instantáneo sin importar el tamaño del archivo' },
          { icon: '🤖', title: 'IA correctora', desc: 'Claude sugiere el CUPS/CIE-10 correcto con justificación normativa' },
          { icon: '🔒', title: 'Datos seguros', desc: 'Cifrado AES-256 · Cumplimiento Ley 1581/2012' },
        ].map(item => (
          <div key={item.title} style={{ ...S.card, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{item.title}</div>
            <p style={{ color: '#9ca3af', fontSize: 12, lineHeight: 1.5 }}>{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// RESULTS PAGE
// ─────────────────────────────────────────────

export function ResultsPage({ report, onNew }: { report: AuditReport; onNew: () => void }) {
  const [filter, setFilter] = useState<'todos' | 'critico' | 'advertencia'>('todos');
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = report.findings.filter(f =>
    filter === 'todos' || f.severidad === filter
  );

  const kpis = [
    { label: 'Registros auditados', value: report.total_registros.toLocaleString('es-CO'), icon: '📋', color: '#60a5fa' },
    { label: 'Errores encontrados', value: report.total_errores, icon: '⚠️', color: '#f59e0b' },
    { label: 'Críticos', value: report.total_criticos, icon: '🚨', color: '#ef4444' },
    { label: 'Valor en riesgo', value: formatCOP(report.valor_en_riesgo), icon: '💰', color: '#22c55e' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>📊 Reporte: {report.nombre_archivo}</h1>
          <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
            Auditado el {formatDate(report.created_at)} · {report.porcentaje_riesgo.toFixed(1)}% de la cartera en riesgo
          </p>
        </div>
        <button onClick={onNew} style={{ ...S.btn, background: '#3b82f6', color: '#fff' }}>+ Nueva auditoría</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...S.card }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Alerta si hay críticos */}
      {report.total_criticos > 0 && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🚨</span>
          <div>
            <strong style={{ color: '#f87171' }}>{report.total_criticos} errores críticos</strong>
            <span style={{ color: '#9ca3af', fontSize: 13 }}> — La EPS devolverá o congelará estos registros si se radican sin corregir.</span>
          </div>
        </div>
      )}

      {/* Tabla de findings */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 600 }}>Hallazgos ({filtered.length})</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['todos', 'critico', 'advertencia'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                ...S.btn,
                padding: '6px 14px',
                fontSize: 12,
                background: filter === f ? (f === 'critico' ? '#ef4444' : f === 'advertencia' ? '#f59e0b' : '#3b82f6') : 'rgba(255,255,255,.05)',
                color: filter === f ? '#fff' : '#9ca3af',
              }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.map((f, i) => (
            <div key={i}>
              <div
                onClick={() => setExpanded(expanded === i ? null : i)}
                style={{
                  display: 'grid', gridTemplateColumns: '60px 90px 120px 1fr 120px',
                  gap: 12, padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  background: expanded === i ? 'rgba(255,255,255,.05)' : 'transparent',
                  alignItems: 'center', fontSize: 13,
                }}
              >
                <span style={{ fontFamily: 'monospace', color: '#6b7280', fontSize: 12 }}>F-{f.numero_fila}</span>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textAlign: 'center',
                  background: f.severidad === 'critico' ? 'rgba(239,68,68,.15)' : 'rgba(245,158,11,.15)',
                  color: f.severidad === 'critico' ? '#f87171' : '#fbbf24',
                  border: `1px solid ${f.severidad === 'critico' ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.3)'}`,
                }}>
                  {f.severidad === 'critico' ? '🚨 Crítico' : '⚠️ Advertencia'}
                </span>
                <span style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 12 }}>{f.campo}</span>
                <span style={{ color: '#d1d5db' }}>{f.descripcion}</span>
                <span style={{ color: '#22c55e', fontWeight: 600, textAlign: 'right' }}>{formatCOP(f.valor_en_riesgo)}</span>
              </div>

              {/* Detalle expandido */}
              {expanded === i && (
                <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '14px 16px', marginBottom: 4, fontSize: 13 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Sección RIPS</div>
                      <code style={{ color: '#60a5fa' }}>{f.seccion}</code>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Valor incorrecto</div>
                      <code style={{ color: '#f87171' }}>{f.valor_incorrecto || 'vacío'}</code>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Regla aplicada</div>
                      <code style={{ color: '#8b5cf6' }}>{f.regla_codigo}</code>
                    </div>
                  </div>

                  {f.sugerencia_ia && (
                    <div style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>🤖 Sugerencia IA (Claude)</div>
                      <p style={{ color: '#86efac', fontSize: 13, lineHeight: 1.5 }}>{f.sugerencia_ia}</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button style={{ ...S.btn, padding: '6px 14px', fontSize: 12, background: '#22c55e', color: '#fff' }}>✅ Aceptar corrección</button>
                        <button style={{ ...S.btn, padding: '6px 14px', fontSize: 12, background: 'rgba(255,255,255,.05)', color: '#9ca3af' }}>✏️ Editar manualmente</button>
                        <button style={{ ...S.btn, padding: '6px 14px', fontSize: 12, background: 'rgba(239,68,68,.1)', color: '#f87171' }}>❌ Rechazar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button style={{ ...S.btn, background: '#3b82f6', color: '#fff' }}>📥 Descargar reporte JSON</button>
        <button style={{ ...S.btn, background: 'rgba(255,255,255,.05)', color: '#f9fafb', border: '1px solid rgba(255,255,255,.08)' }}>📧 Enviar por email</button>
        <button style={{ ...S.btn, background: 'rgba(34,197,94,.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,.2)' }}>✅ Exportar RIPS corregido</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DASHBOARD HOME (KPIs + sesiones recientes)
// ─────────────────────────────────────────────

export function DashboardHome({ onNewAudit }: { onNewAudit: () => void }) {
  const stats = { total_sesiones: 12, sesiones_mes: 4, registros_mes: 28450, errores_mes: 134, valor_riesgo_mes: 42800000, tasa_error: 0.47 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Buen día, Dr. Fernando 👋</h1>
          <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>Clínica Medisalud · Plan Pro · Trial: 28 días restantes</p>
        </div>
        <button onClick={onNewAudit} style={{ ...S.btn, background: '#3b82f6', color: '#fff', padding: '11px 22px', fontSize: 14 }}>
          + Nueva auditoría
        </button>
      </div>

      {/* KPIs del mes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Registros auditados (este mes)', value: stats.registros_mes.toLocaleString('es-CO'), sub: `${stats.sesiones_mes} archivos`, color: '#60a5fa', icon: '📋' },
          { label: 'Errores detectados', value: stats.errores_mes, sub: `Tasa: ${stats.tasa_error}%`, color: '#f59e0b', icon: '⚠️' },
          { label: 'Valor protegido de glosas', value: formatCOP(stats.valor_riesgo_mes), sub: 'Antes de radicar a EPS', color: '#22c55e', icon: '🛡️' },
        ].map(k => (
          <div key={k.label} style={{ ...S.card }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Sesiones recientes */}
      <div style={S.card}>
        <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Auditorías recientes</h3>
        {DEMO_SESSIONS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: i < DEMO_SESSIONS.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{s.nombre_archivo}</div>
              <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>{formatDate(s.created_at)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: s.total_criticos > 0 ? '#f87171' : '#22c55e' }}>
                {s.total_criticos > 0 ? `🚨 ${s.total_criticos} críticos` : '✅ Sin críticos'}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{formatCOP(s.valor_en_riesgo)} en riesgo</div>
            </div>
            <span style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: s.estado === 'completado' ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)',
              color: s.estado === 'completado' ? '#22c55e' : '#f59e0b',
            }}>{s.estado}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LAYOUT PRINCIPAL (Sidebar + Nav)
// ─────────────────────────────────────────────

export function DashboardLayout({ children, screen, onNavigate, onLogout }: {
  children: React.ReactNode;
  screen: Screen;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
}) {
  const navItems = [
    { screen: 'dashboard' as Screen, icon: '🏠', label: 'Inicio' },
    { screen: 'upload' as Screen, icon: '📤', label: 'Nueva auditoría' },
  ];

  return (
    <div style={{ ...S.app, display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#0d1424', borderRight: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column', padding: '24px 0', minHeight: '100vh', flexShrink: 0 }}>
        <div style={{ padding: '0 20px', marginBottom: 32 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🛡️ RIPS<span style={{ color: '#60a5fa' }}>Guard</span></div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Auditoría de Facturación Médica</div>
        </div>
        <nav style={{ flex: 1 }}>
          {navItems.map(item => (
            <button key={item.screen} onClick={() => onNavigate(item.screen)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 20px',
              background: screen === item.screen ? 'rgba(59,130,246,.12)' : 'transparent',
              borderLeft: screen === item.screen ? '3px solid #3b82f6' : '3px solid transparent',
              border: 'none', color: screen === item.screen ? '#60a5fa' : '#9ca3af',
              fontSize: 14, fontWeight: screen === item.screen ? 600 : 400, cursor: 'pointer', textAlign: 'left',
            }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '0 20px' }}>
          <div style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>🔥 TRIAL ACTIVO</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>28 días restantes</div>
            <button style={{ ...S.btn, background: '#3b82f6', color: '#fff', padding: '6px 12px', fontSize: 11, marginTop: 8, width: '100%', justifyContent: 'center' }}>
              Activar plan →
            </button>
          </div>
          <button onClick={onLogout} style={{ ...S.btn, background: 'transparent', color: '#6b7280', padding: '8px 0', fontSize: 13, width: '100%' }}>
            ← Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main style={{ flex: 1, padding: 32, overflow: 'auto' }}>{children}</main>
    </div>
  );
}

// ─────────────────────────────────────────────
// APP PRINCIPAL (Router simple para demo)
// ─────────────────────────────────────────────

const DEMO_SESSIONS: AuditSession[] = [
  { session_id: '1', estado: 'completado', nombre_archivo: 'RIPS_JUNIO_2024.json', created_at: '2024-06-20T14:32:00Z', total_registros: 847, total_errores: 34, total_criticos: 12, valor_en_riesgo: 8750000 },
  { session_id: '2', estado: 'completado', nombre_archivo: 'RIPS_MAYO_2024.zip', created_at: '2024-05-18T09:15:00Z', total_registros: 1204, total_errores: 51, total_criticos: 8, valor_en_riesgo: 12400000 },
  { session_id: '3', estado: 'completado', nombre_archivo: 'RIPS_ABRIL_2024.json', created_at: '2024-04-15T11:20:00Z', total_registros: 932, total_errores: 27, total_criticos: 5, valor_en_riesgo: 6200000 },
];

const DEMO_REPORT: AuditReport = {
  session_id: 'demo-001', estado: 'completado', nombre_archivo: 'RIPS_DEMO.json',
  created_at: new Date().toISOString(), total_registros: 847, total_errores: 34,
  total_criticos: 12, total_advertencias: 18, valor_total: 45000000,
  valor_en_riesgo: 8750000, porcentaje_riesgo: 19.4,
  findings: [
    { tipo_error: 'CIE10_INVALIDO', severidad: 'critico', campo: 'codDiagnosticoPrincipal', valor_incorrecto: 'XXXXX', descripcion: 'El código CIE-10 "XXXXX" no existe en la clasificación MSPS Colombia vigente', seccion: 'AC', numero_fila: 2, valor_en_riesgo: 85000, regla_codigo: 'R-CIE10-001', sugerencia_ia: 'J180 — Neumonía, microorganismo no especificado (confianza: 87%) — Compatible con contexto clínico: consulta de medicina general con síntomas respiratorios. J180 es el diagnóstico más frecuente en este tipo de atención bajo Res. 2275/2023.' },
    { tipo_error: 'VALOR_CERO', severidad: 'critico', campo: 'vrServicio', valor_incorrecto: '0', descripcion: 'El vrServicio es $0. Todo servicio prestado debe tener un valor positivo en el RIPS', seccion: 'AC', numero_fila: 3, valor_en_riesgo: 85000, regla_codigo: 'R-VAL-001', sugerencia_ia: 'Tarifa SOAT 2024 para consulta 890202 (Medicina general): $85.000 COP. Verificar si el sistema HIS tiene la tarifa actualizada para este CUPS.' },
    { tipo_error: 'CUPS_INVALIDO', severidad: 'critico', campo: 'codProcedimiento', valor_incorrecto: '999999', descripcion: 'El código CUPS "999999" no existe en el Manual CUPS vigente (Resolución 2192/2023)', seccion: 'AP', numero_fila: 6, valor_en_riesgo: 145000, regla_codigo: 'R-CUPS-001', sugerencia_ia: '903802 — Hemograma IV (confianza: 92%) — Basado en el contexto: procedimiento de laboratorio para paciente con diagnóstico J180. El hemograma es el examen de apoyo estándar según guías MSPS Colombia.' },
    { tipo_error: 'VALOR_FUERA_RANGO', severidad: 'critico', campo: 'vrServicio', valor_incorrecto: '5', descripcion: 'El vrServicio ($5) está muy por debajo del rango tarifario para colecistectomía laparoscópica (CUPS 442300)', seccion: 'AP', numero_fila: 7, valor_en_riesgo: 2850000, regla_codigo: 'R-VAL-002', sugerencia_ia: 'Valor esperado para colecistectomía laparoscópica ambulatoria (442300): $2.400.000 – $3.800.000 COP según tarifas SOAT 2024. El valor actual ($5) sugiere error de digitación.' },
    { tipo_error: 'FECHA_INVALIDA', severidad: 'critico', campo: 'fechaFinAtencion', valor_incorrecto: '2024-06-08', descripcion: 'La fechaFinAtencion (2024-06-08) es anterior a la fechaInicioAtencion (2024-06-10)', seccion: 'AP', numero_fila: 8, valor_en_riesgo: 32000, regla_codigo: 'R-FECHA-001', sugerencia_ia: null },
    { tipo_error: 'CIE10_INCOMPATIBLE_PROCEDIMIENTO', severidad: 'critico', campo: 'codDiagnosticoPrincipal', valor_incorrecto: 'Z000', descripcion: 'El diagnóstico Z000 (Examen médico general) es clínicamente incompatible con colecistectomía laparoscópica (CUPS 442300)', seccion: 'AP', numero_fila: 9, valor_en_riesgo: 2850000, regla_codigo: 'R-CIE10-002', sugerencia_ia: 'K802 — Colecistitis aguda con colelitiasis (confianza: 95%) — Una colecistectomía requiere diagnóstico activo de patología biliar. Z000 es solo para chequeos preventivos y será rechazado por cualquier EPS.' },
    { tipo_error: 'CAMPO_OBLIGATORIO_VACIO', severidad: 'critico', campo: 'numDocumentoIdentificacion', valor_incorrecto: null, descripcion: 'Campo requerido por Res. 2275/2023 está vacío en sección AU (Urgencias)', seccion: 'AU', numero_fila: 10, valor_en_riesgo: 485000, regla_codigo: 'R-CAMP-001', sugerencia_ia: null },
    { tipo_error: 'CIE10_INCOMPATIBLE_PROCEDIMIENTO', severidad: 'advertencia', campo: 'finalidadTecnologiaSalud', valor_incorrecto: '43', descripcion: 'Finalidad "Detección temprana" (43) es inconsistente con diagnóstico activo K295 (Gastritis sin especificar)', seccion: 'AC', numero_fila: 4, valor_en_riesgo: 95000, regla_codigo: 'R-CIE10-002', sugerencia_ia: 'Cambiar finalidad a "13" (Diagnóstico) cuando el diagnóstico es una condición activa, no una evaluación preventiva.' },
  ],
};

export default function RIPSGuardApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [report, setReport] = useState<AuditReport | null>(null);

  const handleResult = (r: AuditReport) => { setReport(r); setScreen('results'); };

  if (screen === 'login') return <LoginPage onLogin={() => setScreen('dashboard')} onGoRegister={() => setScreen('register')} />;
  if (screen === 'register') return <RegisterPage onRegister={() => setScreen('dashboard')} onGoLogin={() => setScreen('login')} />;

  return (
    <DashboardLayout screen={screen} onNavigate={setScreen} onLogout={() => setScreen('login')}>
      {screen === 'dashboard' && <DashboardHome onNewAudit={() => setScreen('upload')} />}
      {screen === 'upload'    && <UploadPage onResult={handleResult} />}
      {screen === 'results'   && report && <ResultsPage report={report} onNew={() => setScreen('upload')} />}
    </DashboardLayout>
  );
}
