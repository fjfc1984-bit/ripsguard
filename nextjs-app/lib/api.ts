const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface AuditResult {
  audit_id: string
  status: 'valid' | 'invalid' | 'error'
  total_errors: number
  total_warnings: number
  errors: Array<{
    code: string
    message: string
    severity: 'error' | 'warning'
    path?: string
    suggestion?: string
  }>
  summary: string
  processed_at: string
}

export async function auditRIPS(file: File): Promise<AuditResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_URL}/api/v1/audit`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }))
    throw new Error(error.detail || `Error ${response.status}`)
  }

  return response.json()
}

export async function getAuditHistory(page = 1, pageSize = 20) {
  const response = await fetch(
    `${API_URL}/api/v1/audits?page=${page}&page_size=${pageSize}`,
    { credentials: 'include' }
  )
  if (!response.ok) throw new Error('Error cargando historial')
  return response.json()
}

export async function getAuditById(auditId: string) {
  const response = await fetch(`${API_URL}/api/v1/audits/${auditId}`, {
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Auditoría no encontrada')
  return response.json()
}
