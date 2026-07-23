import { useState, useCallback } from "react";

// ─── DATOS DE DEMO ────────────────────────────────────────────────────────────
const DEMO_SESSION = {
  session_id: "a3f9c2d1-demo",
  nombre_archivo: "RIPS_EPS_SANITAS_2024-03.json",
  procesado_at: "2024-03-15T10:42:33Z",
  total_registros: 847,
  total_errores: 34,
  total_criticos: 12,
  total_advertencias: 18,
  valor_total: 48_320_000,
  valor_en_riesgo: 8_750_000,
  porcentaje_riesgo: 18.1,
};

const DEMO_FINDINGS = [
  {
    id: 1, numero_fila: 2, seccion: "AP", severidad: "critico",
    tipo_error: "cie10_invalido", campo: "codDiagnosticoPrincipal",
    valor_incorrecto: "XXXXX",
    descripcion: "Código CIE-10 'XXXXX' no existe en la clasificación vigente. Verifique subcategoría o use el código padre.",
    valor_en_riesgo: 0,
    regla_codigo: "R-CIE10-002",
    sugerencia_ia: "K29.7 (confianza: 88%) — Gastritis no especificada. Compatible con el CUPS 903803 y el motivo de consulta registrado.",
  },
  {
    id: 2, numero_fila: 2, seccion: "AP", severidad: "critico",
    tipo_error: "valor_cero_no_permitido", campo: "vrServicio",
    valor_incorrecto: "0",
    descripcion: "Valor del servicio es cero. Las EPS rechazan registros sin valor facturado en procedimientos.",
    valor_en_riesgo: 32_000,
    regla_codigo: "R-VAL-001",
    sugerencia_ia: null,
  },
  {
    id: 3, numero_fila: 5, seccion: "AC", severidad: "critico",
    tipo_error: "cups_invalido", campo: "codConsulta",
    valor_incorrecto: "89020X",
    descripcion: "Código CUPS '89020X' no existe en el Manual CUPS vigente (Res. 2192 de 2023).",
    valor_en_riesgo: 45_000,
    regla_codigo: "R-CUPS-002",
    sugerencia_ia: "890201 (confianza: 94%) — Consulta de primera vez por medicina general. El código tiene un carácter inválido al final.",
  },
  {
    id: 4, numero_fila: 8, seccion: "AC", severidad: "advertencia",
    tipo_error: "tarifa_fuera_rango", campo: "vrServicio",
    valor_incorrecto: "250000",
    descripcion: "Valor $250,000 COP fuera del rango esperado ($30,000 – $120,000 COP) para CUPS 890201. Puede generar glosa por sobrefacturación.",
    valor_en_riesgo: 250_000,
    regla_codigo: "R-VAL-002",
    sugerencia_ia: null,
  },
  {
    id: 5, numero_fila: 11, seccion: "AP", severidad: "advertencia",
    tipo_error: "cie10_incompatible_procedimiento", campo: "codDiagnosticoPrincipal",
    valor_incorrecto: "Z34.0",
    descripcion: "Diagnóstico 'Z34.0' no es compatible con CUPS 890201. Las EPS frecuentemente glosan esta combinación.",
    valor_en_riesgo: 45_000,
    regla_codigo: "R-COMPAT-001",
    sugerencia_ia: "O09.9 (confianza: 79%) — Supervisión de embarazo de alto riesgo. Consistente con el contexto clínico del registro.",
  },
  {
    id: 6, numero_fila: 15, seccion: "AM", severidad: "advertencia",
    tipo_error: "campo_vacio", campo: "diasTratamiento",
    valor_incorrecto: null,
    descripcion: "Campo obligatorio 'diasTratamiento' vacío en sección AM (Res. 2275/2023, Anexo Técnico).",
    valor_en_riesgo: 7_000,
    regla_codigo: "R-CAMP-001",
    sugerencia_ia: null,
  },
  {
    id: 7, numero_fila: 19, seccion: "AC", severidad: "critico",
    tipo_error: "duplicado_registro", campo: "registro_completo",
    valor_incorrecto: "1020304050|AC|890201|2024-03-10|45000",
    descripcion: "Registro duplicado: mismo usuario, CUPS, fecha y valor ya existe. Las EPS glosan todos los duplicados.",
    valor_en_riesgo: 45_000,
    regla_codigo: "R-DUP-001",
    sugerencia_ia: null,
  },
  {
    id: 8, numero_fila: 23, seccion: "AU", severidad: "critico",
    tipo_error: "campo_vacio", campo: "codConsulta",
    valor_incorrecto: null,
    descripcion: "Código CUPS ausente en sección AU (Urgencias). Es obligatorio en todas las secciones de servicio.",
    valor_en_riesgo: 120_000,
    regla_codigo: "R-CUPS-001",
    sugerencia_ia: null,
  },
];

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n) => new Intl.NumberFormat("es-CO").format(n);

const SECCION_LABEL = { AC: "Consultas", AP: "Procedimientos", AU: "Urgencias", AH: "Hospitaliz.", AM: "Medicamentos", AT: "Traslado", AN: "Recién Nacidos" };
const ERROR_LABEL = {
  cups_invalido: "CUPS inválido",
  cups_no_contratado: "CUPS no contratado",
  cie10_invalido: "CIE-10 inválido",
  cie10_incompatible_procedimiento: "CIE-10 incompatible",
  campo_vacio: "Campo vacío",
  campo_formato_invalido: "Formato inválido",
  tarifa_fuera_rango: "Tarifa fuera de rango",
  valor_cero_no_permitido: "Valor cero",
  duplicado_registro: "Duplicado",
  fecha_invalida: "Fecha inválida",
  fecha_futura: "Fecha futura",
};

// ─── COMPONENTES UI ───────────────────────────────────────────────────────────

function Badge({ type }) {
  const styles = {
    critico:     "bg-red-500/15 text-red-400 border border-red-500/30",
    advertencia: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    info:        "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  };
  const labels = { critico: "Crítico", advertencia: "Advertencia", info: "Info" };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[type] || styles.info}`}>
      {labels[type] || type}
    </span>
  );
}

function KPICard({ label, value, sub, color, icon }) {
  const colors = {
    red:    "border-red-500/30 bg-red-500/5",
    amber:  "border-amber-500/30 bg-amber-500/5",
    green:  "border-green-500/30 bg-green-500/5",
    blue:   "border-blue-500/30 bg-blue-500/5",
    purple: "border-purple-500/30 bg-purple-500/5",
  };
  const textColors = { red: "text-red-400", amber: "text-amber-400", green: "text-green-400", blue: "text-blue-400", purple: "text-purple-400" };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${textColors[color]}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}

// ─── PANTALLA: UPLOAD ─────────────────────────────────────────────────────────

function UploadScreen({ onDemo }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-4">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          <span className="text-blue-400 text-sm font-medium">Motor IA activo</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Audita tu RIPS antes de radicar</h1>
        <p className="text-gray-400 max-w-md">
          Detectamos errores de codificación en segundos. Evita glosas y protege el flujo de caja de tu institución.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); onDemo(); }}
        className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200
          ${dragging ? "border-blue-400 bg-blue-500/10 scale-[1.02]" : "border-gray-600 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-800/50"}`}
        onClick={onDemo}
      >
        <div className="text-5xl mb-4">📂</div>
        <p className="text-white font-semibold mb-1">Arrastra tu archivo RIPS aquí</p>
        <p className="text-gray-400 text-sm mb-4">o haz clic para seleccionar</p>
        <div className="flex justify-center gap-2">
          {[".json", ".zip"].map(ext => (
            <span key={ext} className="bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full">{ext}</span>
          ))}
        </div>
        <p className="text-gray-600 text-xs mt-3">Máximo 50 MB · Res. 2275 de 2023</p>
      </div>

      <button
        onClick={onDemo}
        className="mt-6 text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
      >
        Ver demo con datos de ejemplo →
      </button>

      {/* Features */}
      <div className="grid grid-cols-3 gap-4 mt-12 max-w-lg w-full">
        {[
          { icon: "⚡", title: "Análisis en segundos", desc: "Resultados instantáneos para cualquier volumen" },
          { icon: "🤖", title: "IA que corrige", desc: "Claude sugiere el código correcto con justificación" },
          { icon: "💰", title: "Glosas evitadas", desc: "Ve exactamente cuánto dinero estás protegiendo" },
        ].map(f => (
          <div key={f.title} className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">{f.icon}</div>
            <div className="text-white text-xs font-semibold mb-1">{f.title}</div>
            <div className="text-gray-500 text-xs">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PANTALLA: PROCESANDO ─────────────────────────────────────────────────────

function ProcessingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-400 rounded-full animate-spin mb-6" />
      <h2 className="text-white font-semibold text-lg mb-2">Auditando archivo...</h2>
      <p className="text-gray-400 text-sm text-center max-w-xs">
        Validando CUPS, CIE-10, tarifas y estructura. La IA está analizando los errores.
      </p>
      <div className="mt-6 flex flex-col gap-2 w-64">
        {["Parseando RIPS JSON...", "Validando 847 registros...", "Consultando IA para correcciones..."].map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-xs">✓</span>
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PANTALLA: RESULTADOS ─────────────────────────────────────────────────────

function ResultsScreen({ session, findings, onReset }) {
  const [filtro, setFiltro] = useState("todos");
  const [seccionFiltro, setSeccionFiltro] = useState("todas");
  const [expandido, setExpandido] = useState(null);

  const filtered = findings.filter(f => {
    if (filtro !== "todos" && f.severidad !== filtro) return false;
    if (seccionFiltro !== "todas" && f.seccion !== seccionFiltro) return false;
    return true;
  });

  const secciones = [...new Set(findings.map(f => f.seccion))];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={onReset} className="text-gray-500 hover:text-gray-300 text-sm">← Nueva auditoría</button>
          </div>
          <h1 className="text-white font-bold text-xl">{session.nombre_archivo}</h1>
          <p className="text-gray-500 text-sm">
            Auditado {new Date(session.procesado_at).toLocaleString("es-CO")} · {fmtNum(session.total_registros)} registros
          </p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          ⬇ Descargar reporte
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KPICard label="Registros" value={fmtNum(session.total_registros)} icon="📋" color="blue" />
        <KPICard label="Errores totales" value={session.total_errores} icon="🔍" color="amber" />
        <KPICard label="Críticos" value={session.total_criticos} sub="Garantizan glosa" icon="❌" color="red" />
        <KPICard label="Valor facturado" value={fmt(session.valor_total)} icon="💳" color="green" />
        <KPICard
          label="En riesgo de glosa"
          value={fmt(session.valor_en_riesgo)}
          sub={`${session.porcentaje_riesgo}% de lo facturado`}
          icon="🔴"
          color="red"
        />
      </div>

      {/* Alerta de riesgo */}
      {session.valor_en_riesgo > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-red-300 font-semibold">
              {fmt(session.valor_en_riesgo)} en riesgo de no pago por errores de codificación
            </p>
            <p className="text-gray-400 text-sm mt-0.5">
              {session.total_criticos} errores críticos deben corregirse antes de radicar a la EPS.
              {findings.filter(f => f.sugerencia_ia).length > 0 &&
                ` La IA ya sugirió correcciones para ${findings.filter(f => f.sugerencia_ia).length} de ellos.`
              }
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1">
          {["todos", "critico", "advertencia"].map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                filtro === f
                  ? "bg-gray-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {f === "todos" ? `Todos (${findings.length})` :
               f === "critico" ? `Críticos (${findings.filter(x => x.severidad === "critico").length})` :
               `Advertencias (${findings.filter(x => x.severidad === "advertencia").length})`}
            </button>
          ))}
        </div>

        <select
          value={seccionFiltro}
          onChange={e => setSeccionFiltro(e.target.value)}
          className="bg-gray-800/60 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5"
        >
          <option value="todas">Todas las secciones</option>
          {secciones.map(s => (
            <option key={s} value={s}>{SECCION_LABEL[s] || s}</option>
          ))}
        </select>
      </div>

      {/* Tabla de findings */}
      <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-gray-700/50 bg-gray-800/50">
          <div className="col-span-1 text-gray-500 text-xs font-medium uppercase">Fila</div>
          <div className="col-span-1 text-gray-500 text-xs font-medium uppercase">Secc.</div>
          <div className="col-span-2 text-gray-500 text-xs font-medium uppercase">Severidad</div>
          <div className="col-span-2 text-gray-500 text-xs font-medium uppercase">Tipo error</div>
          <div className="col-span-3 text-gray-500 text-xs font-medium uppercase">Campo / Valor</div>
          <div className="col-span-2 text-gray-500 text-xs font-medium uppercase">En riesgo</div>
          <div className="col-span-1 text-gray-500 text-xs font-medium uppercase">IA</div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-500">No hay errores con ese filtro</div>
        ) : (
          filtered.map(f => (
            <div key={f.id}>
              <div
                className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-700/30 cursor-pointer transition-colors
                  ${expandido === f.id ? "bg-gray-700/30" : "hover:bg-gray-800/50"}`}
                onClick={() => setExpandido(expandido === f.id ? null : f.id)}
              >
                <div className="col-span-1 text-gray-400 text-sm font-mono">{f.numero_fila}</div>
                <div className="col-span-1">
                  <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-mono">{f.seccion}</span>
                </div>
                <div className="col-span-2"><Badge type={f.severidad} /></div>
                <div className="col-span-2 text-gray-300 text-xs self-center">{ERROR_LABEL[f.tipo_error] || f.tipo_error}</div>
                <div className="col-span-3 self-center">
                  <div className="text-gray-300 text-xs truncate">{f.campo}</div>
                  {f.valor_incorrecto && (
                    <div className="text-red-400 font-mono text-xs truncate">{f.valor_incorrecto}</div>
                  )}
                </div>
                <div className="col-span-2 self-center">
                  {f.valor_en_riesgo > 0 ? (
                    <span className="text-red-400 text-xs font-semibold">{fmt(f.valor_en_riesgo)}</span>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </div>
                <div className="col-span-1 self-center text-center">
                  {f.sugerencia_ia ? <span title="La IA tiene una sugerencia">🤖</span> : <span className="text-gray-700">—</span>}
                </div>
              </div>

              {/* Detalle expandido */}
              {expandido === f.id && (
                <div className="bg-gray-900/60 px-4 py-4 border-b border-gray-700/30">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500 text-xs font-medium uppercase mb-1">Descripción del error</div>
                      <p className="text-gray-300 text-sm leading-relaxed">{f.descripcion}</p>
                      <div className="text-gray-600 text-xs mt-2">Regla: {f.regla_codigo}</div>
                    </div>
                    {f.sugerencia_ia && (
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span>🤖</span>
                          <span className="text-purple-300 text-xs font-semibold uppercase tracking-wide">Sugerencia IA</span>
                        </div>
                        <p className="text-gray-200 text-sm">{f.sugerencia_ia}</p>
                        <div className="flex gap-2 mt-3">
                          <button className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                            ✓ Aceptar corrección
                          </button>
                          <button className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors">
                            Editar manualmente
                          </button>
                        </div>
                      </div>
                    )}
                    {!f.sugerencia_ia && (
                      <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-3 flex flex-col justify-center">
                        <div className="text-gray-500 text-xs mb-2">Corrección manual</div>
                        <input
                          className="bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-blue-500"
                          placeholder={`Valor correcto para "${f.campo}"...`}
                        />
                        <button className="mt-2 bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors self-start">
                          Guardar corrección
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-gray-600 text-xs">
          {filtered.length} de {findings.length} errores mostrados
        </p>
        <button className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors flex items-center gap-2">
          ✅ Exportar RIPS corregido
        </button>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────

export default function RIPSGuardDashboard() {
  const [screen, setScreen] = useState("upload"); // "upload" | "processing" | "results"

  const handleDemo = useCallback(() => {
    setScreen("processing");
    setTimeout(() => setScreen("results"), 2200);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <span className="font-bold text-white text-lg">RIPS<span className="text-blue-400">Guard</span></span>
            <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">Beta</span>
          </div>
          <div className="flex items-center gap-4">
            {screen === "results" && (
              <span className="text-green-400 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
                Auditoría completada
              </span>
            )}
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">C</div>
          </div>
        </div>
      </nav>

      {/* Contenido */}
      <main>
        {screen === "upload"     && <UploadScreen onDemo={handleDemo} />}
        {screen === "processing" && <ProcessingScreen />}
        {screen === "results"    && (
          <ResultsScreen
            session={DEMO_SESSION}
            findings={DEMO_FINDINGS}
            onReset={() => setScreen("upload")}
          />
        )}
      </main>
    </div>
  );
}
