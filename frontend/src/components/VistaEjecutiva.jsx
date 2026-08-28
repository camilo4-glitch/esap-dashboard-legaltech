import { useMemo } from 'react'

// Vista EJECUTIVA: una sola pantalla, sin tablas, pensada para proyectar y para
// imprimir en PDF (botón "Exportar PDF" → diálogo de impresión → Guardar como PDF,
// sin librerías externas). Todo sale de los proyectos ya cargados.

const formatMoney = (v) => {
  const n = Number(v || 0)
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)} mil M`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`
  return `$${n.toLocaleString('es-CO')}`
}

function Cifra({ etiqueta, valor, detalle, color = '#132242' }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-white relative overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: color }}></span>
      <p className="font-mono text-[10px] tracking-widest uppercase text-ink-faint font-semibold m-0">{etiqueta}</p>
      <p className="font-serif text-[30px] font-semibold text-navy-deep m-0 mt-1 leading-none tabular-nums">{valor}</p>
      {detalle && <p className="text-[11px] text-ink-soft m-0 mt-1.5 leading-snug">{detalle}</p>}
    </div>
  )
}

function Barras({ titulo, datos, nota }) {
  const max = Math.max(1, ...datos.map(d => d.valor))
  return (
    <div className="border border-border rounded-lg p-4 bg-white">
      <h3 className="font-serif text-[15px] font-semibold text-navy-deep m-0 mb-3">{titulo}</h3>
      <div className="flex flex-col gap-2">
        {datos.map(d => (
          <div key={d.etiqueta} className="grid grid-cols-[130px_1fr_30px] items-center gap-2.5">
            <span className="text-[11.5px] text-ink-soft font-semibold truncate">{d.etiqueta}</span>
            <span className="h-2 bg-bg rounded overflow-hidden">
              <span className="block h-full rounded" style={{ width: `${(d.valor / max) * 100}%`, background: d.color }}></span>
            </span>
            <span className="text-[12px] font-mono font-semibold text-navy-deep text-right tabular-nums">{d.valor}</span>
          </div>
        ))}
      </div>
      {nota && <p className="text-[10.5px] text-ink-faint mt-3 mb-0 leading-snug">{nota}</p>}
    </div>
  )
}

export default function VistaEjecutiva({ proyectos, fases, colorEstado }) {
  const r = useMemo(() => {
    const central = proyectos.filter(p => p.sede === 'Sede Central')
    const terr    = proyectos.filter(p => p.sede !== 'Sede Central')
    const valor   = proyectos.reduce((a, p) => a + Number(p.valorContrato || 0), 0)
    const conValor = proyectos.filter(p => p.valorContrato != null).length
    const enEjec  = proyectos.filter(p => p.etapaActual === 'contractual').length
    const vencidos   = proyectos.filter(p => p.semaforo === 'vencido')
    const porVencer  = proyectos.filter(p => p.semaforo === 'por_vencer')
    const congelados = proyectos.filter(p => (p.statusActual || '').toUpperCase() === 'CONGELADO')

    const porFase = fases.map(f => ({
      etiqueta: f.label,
      valor: proyectos.filter(p => (p.fase || 'necesidad') === f.key).length,
      color: f.color,
    }))

    const estados = {}
    proyectos.forEach(p => { const e = p.statusActual || 'Sin estado'; estados[e] = (estados[e] || 0) + 1 })
    const porEstado = Object.entries(estados)
      .map(([etiqueta, valor]) => ({ etiqueta, valor, color: colorEstado(etiqueta) }))
      .sort((a, b) => b.valor - a.valor).slice(0, 8)

    const conAvance = proyectos.filter(p => (p.avanceVigente ?? 0) > 0)
    const promedio = conAvance.length
      ? Math.round(conAvance.reduce((a, p) => a + Number(p.avanceVigente || 0), 0) / conAvance.length) : 0

    return { central, terr, valor, conValor, enEjec, vencidos, porVencer, congelados,
             porFase, porEstado, promedio }
  }, [proyectos, fases, colorEstado])

  const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col gap-4" id="vista-ejecutiva">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-[28px] font-semibold text-navy-deep m-0 tracking-tight">
            Estado de la cartera <span className="text-gold">—</span> GIM
          </h2>
          <p className="text-ink-soft text-[13px] m-0 mt-1">
            Grupo de Infraestructura y Mantenimiento · ESAP · corte al {hoy}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-presentar bg-white border border-navy text-navy hover:bg-navy hover:text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm transition-colors text-sm cursor-pointer"
        >
          Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Cifra etiqueta="Proyectos" valor={proyectos.length}
               detalle={`${r.central.length} Sede Central · ${r.terr.length} territoriales`} />
        <Cifra etiqueta="En ejecución" valor={r.enEjec} color="#1A7A6E"
               detalle={`Avance promedio ${r.promedio}%`} />
        <Cifra etiqueta="Valor registrado" valor={formatMoney(r.valor)} color="#B08D3F"
               detalle={`${r.conValor} de ${proyectos.length} procesos con valor`} />
        <Cifra etiqueta="Requieren atención" valor={r.vencidos.length + r.congelados.length}
               color={r.vencidos.length ? '#e34948' : '#c3cad6'}
               detalle={`${r.vencidos.length} vencidos · ${r.congelados.length} congelados`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Barras titulo="Distribución por fase" datos={r.porFase}
                nota="La fase determina con qué unidad se mide el avance: estructuración, ejecución de obra o liquidación." />
        <Barras titulo="Estado del proceso" datos={r.porEstado} />
      </div>

      {(r.vencidos.length > 0 || r.porVencer.length > 0) && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-red-50 border-b border-red-200">
            <h3 className="font-serif text-[15px] font-semibold text-red-800 m-0">
              Términos vencidos y próximos a vencer
            </h3>
          </div>
          <div className="divide-y divide-border bg-white">
            {[...r.vencidos, ...r.porVencer].slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2">
                <span className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: p.semaforo === 'vencido' ? '#e34948' : '#eda100' }}></span>
                <span className="text-[13px] text-ink font-medium flex-1 truncate">{p.nombre}</span>
                <span className="text-[11px] text-ink-soft font-mono shrink-0">{p.tecnico || 'Sin técnico'}</span>
                <span className={`text-[12px] font-semibold shrink-0 ${p.semaforo === 'vencido' ? 'text-red-700' : 'text-amber-700'}`}>
                  {p.diasHabilesRestantes < 0
                    ? `${Math.abs(p.diasHabilesRestantes)} d vencido`
                    : `${p.diasHabilesRestantes} d`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10.5px] text-ink-faint leading-snug border-t border-border pt-3">
        Cifras generadas automáticamente desde el sistema de seguimiento del GIM.
        El avance de cada proyecto se mide según su etapa: actividades de estructuración
        en lo precontractual, obra reportada semanalmente en lo contractual, y actividades
        de liquidación en lo poscontractual.
      </p>
    </div>
  )
}
