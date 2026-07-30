'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getTenantStats, getAuditHistory, type TenantStats, type AuditListItem } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import {
  SearchIcon, BarChartIcon, AlertTriangleIcon, ShieldIcon,
  ZapIcon, HistoryIcon, XCircleIcon, CheckCircleIcon,
} from '@/components/ui/icons'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

const ERROR_LABEL: Record<string, string> = {
  CUPS_INVALIDO: 'CUPS inválido',
  CUPS_INACTIVO: 'CUPS inactivo',
  CIE10_INVALIDO: 'CIE-10 inválido',
  CIE10_INCOMPATIBLE_PROCEDIMIENTO: 'CIE-10 incompatible',
  VALOR_CERO: 'Valor cero',
  VALOR_FUERA_RANGO: 'Valor fuera de rango',
  FECHA_INVALIDA: 'Fecha inválida',
  FECHA_FUTURA: 'Fecha futura',
  DUPLICADO_REGISTRO: 'Registro duplicado',
  CAMPO_OBLIGATORIO_VACIO: 'Campo obligatorio vacío',
  TIPO_DOCUMENTO_INVALIDO: 'Tipo documento inválido',
}

function StatCard({
  label, value, sub, icon: Icon, color, bg,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  color: string; bg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{label}</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={17} className={color} strokeWidth={2} />
        </div>
      </div>
    </div>
  )
}

function RecentAuditRow({ item }: { item: AuditListItem }) {
  const ok = item.total_criticos === 0
  return (
    <Link
      href={`/dashboard/audit/results?id=${item.session_id}`}
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition border-b border-slate-100 last:border-0"
    >
      <div className={`flex-shrink-0 ${ok ? 'text-green-500' : 'text-red-500'}`}>
        {ok
          ? <CheckCircleIcon size={16} strokeWidth={2}/>
          : <XCircleIcon size={16} strokeWidth={2}/>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{item.nombre_archivo}</p>
        <p className="text-xs text-slate-400 mt-0.5">{formatDate(item.created_at)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        {item.total_criticos > 0
          ? <p className="text-xs font-bold text-red-600">{item.total_criticos} crítico{item.total_criticos !== 1 ? 's' : ''}</p>
          : <p className="text-xs font-bold text-green-600">Sin errores</p>
        }
        {item.valor_en_riesgo > 0 && (
          <p className="text-xs text-slate-400 tabular-nums">{formatCOP(item.valor_en_riesgo)}</p>
        )}
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const [stats, setStats]     = useState<TenantStats | null>(null)
  const [recent, setRecent]   = useState<AuditListItem[]>([])
  const [plan, setPlan]       = useState<string | null>(null)
  const [isActive, setActive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const [statsRes, histRes] = await Promise.allSettled([
        getTenantStats(),
        getAuditHistory(1, 5),
      ])
      if (statsRes.status === 'fulfilled') setStats(statsRes.value)
      if (histRes.status  === 'fulfilled') setRecent(histRes.value.items)

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: userRecord } = await supabase
            .from('users').select('tenant_id').eq('id', user.id).single()
          if (userRecord?.tenant_id) {
            const { data: sub } = await supabase
              .from('subscriptions')
              .select('plan, estado, trial_ends_at')
              .eq('tenant_id', userRecord.tenant_id)
              .single()
            if (sub) {
              setPlan(sub.plan)
              const now = new Date()
              setActive(
                sub.estado === 'activa' ||
                (sub.estado === 'trial' && sub.trial_ends_at && new Date(sub.trial_ends_at) > now)
              )
            }
          }
        }
      } catch { /* sin suscripción activa */ }

      setLoading(false)
    }
    loadData()
  }, [])

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-sm text-slate-400 font-medium">{greeting()}</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-0.5 tracking-tight">Panel de control</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Auditorías hoy" value={loading ? '—' : (stats?.auditorias_hoy ?? 0)} icon={SearchIcon} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Este mes" value={loading ? '—' : (stats?.auditorias_mes ?? 0)} sub="auditorías completadas" icon={BarChartIcon} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard label="Críticos / mes" value={loading ? '—' : (stats?.total_criticos_mes ?? 0)} sub="hallazgos críticos" icon={AlertTriangleIcon} color="text-red-500" bg="bg-red-50" />
        <StatCard label="Valor en riesgo" value={loading ? '—' : formatCOP(stats?.valor_riesgo_mes ?? 0)} sub="posibles glosas este mes" icon={ZapIcon} color="text-amber-600" bg="bg-amber-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-slate-900 rounded-xl p-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Nueva auditoría RIPS</h2>
            <p className="text-slate-400 text-sm">
              Valida archivos JSON contra la Resolución 2275 de 2023 en segundos.
              {plan === 'starter' && ' Hasta 10 MB por archivo.'}
              {plan === 'pro'     && ' Hasta 50 MB por archivo.'}
            </p>
          </div>
          {isActive ? (
            <Link href="/dashboard/audit" className="flex-shrink-0 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-500 transition whitespace-nowrap">Iniciar auditoría</Link>
          ) : (
            <Link href="/dashboard/billing" className="flex-shrink-0 bg-white text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-100 transition whitespace-nowrap">Activar plan</Link>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangleIcon size={14} className="text-amber-500" strokeWidth={2}/>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Error más frecuente</p>
          </div>
          {loading ? (
            <p className="text-sm text-slate-400">Cargando...</p>
          ) : stats?.top_error ? (
            <>
              <p className="text-sm font-bold text-slate-900">{ERROR_LABEL[stats.top_error] ?? stats.top_error}</p>
              <p className="text-xs text-slate-400 mt-1">Este mes en tus auditorías</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Sin datos aún este mes</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HistoryIcon size={15} className="text-slate-500" strokeWidth={2}/>
            <h3 className="text-sm font-semibold text-slate-900">Auditorías recientes</h3>
          </div>
          <Link href="/dashboard/history" className="text-xs text-blue-600 hover:underline font-medium">Ver todo →</Link>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-400 flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
            Cargando historial...
          </div>
        ) : recent.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-400 mb-3">Aún no tienes auditorías completadas.</p>
            <Link href="/dashboard/audit" className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              <SearchIcon size={12} strokeWidth={2}/>Primera auditoría
            </Link>
          </div>
        ) : (
          <div>{recent.map(item => <RecentAuditRow key={item.session_id} item={item}/>)}</div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <ShieldIcon size={16} className="text-blue-600" strokeWidth={2}/>
            <h3 className="text-sm font-semibold text-slate-900">Resolución 2275/2023</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">Módulos AF, AT, AC, AM, AN y AU. Cobertura completa de la norma vigente.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <ZapIcon size={16} className="text-indigo-600" strokeWidth={2}/>
            <h3 className="text-sm font-semibold text-slate-900">IA correctora</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">Sugerencias automáticas para cada error. Menos tiempo de corrección manual.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <HistoryIcon size={16} className="text-slate-600" strokeWidth={2}/>
            <h3 className="text-sm font-semibold text-slate-900">Historial completo</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">Todas tus auditorías anteriores con resultados y reportes descargables.</p>
          <Link href="/dashboard/history" className="text-xs text-blue-600 font-medium mt-2 inline-block hover:underline">Ver historial →</Link>
        </div>
      </div>
    </div>
  )
}
