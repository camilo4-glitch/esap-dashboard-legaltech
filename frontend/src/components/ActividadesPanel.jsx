import { useEffect, useState } from 'react'
import { listActividades, guardarActividad, ETAPAS, ESTADOS_ACTIVIDAD } from '../lib/actividadesApi'

const colorEstado = (e) => ESTADOS_ACTIVIDAD.find(x => x.key === e)?.color || '#c3cad6'

export default function ActividadesPanel({ proyectoId, tipo, onCambio }) {
  const [actividades, setActividades] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(null)
  const [etapaAbierta, setEtapaAbierta] = useState('planeacion')

  const cargar = () => {
    listActividades(proyectoId)
      .then(setActividades)
      .catch(e => setError(e.message))
  }
  useEffect(cargar, [proyectoId])

  const cambiar = async (actividadId, campos) => {
    setGuardando(actividadId)
    // Optimista: se refleja de una vez y se corrige si el guardado falla.
    setActividades(prev => prev.map(a =>
      a.actividad_id === actividadId ? { ...a, ...campos } : a))
    try {
      await guardarActividad(proyectoId, actividadId, campos)
      onCambio?.()
    } catch (e) {
      setError('No se pudo guardar: ' + e.message)
      cargar()
    } finally {
      setGuardando(null)
    }
  }

  if (error && !actividades) return <p className="text-[12px] text-red-600">{error}</p>
  if (!actividades) return <p className="text-[12px] text-ink-faint">Cargando actividades…</p>

  if (!tipo) {
    return (
      <p className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
        Selecciona el <b>tipo de proceso</b> arriba y guarda: las actividades que aplican dependen
        de la modalidad de selección. Por ahora solo se muestran las comunes a todas.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-[12px] text-red-600">{error}</p>}

      {ETAPAS.map(etapa => {
        const items = actividades.filter(a => a.etapa === etapa.key)
        if (items.length === 0) return null
        const aplicables = items.filter(a => a.estado !== 'no_aplica')
        const listas = items.filter(a => a.estado === 'aprobado').length
        const pct = aplicables.length ? Math.round((listas / aplicables.length) * 100) : 0
        const abierta = etapaAbierta === etapa.key

        return (
          <div key={etapa.key} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setEtapaAbierta(abierta ? null : etapa.key)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-white hover:bg-bg transition-colors border-0 cursor-pointer text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: etapa.color }}></span>
              <span className="font-semibold text-[13px] text-ink flex-1">{etapa.label}</span>
              <span className="text-[11px] text-ink-soft font-mono">{listas}/{aplicables.length}</span>
              <span className="w-16 h-1.5 bg-bg rounded overflow-hidden hidden sm:block">
                <span className="block h-full rounded" style={{ width: `${pct}%`, background: etapa.color }}></span>
              </span>
              <span className="text-[11px] font-mono font-semibold text-navy-deep w-9 text-right">{pct}%</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   className={`text-ink-faint shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {abierta && (
              <ul className="list-none m-0 p-0 border-t border-border divide-y divide-border">
                {items.map(a => (
                  <li key={a.actividad_id} className="px-3.5 py-2.5 bg-bg/40">
                    <div className="flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: colorEstado(a.estado) }}></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] text-ink m-0 leading-snug">{a.nombre}</p>
                        {a.nota && <p className="text-[10.5px] text-ink-faint m-0 mt-0.5 leading-snug">{a.nota}</p>}
                      </div>
                      <select
                        value={a.estado}
                        disabled={guardando === a.actividad_id}
                        onChange={(e) => cambiar(a.actividad_id, { estado: e.target.value })}
                        className="text-[11.5px] border border-border rounded px-2 py-1 bg-white shrink-0 focus:outline-none focus:border-teal disabled:opacity-50"
                      >
                        {ESTADOS_ACTIVIDAD.map(e => (
                          <option key={e.key} value={e.key}>{e.label}</option>
                        ))}
                      </select>
                    </div>

                    {(a.estado === 'aprobado' || a.estado === 'en_proceso') && (
                      <div className="grid grid-cols-2 gap-2 mt-2 ml-4.5">
                        <input
                          type="date"
                          defaultValue={a.fecha || ''}
                          onBlur={(e) => { if (e.target.value !== (a.fecha || '')) cambiar(a.actividad_id, { fecha: e.target.value || null }) }}
                          className="text-[11.5px] border border-border rounded px-2 py-1 bg-white focus:outline-none focus:border-teal"
                        />
                        <input
                          type="text"
                          placeholder="Responsable"
                          defaultValue={a.responsable || ''}
                          onBlur={(e) => { if (e.target.value !== (a.responsable || '')) cambiar(a.actividad_id, { responsable: e.target.value || null }) }}
                          className="text-[11.5px] border border-border rounded px-2 py-1 bg-white focus:outline-none focus:border-teal"
                        />
                        <input
                          type="text"
                          placeholder="Observación"
                          defaultValue={a.observacion || ''}
                          onBlur={(e) => { if (e.target.value !== (a.observacion || '')) cambiar(a.actividad_id, { observacion: e.target.value || null }) }}
                          className="col-span-2 text-[11.5px] border border-border rounded px-2 py-1 bg-white focus:outline-none focus:border-teal"
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
