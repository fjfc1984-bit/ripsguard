/**
 * Rate limiter con sliding window counter en memoria.
 *
 * IMPORTANTE: En Vercel Serverless cada instancia tiene su propio proceso.
 * Para ambientes de alta carga, reemplazar con Upstash Redis:
 *   https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
 *
 * Para el MVP (< 100 req/min por IP) esta implementación es suficiente.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Map global dentro del proceso (persiste entre requests en la misma instancia)
const store = new Map<string, RateLimitEntry>()

// Limpiar entradas expiradas cada 60 segundos para evitar memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 60_000)
}

export interface RateLimitResult {
  success: boolean   // true si la request está permitida
  remaining: number  // requests restantes en la ventana
  resetIn: number    // ms hasta que se resetea el contador
  limit: number      // límite configurado
}

/**
 * Verifica si una clave (ej: IP + endpoint) supera el límite.
 *
 * @param key      Identificador único (ej: "ip:1.2.3.4:checkout")
 * @param limit    Número máximo de requests permitidos
 * @param windowMs Ventana de tiempo en milisegundos
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  // Primera request o ventana expirada → reiniciar contador
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, resetIn: windowMs, limit }
  }

  // Límite superado
  if (entry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetIn: entry.resetAt - now,
      limit,
    }
  }

  // Incrementar contador
  entry.count++
  return {
    success: true,
    remaining: limit - entry.count,
    resetIn: entry.resetAt - now,
    limit,
  }
}

/**
 * Extrae la IP real del cliente considerando proxies y Vercel.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}
