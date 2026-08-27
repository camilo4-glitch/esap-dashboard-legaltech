import { useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import Logo from './Logo'

// Pantalla de login. Los usuarios se crean desde el panel de Supabase
// (Authentication > Users > Add user) o con una invitación por correo —
// no hay auto-registro público a propósito.
export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError('Usuario o contraseña incorrectos.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-deep relative overflow-hidden font-sans">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(700px 400px at 10% 0%, #C8970A, transparent 60%), radial-gradient(700px 400px at 100% 100%, #1A7A6E, transparent 55%)',
        }}
      />
      <div className="w-full max-w-[380px] mx-4 relative">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-[10px] shadow-2xl border border-white/10 p-8">
          <h1 className="font-serif text-[20px] font-semibold text-navy-deep m-0">Acceso institucional</h1>
          <p className="text-ink-soft text-[13px] mt-1 mb-6">Ingresa con tu cuenta de la ESAP</p>

          <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Correo</label>
          <input
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold bg-white"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            placeholder="nombre@esap.edu.co"
          />

          <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Contraseña</label>
          <input
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold bg-white"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-red-600 text-[13px] mt-3">{error}</p>}

          <button
            className="mt-6 w-full py-2.5 rounded-lg bg-navy hover:bg-navy-deep text-white font-semibold text-sm tracking-wide transition-colors disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-white/30 text-[11px] mt-6 font-mono tracking-wide uppercase">
          Gestión de Infraestructura Misional · ESAP
        </p>
      </div>
    </div>
  )
}
