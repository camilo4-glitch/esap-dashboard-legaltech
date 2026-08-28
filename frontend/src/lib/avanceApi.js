// Reporte semanal de ejecución de obra.
// Es la unidad de medida de la ETAPA CONTRACTUAL: mientras en lo precontractual
// el avance son actividades cumplidas, en ejecución es el porcentaje de obra
// reportado en cada corte semanal por la supervisión o la interventoría.
import { supabase } from './supabaseClient'

export async function listAvanceSemanal(proyectoId) {
  const { data, error } = await supabase
    .from('avance_semanal')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('fecha_corte', { ascending: true })
  if (error) throw error
  return data
}

export async function guardarAvanceSemanal(proyectoId, reporte) {
  const fila = {
    proyecto_id: proyectoId,
    fecha_corte: reporte.fechaCorte,
    avance_fisico: reporte.avanceFisico === '' ? null : Number(reporte.avanceFisico),
    avance_financiero: reporte.avanceFinanciero === '' ? null : Number(reporte.avanceFinanciero),
    observacion: reporte.observacion || null,
    reportado_por: reporte.reportadoPor || null,
  }
  const { error } = await supabase
    .from('avance_semanal')
    .upsert(fila, { onConflict: 'proyecto_id,fecha_corte' })
  if (error) throw error
}

export async function eliminarAvanceSemanal(id) {
  const { error } = await supabase.from('avance_semanal').delete().eq('id', id)
  if (error) throw error
}

// Lunes de la semana en curso, como corte por defecto.
export function corteSemanaActual() {
  const hoy = new Date()
  const dia = (hoy.getDay() + 6) % 7      // 0 = lunes
  hoy.setDate(hoy.getDate() - dia)
  return hoy.toISOString().slice(0, 10)
}
