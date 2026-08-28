// Actividades del proceso contractual por etapa.
// El catálogo (public.actividades_catalogo) sale del Manual de Contratación
// ESAP, Resolución 1559 de 2025. Qué actividades aplican a cada proyecto lo
// decide la base según su modalidad de selección; aquí solo se lee y se marca.
import { supabase } from './supabaseClient'

export const ETAPAS = [
  { key: 'planeacion',     label: 'Planeación',     color: '#8ea3c9' },
  { key: 'precontractual', label: 'Precontractual', color: '#37568f' },
  { key: 'contractual',    label: 'Contractual',    color: '#1A7A6E' },
  { key: 'poscontractual', label: 'Poscontractual', color: '#B08D3F' },
]

export const ESTADOS_ACTIVIDAD = [
  { key: 'pendiente',  label: 'Pendiente',  color: '#c3cad6' },
  { key: 'en_proceso', label: 'En proceso', color: '#eda100' },
  { key: 'aprobado',   label: 'Aprobado',   color: '#1baf7a' },
  { key: 'no_aplica',  label: 'No aplica',  color: '#8892a6' },
]

export async function listActividades(proyectoId) {
  const { data, error } = await supabase
    .from('v_proyecto_actividades')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('orden', { ascending: true })
  if (error) throw error
  return data
}

export async function listAvancePorEtapa(proyectoId) {
  const { data, error } = await supabase
    .from('v_avance_por_etapa')
    .select('*')
    .eq('proyecto_id', proyectoId)
  if (error) throw error
  return data
}

// Guarda el estado de una actividad. Se usa upsert porque la fila puede no
// existir todavía: el catálogo se expande por vista, no se pre-crea.
export async function guardarActividad(proyectoId, actividadId, cambios) {
  const { error } = await supabase
    .from('proyecto_actividades')
    .upsert({
      proyecto_id: proyectoId,
      actividad_id: actividadId,
      ...cambios,
    }, { onConflict: 'proyecto_id,actividad_id' })
  if (error) throw error
}
