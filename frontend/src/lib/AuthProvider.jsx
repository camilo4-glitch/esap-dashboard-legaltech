import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

// Envuelve <App /> con <AuthProvider> en main.jsx.
// Expone { user, session, loading, signIn, signOut } vía useAuth().
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // Se activa cuando el usuario abre el enlace de "recuperar contraseña" del
  // correo. Mientras esté en true, main.jsx debe mostrar el formulario de
  // "definir nueva contraseña" en vez del login o el dashboard.
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  // Envía el correo de recuperación (Supabase lo maneja automáticamente,
  // no requiere backend propio). redirectTo debe apuntar a esta misma app.
  const resetPasswordForEmail = (email) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })

  // Se llama desde el formulario de "nueva contraseña" tras abrir el enlace
  // de recuperación (en ese punto Supabase ya generó una sesión temporal).
  const updatePassword = async (newPassword) => {
    const result = await supabase.auth.updateUser({ password: newPassword })
    setPasswordRecovery(false)
    return result
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signOut,
        passwordRecovery,
        resetPasswordForEmail,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
