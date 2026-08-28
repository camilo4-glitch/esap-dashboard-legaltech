import { useEffect, useState } from 'react'
import ActividadesPanel from './ActividadesPanel'
import HistorialPanel from './HistorialPanel'
import AvanceSemanalPanel from './AvanceSemanalPanel'
import { listSedes, vincularProyectoASede, desvincularProyectoDeSede } from '../lib/sedesApi'

// Panel de EDICIÓN. Independiente de la ficha de consulta: aquí se puede
// modificar cualquier campo del proyecto, marcar las actividades de cada etapa,
// corregir la ciudad de ejecución y ver el historial de cambios.

const PESTANAS = [
  { key: 'datos',       label: 'Datos del proceso' },
  { key: 'equipo',      label: 'Equipo' },
  { key: 'actividades', label: 'Actividades' },
  { key: 'ejecucion',   label: 'Avance de obra' },
  { key: 'contractual', label: 'Contractual' },
  { key: 'ubicacion',   label: 'Ubicación' },
  { key: 'historial',   label: 'Historial' },
]

function Campo({ label, children, ancho = 1, ayuda }) {
  return (
    <div className={ancho === 2 ? 'col-span-2' : ''}>
      <label className="block text-[11px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">{label}</label>
      {children}
      {ayuda && <p className="text-[10.5px] text-ink-faint mt-1 leading-snug">{ayuda}</p>}
    </div>
  )
}

const inputCls = 'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white'

export default function EditorProyecto({
  proyecto, formData, onChange, onGuardar, onCerrar, esNuevo,
  tiposProceso, estadosProceso, fases, guardando, onEliminar,
}) {
  const [pestana, setPestana] = useState('datos')
  const [sedes, setSedes] = useState([])
  const [sedesDelProyecto, setSedesDelProyecto] = useState([])
  const [msgSede, setMsgSede] = useState('')

  useEffect(() => {
    if (esNuevo) return
    listSedes()
      .then(todas => {
        setSedes(todas)
        setSedesDelProyecto(
          todas.filter(s => (s.listaProyectos || []).some(p => p.id === proyecto.id)).map(s => s.id)
        )
      })
      .catch(() => {})
  }, [proyecto?.id, esNuevo])

  const alternarSede = async (sedeId) => {
    const yaEsta = sedesDelProyecto.includes(sedeId)
    setSedesDelProyecto(prev => yaEsta ? prev.filter(x => x !== sedeId) : [...prev, sedeId])
    try {
      if (yaEsta) await desvincularProyectoDeSede(proyecto.id, sedeId)
      else await vincularProyectoASede(proyecto.id, sedeId)
      setMsgSede('Ubicación actualizada.')
      setTimeout(() => setMsgSede(''), 2500)
    } catch (e) {
      setMsgSede('No se pudo guardar: ' + e.message)
      setSedesDelProyecto(prev => yaEsta ? [...prev, sedeId] : prev.filter(x => x !== sedeId))
    }
  }

  // En un proyecto nuevo aún no hay id, así que actividades/ubicación/historial
  // no tienen sobre qué operar hasta después de guardar.
  const pestanasVisibles = esNuevo
    ? PESTANAS.filter(p => p.key === 'datos' || p.key === 'equipo' || p.key === 'contractual')
    : PESTANAS

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-ink/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-card rounded-[10px] shadow-2xl w-full max-w-3xl border border-border my-6 overflow-hidden">

        <div className="px-6 py-4 bg-navy flex justify-between items-start gap-4">
          <div className="min-w-0">
            <h3 className="font-serif text-lg font-semibold text-white m-0 truncate">
              {esNuevo ? 'Nuevo proyecto' : formData.nombre || proyecto?.nombre}
            </h3>
            <p className="text-[11.5px] text-white/50 m-0 mt-0.5 font-mono">
              {esNuevo ? 'Sin guardar' : proyecto?.id}
            </p>
          </div>
          <button onClick={onCerrar} className="text-white/60 hover:text-white bg-transparent border-0 cursor-pointer shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3 pb-0 bg-navy-deep/5 border-b border-border overflow-x-auto">
          {pestanasVisibles.map(p => (
            <button
              key={p.key}
              onClick={() => setPestana(p.key)}
              className={`px-3.5 py-2 rounded-t-lg text-[12.5px] font-semibold whitespace-nowrap border-0 cursor-pointer transition-colors ${
                pestana === p.key ? 'bg-card text-navy-deep' : 'bg-transparent text-ink-soft hover:text-navy'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <form onSubmit={onGuardar}>
          <div className="p-6 max-h-[62vh] overflow-y-auto">

            {pestana === 'datos' && (
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Nombre del proyecto" ancho={2}>
                  <input required name="nombre" value={formData.nombre || ''} onChange={onChange} className={inputCls} placeholder="Ej. Adecuación de aulas" />
                </Campo>
                <Campo label="Tipo de proceso" ayuda="Determina qué actividades aplican">
                  <select name="tipo" value={formData.tipo || ''} onChange={onChange} className={inputCls}>
                    <option value="">Seleccione…</option>
                    {tiposProceso.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Campo>
                <Campo label="Estado">
                  <select name="statusActual" value={formData.statusActual || ''} onChange={onChange} className={inputCls}>
                    <option value="">Seleccione…</option>
                    {estadosProceso.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </Campo>
                <Campo label="Fase">
                  <select name="fase" value={formData.fase || 'necesidad'} onChange={onChange} className={inputCls}>
                    {fases.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </Campo>
                <Campo label="Sede">
                  <select name="sede" value={formData.sede || ''} onChange={onChange} className={inputCls}>
                    <option value="Sede Central">Sede Central</option>
                    <option value="Territorial">Territorial</option>
                  </select>
                </Campo>
                <Campo label="Valor estimado" ayuda="Vacío = sin valor registrado">
                  <input type="number" name="valorContrato" value={formData.valorContrato ?? ''} onChange={onChange} className={inputCls} />
                </Campo>
                <Campo label="CDP">
                  <input type="number" name="cdp" value={formData.cdp ?? ''} onChange={onChange} className={inputCls} />
                </Campo>
                <Campo label="Número SECOP">
                  <input name="numeroSecop" value={formData.numeroSecop || ''} onChange={onChange} className={inputCls} placeholder="ESAP-SAMC-012-2026" />
                </Campo>
                <Campo label="Objeto" ancho={2}>
                  <textarea name="objeto" rows={3} value={formData.objeto || ''} onChange={onChange} className={`${inputCls} resize-y`} />
                </Campo>
                <Campo label="Observaciones" ancho={2}>
                  <textarea name="observaciones" rows={3} value={formData.observaciones || ''} onChange={onChange} className={`${inputCls} resize-y`} />
                </Campo>
                <Campo label="Enlace SECOP" ancho={2}>
                  <input name="secop" value={formData.secop || ''} onChange={onChange} className={inputCls} placeholder="https://community.secop.gov.co/…" />
                </Campo>
                <Campo label="Carpeta del proceso (Drive)" ancho={2}>
                  <input name="rutaDocumentos" value={formData.rutaDocumentos || ''} onChange={onChange} className={inputCls} placeholder="https://drive.google.com/…" />
                </Campo>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-[12.5px] text-ink-soft select-none">
                    <input type="checkbox" name="verificado" checked={formData.verificado ?? true} onChange={onChange} className="w-4 h-4 accent-teal" />
                    Dato verificado por el equipo GIM
                  </label>
                </div>
              </div>
            )}

            {pestana === 'equipo' && (
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Técnico a cargo"><input name="tecnico" value={formData.tecnico || ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Abogado a cargo" ayuda="Antes existían «Jurídico» y «Abogado» por separado; se unificaron porque guardaban el mismo dato.">
                  <input name="abogado" value={formData.abogado || ''} onChange={onChange} className={inputCls} placeholder="Nombre completo" />
                </Campo>
                <Campo label="Financiero"><input name="financiero" value={formData.financiero || ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Supervisor"><input name="supervisor" value={formData.supervisor || ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Apoyo a la supervisión"><input name="apoyoSupervision" value={formData.apoyoSupervision || ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Contratista" ancho={2}><input name="contratista" value={formData.contratista || ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Equipo actual" ancho={2}><input name="equipoActual" value={formData.equipoActual || ''} onChange={onChange} className={inputCls} /></Campo>
              </div>
            )}

            {pestana === 'actividades' && !esNuevo && (
              <>
                <p className="text-[12px] text-ink-soft mb-3 leading-relaxed">
                  Actividades según el Manual de Contratación de la ESAP (Res. 1559 de 2025).
                  Las que se muestran dependen de la modalidad de selección del proceso.
                </p>
                <ActividadesPanel proyectoId={proyecto.id} tipo={formData.tipo} />
              </>
            )}

            {pestana === 'ejecucion' && !esNuevo && (
              <AvanceSemanalPanel proyectoId={proyecto.id} />
            )}

            {pestana === 'contractual' && (
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Entró a la fase el"><input type="date" name="faseDesde" value={formData.faseDesde || ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Fecha límite propia" ayuda="Solo si el término difiere del estándar"><input type="date" name="fechaLimiteManual" value={formData.fechaLimiteManual || ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Fecha de inicio"><input type="date" name="fechaInicio" value={formData.fechaInicio || ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Fecha de terminación"><input type="date" name="fechaFin" value={formData.fechaFin || ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Fecha acta final"><input type="date" name="fechaActaFinal" value={formData.fechaActaFinal || ''} onChange={onChange} className={inputCls} /></Campo>
                <div className="col-span-2 rounded-md border border-border bg-bg px-3 py-2 text-[11.5px] text-ink-soft leading-snug">
                  El avance ya no se digita a mano. Se calcula solo: actividades cumplidas
                  en planeación y precontractual, reportes semanales de obra en contractual,
                  y actividades de liquidación en poscontractual.
                </div>
                <Campo label="Pagado"><input type="number" name="pagado" value={formData.pagado ?? ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Actas de pago"><input type="number" name="actasPago" value={formData.actasPago ?? ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Retención"><input type="number" name="retencion" value={formData.retencion ?? ''} onChange={onChange} className={inputCls} /></Campo>
                <Campo label="Valor de la adición"><input type="number" name="valorAdicion" value={formData.valorAdicion ?? ''} onChange={onChange} className={inputCls} /></Campo>
                <div className="col-span-2 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[12.5px] text-ink-soft select-none">
                    <input type="checkbox" name="adjudicado" checked={!!formData.adjudicado} onChange={onChange} className="w-4 h-4 accent-teal" />
                    Adjudicado
                  </label>
                  <label className="flex items-center gap-2 text-[12.5px] text-ink-soft select-none">
                    <input type="checkbox" name="adicion" checked={!!formData.adicion} onChange={onChange} className="w-4 h-4 accent-teal" />
                    Tiene adición o prórroga
                  </label>
                </div>
              </div>
            )}

            {pestana === 'ubicacion' && !esNuevo && (
              <>
                <p className="text-[12px] text-ink-soft mb-3 leading-relaxed">
                  Sedes donde se ejecuta este proyecto. Se puede marcar más de una —hay procesos
                  que intervienen varias— y los cambios se guardan al instante.
                </p>
                {msgSede && <p className="text-[12px] text-teal mb-3">{msgSede}</p>}
                <div className="flex flex-col gap-1.5 max-h-[42vh] overflow-y-auto">
                  {sedes.map(s => (
                    <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 border border-border rounded-lg hover:bg-bg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sedesDelProyecto.includes(s.id)}
                        onChange={() => alternarSede(s.id)}
                        className="w-4 h-4 accent-teal shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-ink font-medium truncate">{s.nombre}</span>
                        <span className="block text-[10.5px] text-ink-faint truncate">
                          {s.municipio || 'Sin ciudad'}{s.departamento ? `, ${s.departamento}` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                  {sedes.length === 0 && <p className="text-[12.5px] text-ink-faint">Cargando sedes…</p>}
                </div>
              </>
            )}

            {pestana === 'historial' && !esNuevo && <HistorialPanel proyectoId={proyecto.id} />}
          </div>

          <div className="px-6 py-4 border-t border-border flex gap-3 items-center bg-bg/40">
            {!esNuevo && onEliminar && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(
                    `¿Enviar «${proyecto.nombre}» a la papelera?\n\n` +
                    'No se borra nada: el proyecto sale de los tableros pero conserva su ' +
                    'historial, sus actividades y sus reportes de obra, y se puede restaurar ' +
                    'desde el botón «Papelera».'
                  )) onEliminar(proyecto.id)
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-red-700 border border-red-200 bg-white hover:bg-red-50 transition-colors cursor-pointer"
              >
                Enviar a papelera
              </button>
            )}
            <span className="flex-1"></span>
            <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-lg text-sm font-semibold text-ink-soft hover:bg-bg bg-transparent border-0 cursor-pointer">
              Cerrar
            </button>
            <button type="submit" disabled={guardando} className="px-6 py-2 rounded-lg text-sm font-semibold text-white bg-navy hover:bg-navy-deep transition-colors shadow-sm disabled:opacity-60 border-0 cursor-pointer">
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
