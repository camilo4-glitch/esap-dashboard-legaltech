import { useState } from 'react'
import { useAuth } from '../lib/AuthProvider'

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
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>SIG-INFRA · GIM ESAP</h1>
        <p style={styles.subtitle}>Ingresa con tu cuenta institucional</p>
        <label style={styles.label}>Correo</label>
        <input
          style={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <label style={styles.label}>Contraseña</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#E7EDF6',
  },
  card: {
    width: 360,
    background: '#fff',
    borderRadius: 12,
    padding: 32,
    boxShadow: '0 10px 30px rgba(11,46,110,0.15)',
  },
  title: { color: '#0B2E6E', margin: 0, fontSize: 20 },
  subtitle: { color: '#5a6b8c', marginTop: 4, marginBottom: 20, fontSize: 13 },
  label: { display: 'block', fontSize: 12, color: '#16213A', marginTop: 12, marginBottom: 4 },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #cdd7ea',
    fontSize: 14,
    boxSizing: 'border-box',
  },
  button: {
    marginTop: 20,
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: 'none',
    background: '#0B2E6E',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: { color: '#b3261e', fontSize: 13, marginTop: 10 },
}
