import { useEffect, useState } from 'react'
import { listPapelera, restaurarProyecto } from '../lib/proyectosApi'

// Papelera: los proyectos que se retiraron de los tableros SIN borrarse.
// La fila sigue en la base con todo lo suyo (historial, actividades, reportes
// de obra); solo tiene `eliminado = true`, que es lo que las vistas filtran.
// Por eso restaurar es instantáneo y no pierde nada.

const formatFecha = (v) =>
  v ? new Date(v).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—'

export default function PapeleraPanel({ onCerrar, onRestaurado }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(null)

  const cargar = () => {
    setError('')
    listPapelera().then(setItems).catch(e => setError(e.message))
  }
  useEffect(cargar, [])

  const restaurar = async (p) => {
    if (!window.confirm(`¿Devolver «${p.nombre}» a los tableros?`)) return
    setTrabajando(p.id)
    try {
      await restaurarProyecto(p.id)
      setItems(prev => prev.filter(x => x.id !== p.id))
      onRestaurado?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setTrabajando(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-serif text-[20px] font-semibold text-navy-deep m-0">Papelera</h2>
          <p className="text-[12px] text-ink-soft m-0 mt-1 leading-snug">
            Proyectos retirados de los tableros. No se borró nada: conservan su historial,
            sus actividades y sus reportes de obra, y vuelven completos al restaurarlos.
          </p>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          {error && <p className="text-[12.5px] text-red-600 mb-3">No se pudo cargar la papelera: {error}</p>}
          {items === null && !error && <p className="text-[12.5px] text-ink-faint">Cargando…</p>}
          {items?.length === 0 && (
            <p className="text-[13px] text-ink-soft">La papelera está vacía.</p>
          )}
          <div className="flex flex-col gap-2">
            {items?.map(p => (
              <div key={p.id} className="border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink m-0 truncate">{p.nombre}</p>
                  <p className="text-[11px] text-ink-faint m-0 mt-0.5 truncate">
                    {p.sede || 'Sin sede'} · {p.tipo || 'Sin tipo'} · {p.tecnico || 'Sin técnico'}
                  </p>
                  <p className="text-[10.5px] text-ink-faint m-0 mt-0.5">
                    A papelera el {formatFecha(p.eliminadoEn)}
                    {p.eliminadoPor ? ` por ${p.eliminadoPor}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => restaurar(p)}
                  disabled={trabajando === p.id}
                  className="shrink-0 px-3.5 py-2 rounded-lg text-[12.5px] font-semibold text-navy border border-navy bg-white hover:bg-navy hover:text-white transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {trabajando === p.id ? 'Restaurando…' : 'Restaurar'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end bg-bg/40">
          <button
            onClick={onCerrar}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-navy hover:bg-navy-deep transition-colors border-0 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
