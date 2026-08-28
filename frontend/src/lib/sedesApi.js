// Inventario geográfico: sede central, direcciones territoriales y CETAP,
// con los proyectos que se intervienen en cada una.
import { supabase } from './supabaseClient'

// Solo los vínculos proyecto↔sede. Los datos del proyecto los aporta el
// tablero, que ya los tiene con avance, etapa y semáforo calculados.
export async function listVinculos() {
  const { data, error } = await supabase.from('proyecto_sedes').select('proyecto_id, sede_id')
  if (error) throw error
  return data
}

export async function listSedes() {
  const { data: sedes, error } = await supabase
    .from('sedes')
    .select('*')
    .eq('activo', true)
    .order('tipo', { ascending: true })
    .order('nombre', { ascending: true })
  if (error) throw error

  // Los proyectos de cada sede, en una segunda consulta (la relación es N a N).
  const { data: vinculos, error: e2 } = await supabase
    .from('proyecto_sedes')
    .select('sede_id, proyectos(id, nombre, status_actual, fase)')
  if (e2) throw e2

  const porSede = {}
  for (const v of vinculos || []) {
    if (!v.proyectos) continue
    ;(porSede[v.sede_id] ||= []).push(v.proyectos)
  }

  return sedes.map(s => ({
    ...s,
    listaProyectos: porSede[s.id] || [],
    proyectos: (porSede[s.id] || []).length,
  }))
}

export async function crearSede(sede) {
  const { data, error } = await supabase.from('sedes').insert(sede).select().single()
  if (error) throw error
  return data
}

export async function actualizarSede(id, cambios) {
  const { data, error } = await supabase
    .from('sedes').update(cambios).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function vincularProyectoASede(proyectoId, sedeId) {
  const { error } = await supabase
    .from('proyecto_sedes')
    .insert({ proyecto_id: proyectoId, sede_id: sedeId })
  if (error && error.code !== '23505') throw error   // 23505 = ya existía
}

export async function desvincularProyectoDeSede(proyectoId, sedeId) {
  const { error } = await supabase
    .from('proyecto_sedes').delete()
    .eq('proyecto_id', proyectoId).eq('sede_id', sedeId)
  if (error) throw error
}

// Conteo de proyectos por departamento, para el mapa coroplético.
// Una territorial cubre varios departamentos, así que el conteo sale de la
// jurisdicción, no de la ciudad sede.
export async function listProyectosPorDepartamento() {
  const { data, error } = await supabase
    .from('v_proyectos_por_departamento')
    .select('*')
  if (error) throw error
  return data
}
