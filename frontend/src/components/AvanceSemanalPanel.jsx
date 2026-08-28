import { useEffect, useState } from 'react'
import { listAvanceSemanal, guardarAvanceSemanal, eliminarAvanceSemanal, corteSemanaActual } from '../lib/avanceApi'

// Colores validados para dos series (físico / financiero).
const C_FISICO = '#2a78d6'
const C_FINAN  = '#eb6834'

function Curva({ reportes }) {
  if (reportes.length < 2) return null
  const W = 520, H = 130, P = { t: 10, r: 10, b: 22, l: 30 }
  const xs = reportes.map(r => new Date(r.fecha_corte + 'T00:00:00').getTime())
  const min = Math.min(...xs), max = Math.max(...xs)
  const px = (t) => P.l + ((t - min) / (max - min || 1)) * (W - P.l - P.r)
  const py = (v) => P.t + (1 - (v || 0) / 100) * (H - P.t - P.b)

  const linea = (campo) => reportes
    .filter(r => r[campo] !== null && r[campo] !== undefined)
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${px(new Date(r.fecha_corte + 'T00:00:00').getTime()).toFixed(1)} ${py(Number(r[campo])).toFixed(1)}`)
    .join(' ')

  const ultimo = reportes[reportes.length - 1]

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, height: 'auto' }} role="img"
           aria-label="Evolución del avance de ejecución">
        {[0, 50, 100].map(v => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={py(v)} y2={py(v)} stroke="#E2E6EE" strokeWidth="1" />
            <text x={P.l - 6} y={py(v) + 3.5} textAnchor="end" fontSize="9" fill="#8A93A6" fontFamily="monospace">{v}</text>
          </g>
        ))}
        <path d={linea('avance_fisico')} fill="none" stroke={C_FISICO} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={linea('avance_financiero')} fill="none" stroke={C_FINAN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 3" />
        {ultimo?.avance_fisico != null && (
          <circle cx={px(new Date(ultimo.fecha_corte + 'T00:00:00').getTime())} cy={py(Number(ultimo.avance_fisico))}
                  r="4" fill={C_FISICO} stroke="#fff" strokeWidth="2" />
        )}
      </svg>
      <div className="flex gap-4 text-[10.5px] text-ink-soft mt-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block" style={{ background: C_FISICO }}></span>Físico</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block border-t-2 border-dashed" style={{ borderColor: C_FINAN }}></span>Financiero</span>
      </div>
    </div>
  )
}

export default function AvanceSemanalPanel({ proyectoId, onCambio }) {
  const [reportes, setReportes] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    fechaCorte: corteSemanaActual(), avanceFisico: '', avanceFinanciero: '',
    observacion: '', reportadoPor: '',
  })

  const cargar = () => listAvanceSemanal(proyectoId).then(setReportes).catch(e => setError(e.message))
  useEffect(cargar, [proyectoId])

  const enviar = async (e) => {
    e.preventDefault()
    if (!form.fechaCorte) { setError('Indica la fecha de corte.'); return }
    setGuardando(true); setError('')
    try {
      await guardarAvanceSemanal(proyectoId, form)
      setForm(f => ({ ...f, avanceFisico: '', avanceFinanciero: '', observacion: '' }))
      await cargar()
      onCambio?.()
    } catch (e2) { setError('No se pudo guardar: ' + e2.message) }
    finally { setGuardando(false) }
  }

  const borrar = async (id) => {
    if (!confirm('¿Eliminar este reporte semanal?')) return
    try { await eliminarAvanceSemanal(id); await cargar(); onCambio?.() }
    catch (e) { setError(e.message) }
  }

  if (reportes === null) return <p className="text-[12px] text-ink-faint">Cargando reportes…</p>

  const ultimo = reportes[reportes.length - 1]
  const dias = ultimo ? Math.floor((Date.now() - new Date(ultimo.fecha_corte + 'T00:00:00')) / 86400000) : null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-ink-soft leading-relaxed m-0">
        En la etapa contractual el avance <b>no</b> son documentos: es el porcentaje de obra
        ejecutada, reportado en cada corte semanal por la supervisión o la interventoría.
      </p>

      {ultimo ? (
        <div className={`px-3.5 py-2.5 rounded-lg border text-[12.5px] ${
          dias > 14 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-bg border-border text-ink-soft'}`}>
          Último corte: <b>{new Date(ultimo.fecha_corte + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</b>
          {' · '}físico <b>{ultimo.avance_fisico ?? '—'}%</b>
          {ultimo.avance_financiero != null && <> · financiero <b>{ultimo.avance_financiero}%</b></>}
          {dias > 14 && <> — hace {dias} días, el reporte está desactualizado.</>}
        </div>
      ) : (
        <div className="px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[12.5px]">
          Sin reportes de ejecución. Mientras no haya ninguno, el avance de este proyecto se
          muestra como 0% aunque su estructuración esté completa.
        </div>
      )}

      {reportes.length >= 2 && <Curva reportes={reportes} />}

      <form onSubmit={enviar} className="border border-border rounded-lg p-3.5 bg-bg/40">
        <p className="text-[11px] font-semibold text-ink-soft uppercase tracking-wide mb-2.5">Nuevo corte</p>
        <div className="grid grid-cols-3 gap-2.5">
          <label className="text-[10.5px] text-ink-faint">Fecha de corte
            <input type="date" value={form.fechaCorte} onChange={e => setForm({ ...form, fechaCorte: e.target.value })}
                   className="w-full border border-border rounded px-2 py-1.5 text-[12.5px] bg-white mt-0.5" />
          </label>
          <label className="text-[10.5px] text-ink-faint">Avance físico %
            <input type="number" min="0" max="100" step="0.01" value={form.avanceFisico}
                   onChange={e => setForm({ ...form, avanceFisico: e.target.value })}
                   className="w-full border border-border rounded px-2 py-1.5 text-[12.5px] bg-white mt-0.5" />
          </label>
          <label className="text-[10.5px] text-ink-faint">Avance financiero %
            <input type="number" min="0" max="100" step="0.01" value={form.avanceFinanciero}
                   onChange={e => setForm({ ...form, avanceFinanciero: e.target.value })}
                   className="w-full border border-border rounded px-2 py-1.5 text-[12.5px] bg-white mt-0.5" />
          </label>
          <label className="text-[10.5px] text-ink-faint col-span-2">Observación
            <input value={form.observacion} onChange={e => setForm({ ...form, observacion: e.target.value })}
                   placeholder="Novedades de la semana"
                   className="w-full border border-border rounded px-2 py-1.5 text-[12.5px] bg-white mt-0.5" />
          </label>
          <label className="text-[10.5px] text-ink-faint">Reportado por
            <input value={form.reportadoPor} onChange={e => setForm({ ...form, reportadoPor: e.target.value })}
                   className="w-full border border-border rounded px-2 py-1.5 text-[12.5px] bg-white mt-0.5" />
          </label>
        </div>
        {error && <p className="text-[12px] text-red-600 mt-2 mb-0">{error}</p>}
        <button type="submit" disabled={guardando}
                className="mt-3 px-4 py-1.5 rounded-lg text-[12.5px] font-semibold text-white bg-navy hover:bg-navy-deep border-0 cursor-pointer disabled:opacity-60">
          {guardando ? 'Guardando…' : 'Registrar corte'}
        </button>
      </form>

      {reportes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                {['Corte', 'Físico', 'Financiero', 'Observación', 'Reportó', ''].map(h => (
                  <th key={h} className="text-left p-2 text-[9.5px] uppercase tracking-widest text-ink-faint font-bold border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...reportes].reverse().map(r => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-2 font-mono whitespace-nowrap">{r.fecha_corte}</td>
                  <td className="p-2 font-mono font-semibold" style={{ color: C_FISICO }}>{r.avance_fisico ?? '—'}%</td>
                  <td className="p-2 font-mono" style={{ color: C_FINAN }}>{r.avance_financiero ?? '—'}%</td>
                  <td className="p-2 text-ink-soft">{r.observacion || '—'}</td>
                  <td className="p-2 text-ink-soft whitespace-nowrap">{r.reportado_por || r.usuario_email || '—'}</td>
                  <td className="p-2 text-right">
                    <button onClick={() => borrar(r.id)} className="text-[11px] text-red-700 hover:underline bg-transparent border-0 cursor-pointer">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
