import { useEffect, useState } from 'react'
import { listHistorial } from '../lib/proyectosApi'

// Nombres legibles de las columnas. Lo que no esté aquí se muestra tal cual.
const ETIQUETAS = {
  nombre: 'Nombre', sede: 'Sede', tipo: 'Tipo de proceso', objeto: 'Objeto',
  abogado: 'Abogado', cdp: 'CDP', valor_contrato: 'Valor', tecnico: 'Técnico',
  juridico: 'Jurídico', financiero: 'Financiero', supervisor: 'Supervisor',
  contratista: 'Contratista', fase: 'Fase', avance: 'Avance documental',
  avance_contractual: 'Avance contractual', adjudicado: 'Adjudicado',
  status_actual: 'Estado', observaciones: 'Observaciones', verificado: 'Verificado',
  fase_desde: 'Entrada a la fase', fecha_limite_manual: 'Fecha límite propia',
  numero_secop: 'Número SECOP', secop: 'Enlace SECOP', ruta_documentos: 'Carpeta',
  pagado: 'Pagado', actas_pago: 'Actas de pago', retencion: 'Retención',
  fecha_inicio: 'Fecha de inicio', fecha_fin: 'Fecha de terminación',
}

const FASES = {
  necesidad: 'Sin iniciar', estructuracion: 'Estructuración', fase1: 'Fase 1 · Anexos',
  fase2: 'Fase 2 · Estudios', fase3: 'Fase 3 · Adjudicación', ejecucion: 'Ejecución',
}

function mostrar(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  if (campo === 'fase') return FASES[valor] || valor
  if (typeof valor === 'object') return JSON.stringify(valor)
  const s = String(valor)
  return s.length > 90 ? s.slice(0, 90) + '…' : s
}

const ACCIONES = {
  crear: { texto: 'Creó el proyecto', color: 'bg-teal' },
  actualizar: { texto: 'Modificó', color: 'bg-navy' },
  eliminar: { texto: 'Eliminó el proyecto', color: 'bg-red-600' },
  carga_masiva_inicial: { texto: 'Carga inicial automática', color: 'bg-ink-faint' },
  actualizar_proyecto: { texto: 'Modificó', color: 'bg-navy' },
  crear_proyecto: { texto: 'Creó el proyecto', color: 'bg-teal' },
}

export default function HistorialPanel({ proyectoId }) {
  const [registros, setRegistros] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    listHistorial(proyectoId)
      .then(d => { if (vigente) setRegistros(d) })
      .catch(e => { if (vigente) setError(e.message) })
    return () => { vigente = false }
  }, [proyectoId])

  if (error) return <p className="text-[12px] text-red-600">No se pudo cargar el historial: {error}</p>
  if (registros === null) return <p className="text-[12px] text-ink-faint">Cargando historial…</p>
  if (registros.length === 0) return <p className="text-[12px] text-ink-faint">Sin cambios registrados todavía.</p>

  return (
    <ul className="list-none p-0 m-0 flex flex-col gap-3">
      {registros.map(r => {
        const acc = ACCIONES[r.accion] || { texto: r.accion, color: 'bg-ink-faint' }
        // En "actualizar" el detalle es {campo: {antes, despues}}
        const campos = r.accion === 'actualizar' || r.accion === 'actualizar_proyecto'
          ? Object.entries(r.detalle || {})
          : []
        const conAntesDespues = campos.filter(([, v]) => v && typeof v === 'object' && 'despues' in v)

        return (
          <li key={r.id} className="border-l-2 border-border pl-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`text-[9px] font-bold uppercase tracking-wide text-white px-1.5 py-0.5 rounded ${acc.color}`}>
                {acc.texto}
              </span>
              <span className="text-[11.5px] text-ink-soft font-medium">
                {r.usuario_email || 'sistema'}
              </span>
              <span className="text-[10.5px] text-ink-faint font-mono ml-auto">
                {new Date(r.created_at).toLocaleString('es-CO', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>

            {conAntesDespues.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-1">
                {conAntesDespues.map(([campo, v]) => (
                  <div key={campo} className="text-[11.5px] leading-snug">
                    <span className="text-ink-faint">{ETIQUETAS[campo] || campo}: </span>
                    <span className="text-ink-soft line-through decoration-ink-faint/60">{mostrar(campo, v.antes)}</span>
                    <span className="text-ink-faint mx-1">→</span>
                    <span className="text-ink font-medium">{mostrar(campo, v.despues)}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
