import { useEffect, useState } from 'react'
import DocumentosPanel from './DocumentosPanel'
import { listAvancePorEtapa, ETAPAS } from '../lib/actividadesApi'

// Cada etapa se mide con su propia unidad.
const UNIDAD = {
  planeacion: 'estructuración', precontractual: 'estructuración',
  contractual: 'ejecución', poscontractual: 'liquidación',
}

// Ficha de CONSULTA. No pide ni edita datos del proceso: muestra el estado con
// tarjetas y gráficos. Todo lo modificable vive en el editor, que se abre aparte.

const formatMoney = (v) => {
  if (v === null || v === undefined || v === '') return 'Sin valor registrado'
  const n = Number(v)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${n.toLocaleString('es-CO')}`
}

function Tarjeta({ titulo, valor, detalle, color = '#132242' }) {
  return (
    <div className="bg-white border border-border rounded-lg p-3.5 relative overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: color }}></span>
      <p className="font-mono text-[9.5px] tracking-widest uppercase text-ink-faint font-semibold m-0">{titulo}</p>
      <p className="font-serif text-[21px] font-semibold text-navy-deep m-0 mt-1 leading-none">{valor}</p>
      {detalle && <p className="text-[10.5px] text-ink-soft m-0 mt-1.5 leading-snug">{detalle}</p>}
    </div>
  )
}

export default function FichaProyecto({ proyecto, textoPlazo, formatFecha, colorEstado, onEditar, onSaved }) {
  const [avance, setAvance] = useState(null)

  useEffect(() => {
    listAvancePorEtapa(proyecto.id).then(setAvance).catch(() => setAvance([]))
  }, [proyecto.id])

  const porEtapa = (k) => avance?.find(a => a.etapa === k)

  const colorPlazo = proyecto.semaforo === 'vencido' ? '#e34948'
    : proyecto.semaforo === 'por_vencer' ? '#eda100'
    : proyecto.semaforo === 'en_termino' ? '#1baf7a' : '#c3cad6'

  return (
    <div className="p-2 rounded-lg bg-white border border-border">

      <div className="flex items-start justify-between gap-3 px-2 pt-1 pb-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-soft leading-relaxed m-0 max-w-2xl">
            {proyecto.objeto || 'Sin objeto contractual registrado.'}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onEditar(proyecto) }}
          className="shrink-0 bg-navy hover:bg-navy-deep text-white font-semibold py-2 px-4 rounded-lg text-[12.5px] border-0 cursor-pointer transition-colors"
        >
          Abrir editor
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 px-2 mb-4">
        <Tarjeta titulo="Estado" valor={proyecto.statusActual || '—'} color={colorEstado(proyecto.statusActual)}
                 detalle={proyecto.tecnico ? `Técnico: ${proyecto.tecnico}` : 'Sin técnico asignado'} />
        <Tarjeta titulo="Valor" valor={formatMoney(proyecto.valorContrato)} color="#B08D3F"
                 detalle={proyecto.cdp ? `CDP ${proyecto.cdp}` : 'Sin CDP registrado'} />
        <Tarjeta
          titulo={`Avance · ${UNIDAD[proyecto.etapaActual] || 'estructuración'}`}
          valor={`${proyecto.avanceVigente ?? proyecto.avance ?? 0}%`}
          color="#1A7A6E"
          detalle={proyecto.etapaActual === 'contractual'
            ? (proyecto.ultimoCorte
                ? `Corte ${formatFecha(proyecto.ultimoCorte)}`
                : 'Sin reportes de obra')
            : (proyecto.origenEstructuracion === 'actividades' ? 'Según actividades' : 'Dato del informe')} />
        <Tarjeta titulo="Plazo" valor={proyecto.semaforo === 'sin_termino' ? 'Sin término' : textoPlazo(proyecto)}
                 color={colorPlazo}
                 detalle={proyecto.fechaLimite ? `Vence ${formatFecha(proyecto.fechaLimite)}` : null} />
      </div>

      {/* Los tres avances, cada uno en su unidad */}
      <div className="px-2 mb-4">
        <h4 className="font-bold text-[10.5px] uppercase tracking-widest text-ink-faint mb-2.5">Avance por etapa</h4>
        <p className="text-[10.5px] text-ink-faint mb-2.5 mt-[-6px] leading-snug">
          Cada etapa se mide con su propia unidad; la de tu etapa actual va resaltada.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          {[
            { t: 'Planeación', v: proyecto.avancePlaneacion, d: 'Documentos previos del área', c: '#8ea3c9', etapa: 'planeacion' },
            { t: 'Precontractual', v: proyecto.avancePrecontractual, d: 'Trámite del proceso de selección', c: '#37568f', etapa: 'precontractual' },
            { t: 'Ejecución de obra', v: proyecto.avanceEjecucion, d: proyecto.ultimoCorte ? `Último corte ${formatFecha(proyecto.ultimoCorte)}` : 'Sin reportes semanales', c: '#1A7A6E', etapa: 'contractual' },
            { t: 'Liquidación', v: proyecto.avanceLiquidacion, d: 'Actividades poscontractuales', c: '#B08D3F', etapa: 'poscontractual' },
          ].map(x => (
            <div key={x.t} className={`border rounded-lg p-3 ${x.etapa === proyecto.etapaActual ? 'border-navy bg-navy/5' : 'border-border bg-white'}`}>
              <p className="font-mono text-[9px] tracking-widest uppercase text-ink-faint font-semibold m-0">{x.t}</p>
              <p className="font-serif text-[19px] font-semibold text-navy-deep m-0 mt-0.5 leading-none">{x.v ?? 0}%</p>
              <span className="block h-1 bg-bg rounded overflow-hidden mt-1.5">
                <span className="block h-full rounded" style={{ width: `${x.v ?? 0}%`, background: x.c }}></span>
              </span>
              <p className="text-[10px] text-ink-faint m-0 mt-1.5 leading-snug">{x.d}</p>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-[10.5px] uppercase tracking-widest text-ink-faint mb-2.5">Actividades cumplidas por etapa</h4>
        {avance === null ? (
          <p className="text-[12px] text-ink-faint">Calculando…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
            {ETAPAS.map(e => {
              const d = porEtapa(e.key)
              const pct = d ? Number(d.porcentaje) : 0
              const aplicables = d ? Number(d.total) - Number(d.no_aplica) : 0
              return (
                <div key={e.key} className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1">
                  <span className="text-[11.5px] text-ink-soft font-semibold">{e.label}</span>
                  <span className="text-[11.5px] font-mono text-ink-soft">
                    {d ? `${d.aprobadas}/${aplicables}` : '—'}
                  </span>
                  <span className="h-1.5 bg-bg rounded overflow-hidden">
                    <span className="block h-full rounded" style={{ width: `${pct}%`, background: e.color }}></span>
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-navy-deep w-8 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Datos de referencia, solo lectura */}
      <div className="px-2 mb-4">
        <h4 className="font-bold text-[10.5px] uppercase tracking-widest text-ink-faint mb-2">Ficha</h4>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-2 m-0">
          {[
            ['Tipo de proceso', proyecto.tipo],
            ['Sede', proyecto.sede],
            ['Contratista', proyecto.contratista],
            ['Supervisor', proyecto.supervisor],
            ['Inicio', proyecto.fechaInicio ? formatFecha(proyecto.fechaInicio) : null],
            ['Terminación', proyecto.fechaFin ? formatFecha(proyecto.fechaFin) : null],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[9.5px] uppercase tracking-widest text-ink-faint font-bold">{k}</dt>
              <dd className="text-[12.5px] text-ink-soft m-0">{v || '—'}</dd>
            </div>
          ))}
        </dl>
        {proyecto.observaciones && (
          <div className="mt-3">
            <dt className="text-[9.5px] uppercase tracking-widest text-ink-faint font-bold">Observaciones</dt>
            <dd className="text-[12.5px] text-ink-soft m-0 mt-0.5 leading-relaxed">{proyecto.observaciones}</dd>
          </div>
        )}
      </div>

      <div className="border-t border-border px-2 pt-1">
        <DocumentosPanel proyecto={proyecto} onSaved={onSaved} />
      </div>
    </div>
  )
}
