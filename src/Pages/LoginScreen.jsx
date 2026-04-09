import { useState } from 'react'
import { Link } from 'react-router-dom'
import { auth, googleProvider, appleProvider } from '../firebase'
import Logo from '../components/Logo'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'

const ERROR_MESSAGES = {
  'auth/user-not-found':      'No account found with this email.',
  'auth/wrong-password':      'Incorrect password.',
  'auth/invalid-credential':  'Incorrect email or password.',
  'auth/email-already-in-use':'An account with this email already exists.',
  'auth/weak-password':       'Password must be at least 6 characters.',
  'auth/invalid-email':       'Please enter a valid email address.',
  'auth/too-many-requests':   'Too many attempts. Please try again later.',
  'auth/popup-closed-by-user':'Sign in was cancelled.',
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.3.05 2.19.72 2.95.77 1.13-.19 2.22-.89 3.41-.84 1.44.08 2.52.6 3.21 1.55-2.91 1.79-2.21 5.93.44 7.08-.55 1.4-1.28 2.79-2.01 4.32zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
)

// 'social' | 'signin' | 'signup'
const INITIAL_MODE = 'social'

function LoginScreen({ isSharedPath, pendingPath }) {
  const [mode, setMode]       = useState(INITIAL_MODE)
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const clearError = () => setError('')

  const saveRedirectIfNeeded = () => {
    if (pendingPath?.startsWith('/shared/')) {
      sessionStorage.setItem('pendingRedirect', pendingPath)
    }
  }

  const handleError = (e) => {
    setError(ERROR_MESSAGES[e.code] || 'Something went wrong. Please try again.')
    setLoading(false)
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    saveRedirectIfNeeded()
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      handleError(e)
    }
  }

  const handleApple = async () => {
    setError('')
    setLoading(true)
    saveRedirectIfNeeded()
    try {
      await signInWithPopup(auth, appleProvider)
    } catch (e) {
      handleError(e)
    }
  }

  const handleEmailSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      handleError(e)
    }
  }

  const handleEmailSignUp = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: name.trim() || email.split('@')[0] })
    } catch (e) {
      handleError(e)
    }
  }

  const switchMode = (next) => {
    setError('')
    setMode(next)
  }

  return (
    <div className="login-screen">
      <Logo variant="horizontal" theme={typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : (localStorage.getItem('prov-theme') || 'dark')} />
      <p className="login-tagline">Track and pass down what matters.</p>
      {isSharedPath && (
        <p className="login-shared-hint">Sign in to view the shared registry.</p>
      )}

      {/* ── Social sign-in buttons ── */}
      <div className="login-social-btns">
        <button
          className="login-social-btn login-social-btn--google"
          onClick={handleGoogle}
          disabled={loading}
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <button
          className="login-social-btn login-social-btn--apple"
          onClick={handleApple}
          disabled={loading}
        >
          <AppleIcon />
          Continue with Apple
        </button>
      </div>

      {/* ── Divider ── */}
      <div className="login-divider">
        <span className="login-divider-line" />
        <span className="login-divider-label">or</span>
        <span className="login-divider-line" />
      </div>

      {/* ── Email entry point ── */}
      {mode === 'social' && (
        <button className="login-email-toggle" onClick={() => switchMode('signin')}>
          Use email instead
        </button>
      )}

      {/* ── Sign in with email ── */}
      {mode === 'signin' && (
        <form className="login-email-form" onSubmit={handleEmailSignIn}>
          <input
            className="login-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => { setEmail(e.target.value); clearError() }}
            required
            autoComplete="email"
          />
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); clearError() }}
            required
            autoComplete="current-password"
          />
          {error && <p className="login-error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <div className="login-switch-row">
            <span className="login-switch-text">No account?</span>
            <button type="button" className="login-switch-link" onClick={() => switchMode('signup')}>
              Create one
            </button>
          </div>
          <button type="button" className="login-back" onClick={() => switchMode('social')}>
            ← Other sign-in options
          </button>
        </form>
      )}

      {/* ── Create account ── */}
      {mode === 'signup' && (
        <form className="login-email-form" onSubmit={handleEmailSignUp}>
          <input
            className="login-input"
            type="text"
            placeholder="Full name"
            value={name}
            onChange={e => { setName(e.target.value); clearError() }}
            required
            autoComplete="name"
          />
          <input
            className="login-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => { setEmail(e.target.value); clearError() }}
            required
            autoComplete="email"
          />
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); clearError() }}
            required
            autoComplete="new-password"
          />
          <input
            className="login-input"
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); clearError() }}
            required
            autoComplete="new-password"
          />
          {error && <p className="login-error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
          <div className="login-switch-row">
            <span className="login-switch-text">Already have an account?</span>
            <button type="button" className="login-switch-link" onClick={() => switchMode('signin')}>
              Sign in
            </button>
          </div>
          <button type="button" className="login-back" onClick={() => switchMode('social')}>
            ← Other sign-in options
          </button>
        </form>
      )}

      <div className="login-footer">
        <Link to="/terms"   className="login-footer-link">Terms</Link>
        <span className="login-footer-sep">·</span>
        <Link to="/privacy" className="login-footer-link">Privacy</Link>
      </div>
    </div>
  )
}

export default LoginScreen
