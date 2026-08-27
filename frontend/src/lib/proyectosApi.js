// Reemplaza los fetch() a `${API_URL}/api/proyectos` por llamadas directas a Supabase.
// Ventaja: las políticas RLS ya exigen sesión autenticada para leer/escribir,
// así que no hay que reinventar autenticación dentro de FastAPI para este CRUD.
//
// Uso en App.jsx:
//   import { listProyectos, createProyecto, updateProyecto, deleteProyecto } from './lib/proyectosApi'
//   useEffect(() => { listProyectos().then(setProyectos) }, [])

import { supabase } from './supabaseClient'

// ---- Mapeo camelCase (frontend) <-> snake_case (Postgres) ----
const toRow = (p) => ({
  id: p.id,
  nombre: p.nombre ?? p.proyecto,
  sede: p.sede,
  tipo: p.tipo ?? p.tipo_proceso,
  objeto: p.objeto,
  abogado: p.abogado ?? p.abogado_contratacion,
  cdp: p.cdp ?? null,
  valor_contrato: p.valorContrato ?? p.valor_proceso ?? null,
  tecnico: p.tecnico,
  juridico: p.juridico,
  financiero: p.financiero,
  apoyo_supervision: p.apoyoSupervision,
  supervisor: p.supervisor,
  contratista: p.contratista,
  fase: p.fase ?? p.fase_actual,
  fase_prec: p.fasePrec,
  fase_cont: p.faseCont,
  fase_pos: p.fasePos,
  avance: p.avance ?? 0,
  avance_contractual: p.avanceContractual ?? 0,
  avance_poscontractual: p.avancePoscontractual ?? 0,
  adjudicado: p.adjudicado ?? false,
  status_actual: p.statusActual ?? p.estado,
  observaciones: p.observaciones,
  docs_f1: p.docsF1 ?? {},
  docs_f2: p.docsF2 ?? {},
  docs_f3: p.docsF3 ?? {},
  ruta_documentos: p.rutaDocumentos,
  numero_secop: p.numeroSecop,
  secop: p.secop,
  equipo_actual: p.equipoActual,
  historial: p.historial ?? [],
  adiciones: p.adiciones ?? [],
  pagos: p.pagos ?? [],
  adicion: p.adicion ?? false,
  valor_adicion: p.valorAdicion ?? 0,
  pagado: p.pagado ?? 0,
  actas_pago: p.actasPago ?? 0,
  retencion: p.retencion ?? 0,
  fecha_inicio: p.fechaInicio || null,
  fecha_fin: p.fechaFin || null,
  fecha_acta_final: p.fechaActaFinal || null,
  verificado: p.verificado ?? true,
})

const fromRow = (r) => ({
  id: r.id,
  nombre: r.nombre,
  sede: r.sede,
  tipo: r.tipo,
  objeto: r.objeto,
  abogado: r.abogado,
  cdp: r.cdp,
  valorContrato: r.valor_contrato,
  tecnico: r.tecnico,
  juridico: r.juridico,
  financiero: r.financiero,
  apoyoSupervision: r.apoyo_supervision,
  supervisor: r.supervisor,
  contratista: r.contratista,
  fase: r.fase,
  fasePrec: r.fase_prec,
  faseCont: r.fase_cont,
  fasePos: r.fase_pos,
  avance: r.avance,
  avanceContractual: r.avance_contractual,
  avancePoscontractual: r.avance_poscontractual,
  adjudicado: r.adjudicado,
  statusActual: r.status_actual,
  observaciones: r.observaciones,
  docsF1: r.docs_f1,
  docsF2: r.docs_f2,
  docsF3: r.docs_f3,
  rutaDocumentos: r.ruta_documentos,
  numeroSecop: r.numero_secop,
  secop: r.secop,
  equipoActual: r.equipo_actual,
  historial: r.historial,
  adiciones: r.adiciones,
  pagos: r.pagos,
  adicion: r.adicion,
  valorAdicion: r.valor_adicion,
  pagado: r.pagado,
  actasPago: r.actas_pago,
  retencion: r.retencion,
  fechaInicio: r.fecha_inicio,
  fechaFin: r.fecha_fin,
  fechaActaFinal: r.fecha_acta_final,
  updatedAt: r.updated_at,
  verificado: r.verificado,
})

export async function listProyectos() {
  const { data, error } = await supabase
    .from('proyectos')
    .select('*')
    .order('id', { ascending: true })
  if (error) throw error
  return data.map(fromRow)
}

export async function createProyecto(proyecto) {
  const row = toRow(proyecto)
  const { data, error } = await supabase.from('proyectos').insert(row).select().single()
  if (error) throw error
  await logAuditoria(row.id, 'crear_proyecto', { nombre: row.nombre })
  return fromRow(data)
}

export async function updateProyecto(id, cambios) {
  const row = toRow({ id, ...cambios })
  delete row.id
  const { data, error } = await supabase
    .from('proyectos')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  await logAuditoria(id, 'actualizar_proyecto', cambios)
  return fromRow(data)
}

export async function deleteProyecto(id) {
  const { error } = await supabase.from('proyectos').delete().eq('id', id)
  if (error) throw error
  await logAuditoria(id, 'eliminar_proyecto', {})
}

async function logAuditoria(proyectoId, accion, detalle) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('auditoria').insert({
    proyecto_id: proyectoId,
    usuario_id: user?.id ?? null,
    accion,
    detalle,
  })
}
