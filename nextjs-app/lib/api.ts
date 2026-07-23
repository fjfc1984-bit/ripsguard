/**
 * Cliente HTTP para el backend FastAPI.
 * Envía el JWT de Supabase en Authorization header para que
 * el backend valide la identidad y el tenant del usuario.
 */

import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface AuditError {
  code: string
  message: string
  severity: 'error' | 'warning'
  path?: string
  suggestion?: string
}

export interface AuditResult {
  audit_id: string
  status: 'valid' | 'invalid' | 'error'
  total_errors: number
  total_warnings: number
  errors: AuditError[]
  summary: string
  processed_at: string
}

/** Obtiene el access token JWT del usuario actual. */
async function getAccessToken(): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Sesión expirada. Por favor inicia sesión de nuevo.')
  }
  return session.access_token
}

/** Headers de autenticación para el backend. */
async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken()
  return { Authorization: `Bearer ${token}` }
}

export async function auditRIPS(file: File): Promise<AuditResult> {
  const formData = new FormData()
  formData.append('file', file)

  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/audit/upload`, {
    method: 'POST',
    headers, // Sin Content-Type: el browser lo setea automáticamente para multipart
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }))
    throw new Error(error.detail || `Error ${response.status}`)
  }

  return response.json()
}

export async function getAuditHistory(page = 1, pageSize = 20) {
  const headers = await authHeaders()
  const response = await fetch(
    `${API_URL}/audits?page=${page}&page_size=${pageSize}`,
    { headers }
  )
  if (!response.ok) throw new Error('Error cargando historial')
  return response.json()
}

export async function getAuditById(auditId: string): Promise<AuditResult> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/audit/${auditId}/report`, { headers })
  if (!response.ok) throw new Error('Auditoría no encontrada')
  return response.json()
}
