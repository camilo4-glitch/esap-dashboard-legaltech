import { useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import Logo from './Logo'

// Se muestra cuando el usuario abre el enlace de recuperación de contraseña
// que le llega por correo (Supabase dispara el evento PASSWORD_RECOVERY).
export default function UpdatePassword() {
  const { updatePassword, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [listo, setListo] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) {
      setError('No se pudo actualizar: ' + error.message)
    } else {
      setListo(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-deep relative overflow-hidden font-sans">
      <div className="w-full max-w-[380px] mx-4 relative">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-card rounded-[10px] shadow-2xl border border-white/10 p-8">
          {listo ? (
            <>
              <h1 className="font-serif text-[20px] font-semibold text-navy-deep m-0">Contraseña actualizada</h1>
              <p className="text-ink-soft text-[13px] mt-1 mb-6">Ya puedes ingresar con tu nueva contraseña.</p>
              <button
                onClick={signOut}
                className="w-full py-2.5 rounded-lg bg-navy hover:bg-navy-deep text-white font-semibold text-sm tracking-wide transition-colors"
              >
                Ir a iniciar sesión
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 className="font-serif text-[20px] font-semibold text-navy-deep m-0">Nueva contraseña</h1>
              <p className="text-ink-soft text-[13px] mt-1 mb-6">Define una contraseña nueva para tu cuenta.</p>

              <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Nueva contraseña</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold bg-white"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                minLength={8}
              />

              <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Confirmar contraseña</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold bg-white"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />

              {error && <p className="text-red-600 text-[13px] mt-3">{error}</p>}

              <button
                className="mt-6 w-full py-2.5 rounded-lg bg-navy hover:bg-navy-deep text-white font-semibold text-sm tracking-wide transition-colors disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
