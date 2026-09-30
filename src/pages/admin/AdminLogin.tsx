import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { FormField } from '../../components/ui/FormField'
import { Spinner } from '../../components/ui/Spinner'
import { LoadingScreen } from '../../components/ui/LoadingScreen'

export function AdminLogin() {
  const { signIn, profile, loading } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (!loading && profile?.role === 'admin') {
      navigate('/admin/overview', { replace: true })
    }
    if (!loading && profile?.role === 'hospital_user') {
      navigate('/hospital/dashboard', { replace: true })
    }
  }, [loading, profile, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setBusy(true)
    const { error: signInError } = await signIn(email.trim(), password)
    setBusy(false)
    if (signInError) {
      setError('Invalid credentials. Please check your email and password.')
      return
    }
    // Auth state change will fetch profile; redirect handled by useEffect
  }

  if (loading) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-ivory-50 flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-teal-950 flex-col justify-between p-14">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center">
            <Activity size={16} className="text-white" strokeWidth={2} />
          </div>
          <span className="font-serif text-lg text-white tracking-tight">MedBridge</span>
        </div>

        <div>
          <blockquote className="text-2xl font-serif text-white leading-snug mb-4 tracking-tight">
            "Every merge decision,<br />
            every confidence score,<br />
            every actor — logged once<br />
            <em>and preserved forever.</em>"
          </blockquote>
          <p className="text-teal-400 text-sm font-sans">Platform Administration Portal</p>
        </div>

        <div className="space-y-3">
          {['Hospitals', 'Identity searches', 'Platform audit events'].map((stat) => (
            <div key={stat} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span className="text-teal-300 text-sm">{stat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center">
              <Activity size={16} className="text-white" strokeWidth={2} />
            </div>
            <span className="font-serif text-lg text-charcoal-900">MedBridge</span>
          </div>

          <h2 className="text-2xl font-serif text-charcoal-950 mb-1">Administrator sign in</h2>
          <p className="text-sm text-charcoal-500 mb-8">Platform owner access only.</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <FormField label="Email address" required>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                placeholder="admin@example.com"
                autoComplete="email"
                autoFocus
                disabled={busy}
              />
            </FormField>

            <FormField label="Password" required error={error || undefined}>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={busy}
              />
            </FormField>

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {busy ? <Spinner size="sm" /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-xs text-charcoal-400 mt-8 text-center">
            Hospital staff?{' '}
            <Link to="/hospital/login" className="text-teal-700 hover:underline">
              Use the hospital portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
