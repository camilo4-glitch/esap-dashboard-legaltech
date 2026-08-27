// Acceso a la tabla `proyectos` de Supabase desde el frontend.
// Las políticas RLS ya exigen sesión autenticada para leer/escribir, así que no
// hay que reinventar autenticación dentro de FastAPI para este CRUD.
//
// IMPORTANTE (corrección de un bug grave de pérdida de datos):
// La versión anterior construía SIEMPRE la fila completa, rellenando con valores
// por defecto (0, [], {}, false, null) todo campo que el formulario no incluyera.
// Como el modal de edición solo maneja ~12 campos, guardar un cambio pequeño
// (p. ej. las observaciones) BORRABA silenciosamente pagos, adiciones, historial,
// fechas, CDP, retención, actas de pago y el estado de adjudicación.
// Ahora las actualizaciones son PARCIALES: solo viaja lo que el llamador envía.

import { supabase } from './supabaseClient'

// ---- Mapeo camelCase (frontend) <-> snake_case (Postgres) ----
// Una sola fuente de verdad para ambas direcciones.
const MAPA = {
  nombre: 'nombre',
  sede: 'sede',
  tipo: 'tipo',
  objeto: 'objeto',
  abogado: 'abogado',
  cdp: 'cdp',
  valorContrato: 'valor_contrato',
  tecnico: 'tecnico',
  juridico: 'juridico',
  financiero: 'financiero',
  apoyoSupervision: 'apoyo_supervision',
  supervisor: 'supervisor',
  contratista: 'contratista',
  fase: 'fase',
  fasePrec: 'fase_prec',
  faseCont: 'fase_cont',
  fasePos: 'fase_pos',
  avance: 'avance',
  avanceContractual: 'avance_contractual',
  avancePoscontractual: 'avance_poscontractual',
  adjudicado: 'adjudicado',
  statusActual: 'status_actual',
  observaciones: 'observaciones',
  docsF1: 'docs_f1',
  docsF2: 'docs_f2',
  docsF3: 'docs_f3',
  rutaDocumentos: 'ruta_documentos',
  numeroSecop: 'numero_secop',
  secop: 'secop',
  equipoActual: 'equipo_actual',
  historial: 'historial',
  adiciones: 'adiciones',
  pagos: 'pagos',
  adicion: 'adicion',
  valorAdicion: 'valor_adicion',
  pagado: 'pagado',
  actasPago: 'actas_pago',
  retencion: 'retencion',
  fechaInicio: 'fecha_inicio',
  fechaFin: 'fecha_fin',
  fechaActaFinal: 'fecha_acta_final',
  verificado: 'verificado',
}

// Columnas de fecha: '' no es una fecha válida en Postgres, se manda como null.
const COLUMNAS_FECHA = new Set(['fecha_inicio', 'fecha_fin', 'fecha_acta_final'])
// Columnas numéricas: '' tampoco es válido; se manda como null.
const COLUMNAS_NUMERICAS = new Set(['cdp', 'valor_contrato', 'valor_adicion', 'pagado', 'actas_pago', 'retencion'])

function normalizar(columna, valor) {
  if (COLUMNAS_FECHA.has(columna) && !valor) return null
  if (COLUMNAS_NUMERICAS.has(columna) && (valor === '' || valor === undefined)) return null
  return valor
}

// Fila PARCIAL: solo las claves que el llamador envió explícitamente.
// Es lo que debe usarse para UPDATE, para no pisar campos que no se editaron.
function toRowParcial(p) {
  const row = {}
  for (const [claveFront, columna] of Object.entries(MAPA)) {
    if (p[claveFront] !== undefined) {
      row[columna] = normalizar(columna, p[claveFront])
    }
  }
  return row
}

// Fila COMPLETA con valores por defecto sensatos. Solo para INSERT, donde sí
// queremos inicializar los contadores y colecciones vacías.
function toRowNuevo(p) {
  return {
    ...toRowParcial(p),
    id: p.id,
    avance: p.avance ?? 0,
    avance_contractual: p.avanceContractual ?? 0,
    avance_poscontractual: p.avancePoscontractual ?? 0,
    adjudicado: p.adjudicado ?? false,
    docs_f1: p.docsF1 ?? {},
    docs_f2: p.docsF2 ?? {},
    docs_f3: p.docsF3 ?? {},
    historial: p.historial ?? [],
    adiciones: p.adiciones ?? [],
    pagos: p.pagos ?? [],
    adicion: p.adicion ?? false,
    valor_adicion: p.valorAdicion ?? 0,
    pagado: p.pagado ?? 0,
    actas_pago: p.actasPago ?? 0,
    retencion: p.retencion ?? 0,
    fase: p.fase ?? 'necesidad',
    verificado: p.verificado ?? true,
  }
}

const fromRow = (r) => {
  const p = { id: r.id, updatedAt: r.updated_at }
  for (const [claveFront, columna] of Object.entries(MAPA)) {
    p[claveFront] = r[columna]
  }
  return p
}

export async function listProyectos() {
  const { data, error } = await supabase
    .from('proyectos')
    .select('*')
    .order('id', { ascending: true })
  if (error) throw error
  return data.map(fromRow)
}

export async function createProyecto(proyecto) {
  const row = toRowNuevo(proyecto)
  const { data, error } = await supabase.from('proyectos').insert(row).select().single()
  if (error) throw error
  await logAuditoria(row.id, 'crear_proyecto', { nombre: row.nombre })
  return fromRow(data)
}

export async function updateProyecto(id, cambios) {
  // Solo viajan los campos presentes en `cambios`. Todo lo demás se conserva.
  const row = toRowParcial(cambios)
  delete row.id
  if (Object.keys(row).length === 0) {
    throw new Error('No hay cambios que guardar.')
  }
  const { data, error } = await supabase
    .from('proyectos')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  await logAuditoria(id, 'actualizar_proyecto', row)
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
