import { useState } from 'react'
import { Link } from 'react-router-dom'
import { auth, googleProvider, appleProvider } from '../firebase'
import { signInWithPopup } from 'firebase/auth'

const FEATURE_CARDS = [
  {
    icon: '◈',
    title: 'Catalog Your Assets',
    description: 'Add photos, values, and details for everything that matters.',
  },
  {
    icon: '✦',
    title: 'Tell the Story',
    description: 'Document where things came from and what they mean to you.',
  },
  {
    icon: '◎',
    title: 'Share with Family',
    description: 'Invite beneficiaries to view your registry and express interest.',
  },
]

const STEPS = [
  {
    title: 'Take a photo',
    description: 'Upload a photo of any item and AI will identify it instantly.',
  },
  {
    title: 'Review and edit',
    description: 'Confirm the details and add your personal story.',
  },
  {
    title: 'Build your registry',
    description: 'Your complete estate catalog, always up to date.',
  },
]

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

function ProgressDots({ total, current }) {
  return (
    <div className="ob-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`ob-dot ${i === current ? 'ob-dot--active' : ''}`} />
      ))}
    </div>
  )
}

function Onboarding({ pendingPath, isSharedPath, onUseEmail }) {
  const [screen, setScreen] = useState(0)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError]     = useState('')

  const skip = () => setScreen(3)

  // Mirror the redirect-stash behavior from LoginScreen so a deep link
  // to /shared/... survives the popup round-trip.
  const saveRedirectIfNeeded = () => {
    if (pendingPath?.startsWith('/shared/')) {
      sessionStorage.setItem('pendingRedirect', pendingPath)
    }
  }

  const handleGoogle = async () => {
    setAuthError('')
    setAuthLoading(true)
    saveRedirectIfNeeded()
    try {
      await signInWithPopup(auth, googleProvider)
      // App.jsx auth listener takes over from here.
    } catch (e) {
      setAuthError(
        e.code === 'auth/popup-closed-by-user'
          ? 'Sign in was cancelled.'
          : 'Sign in failed. Please try again.'
      )
      setAuthLoading(false)
    }
  }

  const handleApple = async () => {
    setAuthError('')
    setAuthLoading(true)
    saveRedirectIfNeeded()
    try {
      await signInWithPopup(auth, appleProvider)
    } catch (e) {
      setAuthError(
        e.code === 'auth/popup-closed-by-user'
          ? 'Sign in was cancelled.'
          : 'Apple sign-in is not yet available.'
      )
      setAuthLoading(false)
    }
  }

  return (
    <div className="ob-root">
      {/* Skip button — only on screens 2 and 3 (indices 1 and 2). Jumps
          straight to the login screen so the user still has to sign in. */}
      {screen > 0 && screen < 3 && (
        <button className="ob-skip" onClick={skip}>Skip</button>
      )}

      {/* Animated screen area */}
      <div className="ob-body" key={screen}>
        {screen === 0 && (
          <div className="ob-screen ob-screen--welcome">
            <div className="ob-ornament" />
            <h1 className="ob-wordmark">Provenance</h1>
            <div className="ob-ornament" />
            <p className="ob-tagline">Your legacy, documented.</p>
            <p className="ob-subtext">
              Provenance helps you catalog what matters, tell its story, and pass it on with intention.
            </p>
            <button className="btn-primary ob-cta" onClick={() => setScreen(1)}>
              Get Started
            </button>
          </div>
        )}

        {screen === 1 && (
          <div className="ob-screen">
            <h2 className="ob-heading">Everything in one place</h2>
            <div className="ob-feature-cards">
              {FEATURE_CARDS.map((card) => (
                <div key={card.title} className="ob-feature-card">
                  <span className="ob-feature-icon">{card.icon}</span>
                  <div>
                    <div className="ob-feature-title">{card.title}</div>
                    <div className="ob-feature-desc">{card.description}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-primary ob-cta" onClick={() => setScreen(2)}>Next</button>
          </div>
        )}

        {screen === 2 && (
          <div className="ob-screen">
            <h2 className="ob-heading">Getting started is easy</h2>
            <div className="ob-steps">
              {STEPS.map((step, i) => (
                <div key={step.title} className="ob-step">
                  <div className="ob-step-number">{i + 1}</div>
                  <div className="ob-step-body">
                    <div className="ob-step-title">{step.title}</div>
                    <div className="ob-step-desc">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-primary ob-cta" onClick={() => setScreen(3)}>Next</button>
          </div>
        )}

        {screen === 3 && (
          <div className="ob-screen ob-screen--ready">
            <div className="ob-ornament" />
            <h2 className="ob-heading ob-heading--centered">You're all set</h2>
            <p className="ob-subtext ob-subtext--centered">
              Create your free account to get started. Your information is private and secure.
            </p>
            {isSharedPath && (
              <p className="ob-subtext ob-subtext--centered">
                Sign in to view the shared registry.
              </p>
            )}

            <div className="ob-auth-actions">
              <button
                type="button"
                className="login-social-btn login-social-btn--google"
                onClick={handleGoogle}
                disabled={authLoading}
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="ob-apple-wrap">
                <button
                  type="button"
                  className="login-social-btn login-social-btn--apple"
                  onClick={handleApple}
                  disabled={authLoading}
                >
                  <AppleIcon />
                  Continue with Apple
                </button>
                <p className="ob-coming-soon">Coming soon</p>
              </div>

              <div className="login-divider">
                <span className="login-divider-line" />
                <span className="login-divider-label">or</span>
                <span className="login-divider-line" />
              </div>

              <button
                type="button"
                className="login-email-toggle"
                onClick={onUseEmail}
                disabled={authLoading}
              >
                Use email instead
              </button>

              {authError && <p className="login-error">{authError}</p>}
            </div>

            <div className="login-footer">
              <Link to="/terms"   className="login-footer-link">Terms</Link>
              <span className="login-footer-sep">·</span>
              <Link to="/privacy" className="login-footer-link">Privacy</Link>
            </div>
          </div>
        )}
      </div>

      <ProgressDots total={4} current={screen} />
    </div>
  )
}

export default Onboarding
