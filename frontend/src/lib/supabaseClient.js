// Cliente Supabase para el frontend (React + Vite).
// Usa la clave PUBLICABLE (anon/publishable) — es segura de exponer en el navegador
// porque toda lectura/escritura queda filtrada por las políticas RLS del proyecto
// (solo usuarios autenticados pueden leer/escribir; ver migraciones en /backend o el
// panel de Supabase > Authentication > Policies).
//
// NUNCA pongas aquí la "service_role key": esa es de servidor únicamente.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en las variables de entorno.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
