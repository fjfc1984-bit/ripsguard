/**
 * Cliente HTTP para el backend FastAPI.
 * Envía el JWT de Supabase en Authorization header para que
 * el backend valide la identidad y el tenant del usuario.
 *
 * Tipos alineados con los modelos Pydantic del worker.py:
 *   - SessionStatus      → /audit/upload (POST 202)
 *   - AuditReportResponse → /audit/{id}/report (GET)
 *   - AuditListResponse  → /audits (GET)
 */

import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
  : (process.env.NODE_ENV === 'production'
      ? 'https://ripsguard-production.up.railway.app'
      : 'http://localhost:8000')

// ─────────────────────────────────────────────
// Tipos del backend (espejo exacto de worker.py)
// ─────────────────────────────────────────────

/** Respuesta de POST /audit/upload */
export interface SessionStatus {
  session_id:      string
  estado:          string          // 'processing' | 'completado' | 'error'
  nombre_archivo:  string
  created_at:      string
  procesado_at:    string | null
  total_registros: number
  total_errores:   number
  total_criticos:  number
  valor_en_riesgo: number
}

/** Un hallazgo individual del reporte */
export interface FindingResponse {
  tipo_error:       string
  severidad:        'critico' | 'advertencia' | 'info'
  campo:            string
  valor_incorrecto: string | null
  descripcion:      string
  seccion:          string
  numero_fila:      number
  valor_en_riesgo:  number
  regla_codigo:     string
  sugerencia_ia:    string | null
}

/** Respuesta de GET /audit/{id}/report */
export interface AuditReportResponse {
  session_id:           string
  tenant_id:            string
  total_registros:      number
  total_errores:        number
  total_criticos:       number
  total_advertencias:   number
  valor_total:          number
  valor_en_riesgo:      number
  porcentaje_riesgo:    number
  findings:             FindingResponse[]
  resumen_por_seccion:  Record<string, {
    criticos:        number
    advertencias:    number
    valor_en_riesgo: number
  }>
  resumen_por_tipo_error: Record<string, number>
}

/** Un ítem del historial de auditorías */
export interface AuditListItem {
  session_id:      string
  nombre_archivo:  string
  estado:          string
  total_registros: number
  total_errores:   number
  total_criticos:  number
  valor_en_riesgo: number
  created_at:      string
  procesado_at:    string | null
}

/** Respuesta de GET /audits */
export interface AuditListResponse {
  items:  AuditListItem[]
  total:  number
  page:   number
  pages:  number
}

// ─────────────────────────────────────────────
// Autenticación
// ─────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Sesión expirada. Por favor inicia sesión de nuevo.')
  }
  return session.access_token
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken()
  return { Authorization: `Bearer ${token}` }
}

// ─────────────────────────────────────────────
// Funciones de API
// ─────────────────────────────────────────────

/**
 * Sube un archivo RIPS para auditoría.
 * Retorna SessionStatus con session_id para consultar el reporte.
 */
export async function auditRIPS(file: File): Promise<SessionStatus> {
  const formData = new FormData()
  formData.append('file', file)

  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/audit/upload`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Error desconocido' }))
    throw new Error(err.detail || `Error del servidor (${response.status})`)
  }

  return response.json() as Promise<SessionStatus>
}

/**
 * Obtiene el reporte completo de una sesión de auditoría.
 * Llama a GET /audit/{sessionId}/report
 */
export async function getAuditById(sessionId: string): Promise<AuditReportResponse> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/audit/${sessionId}/report`, { headers })
  if (!response.ok) {
    if (response.status === 404) throw new Error('Auditoría no encontrada. Puede haberse eliminado.')
    if (response.status === 409) throw new Error('La auditoría aún está procesando. Espera unos segundos.')
    throw new Error(`Error al cargar el reporte (${response.status})`)
  }
  return response.json() as Promise<AuditReportResponse>
}

/**
 * Obtiene el historial de auditorías del tenant con paginación.
 */
export async function getAuditHistory(
  page = 1,
  pageSize = 15,
): Promise<AuditListResponse> {
  const headers = await authHeaders()
  const response = await fetch(
    `${API_URL}/audits?page=${page}&page_size=${pageSize}`,
    { headers },
  )
  if (!response.ok) {
    throw new Error(`Error cargando historial (${response.status})`)
  }
  return response.json() as Promise<AuditListResponse>
}

// ─────────────────────────────────────────────
// Tipos adicionales
// ─────────────────────────────────────────────

export interface TenantStats {
  auditorias_mes:     number
  auditorias_hoy:     number
  total_criticos_mes: number
  valor_riesgo_mes:   number
  top_error:          string | null
}

// ─────────────────────────────────────────────
// Funciones públicas (sin auth)
// ─────────────────────────────────────────────

/**
 * Reporte demo público — no requiere sesión de usuario.
 * Llama a GET /demo/report (endpoint sin auth).
 */
export async function getDemoReport(): Promise<AuditReportResponse> {
  const response = await fetch(`${API_URL}/demo/report`)
  if (!response.ok) throw new Error('Error cargando reporte demo')
  return response.json() as Promise<AuditReportResponse>
}

// ─────────────────────────────────────────────
// Estadísticas del tenant
// ─────────────────────────────────────────────

export async function getTenantStats(): Promise<TenantStats> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/stats`, { headers })
  if (!response.ok) throw new Error(`Error cargando estadísticas (${response.status})`)
  return response.json() as Promise<TenantStats>
}

/**
 * Descarga el reporte JSON corregido de una sesión.
 */
export async function downloadReport(sessionId: string): Promise<void> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/audit/${sessionId}/download`, { headers })
  if (!response.ok) throw new Error('No se pudo descargar el reporte')

  const blob = await response.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `rips_guard_reporte_${sessionId.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
