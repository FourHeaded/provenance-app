import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { auth, db, googleProvider } from '../firebase'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth'
import {
  collection, getDocs, getDoc, addDoc,
  query, where, doc, updateDoc, onSnapshot,
  arrayUnion, serverTimestamp,
} from 'firebase/firestore'
import Logo from '../components/Logo'

const AUTH_ERROR_MESSAGES = {
  'auth/user-not-found':       'No account found with this email.',
  'auth/wrong-password':       'Incorrect password.',
  'auth/invalid-credential':   'Incorrect email or password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password':        'Password must be at least 6 characters.',
  'auth/invalid-email':        'Please enter a valid email address.',
  'auth/too-many-requests':    'Too many attempts. Please try again later.',
  'auth/popup-closed-by-user': 'Sign in was cancelled.',
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const ESTATE_CATEGORY_LABELS = {
  'will':           'Will & Testament',
  'poa-financial':  'Power of Attorney (Financial)',
  'poa-healthcare': 'Power of Attorney (Healthcare)',
  'living-will':    'Living Will / Advance Directive',
  'trust':          'Trust Documents',
  'beneficiary':    'Beneficiary Designations',
  'insurance':      'Insurance Policies',
  'property':       'Property Deeds & Titles',
  'tax':            'Tax Documents',
  'other':          'Other Legal Documents',
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231A1A1A'/%3E%3Crect x='60' y='60' width='80' height='60' rx='4' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Ccircle cx='85' cy='82' r='8' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Cpolyline points='60,120 85,95 105,112 125,88 140,120' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3C/svg%3E"

// Aggressive session teardown used when an invite is found revoked.
// Standard signOut leaves Firebase's IndexedDB cache behind, which can
// re-hydrate the auth state on the next visit; wiping the persistence
// stores plus localStorage/sessionStorage and then reloading gives the
// auth gate a fully clean slate.
const forceSignOut = async () => {
  try {
    await signOut(auth)
    localStorage.clear()
    sessionStorage.clear()
    const databases = await indexedDB.databases()
    await Promise.all(
      databases
        .filter(db => db.name?.includes('firebase') || db.name?.includes('firestore'))
        .map(db => new Promise((res, rej) => {
          const req = indexedDB.deleteDatabase(db.name)
          req.onsuccess = res
          req.onerror = rej
        }))
    )
  } catch (e) {
    console.error('Force signout error:', e)
  } finally {
    window.location.reload()
  }
}

function SharedRegistry({ user }) {
  const { ownerUid } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  // 'wrong-account' | 'revoked' | 'invalid' | null — drives which deny copy renders below.
  const [denyReason, setDenyReason] = useState(null)
  const [assets, setAssets] = useState([])
  const [estateDocs, setEstateDocs] = useState([])
  const [ownerName, setOwnerName] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const [expressingInterest, setExpressingInterest] = useState(null)

  // Auth-gate state for unauthenticated beneficiaries
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [authMode, setAuthMode]           = useState('signin') // 'signin' | 'signup'
  const [authLoading, setAuthLoading]     = useState(false)
  const [authError, setAuthError]         = useState('')
  const [name, setName]                   = useState('')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [confirm, setConfirm]             = useState('')

  // Tolerant of legacy entries that were stored as bare strings
  // (uid or email) instead of the current object shape.
  const hasExpressedInterest = (asset) => {
    if (!asset?.interestedParties || !user) return false
    return asset.interestedParties.some(entry =>
      typeof entry === 'string'
        ? entry === user.uid || entry === user.email
        : entry?.uid === user.uid || entry?.email === user.email
    )
  }

  // App.jsx's auth listener also upserts userSettings on every sign-in, so
  // this is a defensive duplicate: it guarantees the row exists by the
  // time we resume the invite verification flow below, in case App.jsx
  // hasn't run its init effect yet.
  const ensureUserSettings = async (newUser) => {
    if (!newUser?.uid) return
    try {
      const settingsSnap = await getDocs(query(
        collection(db, 'userSettings'),
        where('uid', '==', newUser.uid),
      ))
      if (settingsSnap.empty) {
        await addDoc(collection(db, 'userSettings'), {
          uid: newUser.uid,
          email: (newUser.email || '').toLowerCase(),
          displayName: newUser.displayName || '',
          isPremium: false,
          onboardingComplete: false,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        })
      }
    } catch (err) {
      console.error('Ensure userSettings failed:', err)
    }
  }

  const handleAuthError = (err) => {
    setAuthError(AUTH_ERROR_MESSAGES[err?.code] || 'Sign in failed. Please try again.')
    setAuthLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setAuthError('')
    setAuthLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      await ensureUserSettings(result.user)
      // App.jsx auth listener now flips `user` to the signed-in account,
      // which re-renders this component and lets the invite-check effect
      // run with the authenticated email.
    } catch (err) {
      handleAuthError(err)
    }
  }

  const handleEmailSignIn = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      await ensureUserSettings(cred.user)
    } catch (err) {
      handleAuthError(err)
    }
  }

  const handleEmailSignUp = async (e) => {
    e.preventDefault()
    setAuthError('')
    if (password !== confirm) {
      setAuthError('Passwords do not match.')
      return
    }
    setAuthLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const trimmed = name.trim() || email.split('@')[0]
      try { await updateProfile(cred.user, { displayName: trimmed }) } catch {}
      await ensureUserSettings({ ...cred.user, displayName: trimmed })
    } catch (err) {
      handleAuthError(err)
    }
  }

  const switchAuthMode = (next) => {
    setAuthError('')
    setAuthMode(next)
  }

  const handleSwitchAccount = async () => {
    try {
      await signOut(auth)
    } catch (err) {
      console.error('Sign-out from wrong-account screen failed:', err)
    }
    // Clear local deny state so the auth gate shows clean on the next render.
    setDenyReason(null)
    setHasAccess(false)
    setLoading(true)
    setShowEmailForm(false)
    setEmail('')
    setPassword('')
    setConfirm('')
    setName('')
  }

  useEffect(() => {
    let unsubscribeInvite = null

    // Auth-gate path: we don't know who's viewing yet, so don't run any
    // Firestore work. The render below shows the sign-in UI, and this
    // effect will re-run once `user.email` populates. Leaving loading
    // truthy here avoids a brief "Access Required" flash between the
    // sign-in resolving and the access check running.
    if (!user) {
      return () => {}
    }

    // Re-entering after a successful sign-in / account switch: reset
    // the loading + access state so the gate doesn't flicker.
    setLoading(true)
    setHasAccess(false)
    setDenyReason(null)

    const load = async () => {
      // Owner can always preview their own shared registry
      if (user.uid === ownerUid) {
        setHasAccess(true)
        setOwnerName(user.displayName || '')
      } else {
        // Deterministic invite ID lookup — no query, no composite index needed.
        // Format must match what Profile.jsx writes: `{ownerUid}_{lowercased email}`
        const userEmail = (user.email || '').toLowerCase().trim()
        const inviteDocId = `${ownerUid}_${userEmail}`
        const inviteRef = doc(db, 'invites', inviteDocId)
        let inviteSnap = await getDoc(inviteRef)

        // Defensive fallback: if the invite was written with a different
        // email casing (legacy data), try a query on the lowercased email.
        if (!inviteSnap.exists()) {
          console.log('No invite found for:', inviteDocId)
          try {
            const fallbackSnap = await getDocs(query(
              collection(db, 'invites'),
              where('registryOwnerUid', '==', ownerUid),
              where('invitedEmail', '==', userEmail),
            ))
            if (!fallbackSnap.empty) {
              inviteSnap = fallbackSnap.docs[0]
            }
          } catch (err) {
            console.error('Invite fallback lookup failed:', err)
          }
        }

        const inviteData = inviteSnap.exists?.() ? inviteSnap.data() : (inviteSnap.data?.() || null)
        console.log('Invite doc ID:', inviteDocId)
        console.log('Invite data:', inviteData)
        console.log('Current status:', inviteData?.status)

        // Strict gate: only pending or accepted invites grant access.
        // Everything else (missing doc, revoked, declined, unknown status)
        // is denied; the deny copy below tells the user which.
        if (!inviteData) {
          // No invite exists for the signed-in email — most likely cause
          // is the user clicked someone else's invite link.
          setDenyReason('wrong-account')
          setLoading(false)
          return
        }
        if (inviteData.status === 'revoked') {
          setDenyReason('revoked')
          setHasAccess(false)
          setLoading(false)
          // forceSignOut clears Firebase IndexedDB persistence in addition
          // to localStorage/sessionStorage, then reloads. The deny copy
          // will render against a fully clean auth state.
          await forceSignOut()
          return
        }
        if (inviteData.status !== 'pending' && inviteData.status !== 'accepted') {
          setDenyReason('invalid')
          setLoading(false)
          return
        }

        setHasAccess(true)
        setOwnerName(inviteData.ownerName || '')

        // Resolve the actual ref to update (the fallback may have surfaced
        // a doc with a different ID than our deterministic format).
        const actualInviteRef = inviteSnap.ref || inviteRef

        // Live-watch the invite doc so that if the owner revokes access
        // while the beneficiary has the page open, we flip them to the
        // revoked state immediately — no refresh required.
        unsubscribeInvite = onSnapshot(
          actualInviteRef,
          async (snap) => {
            // Doc disappearing or flipping to revoked both mean the owner
            // pulled access — forceSignOut also clears the IndexedDB
            // persistence so the cached token can't be reused.
            if (!snap.exists() || snap.data()?.status === 'revoked') {
              setHasAccess(false)
              setDenyReason('revoked')
              await forceSignOut()
              return
            }
            const status = snap.data()?.status
            if (status !== 'pending' && status !== 'accepted') {
              setHasAccess(false)
              setDenyReason('invalid')
            }
          },
          (err) => console.error('Invite subscribe failed:', err),
        )

        // First successful view of a pending invite = acceptance. Flip the
        // status, then notify the owner via email + in-app notification.
        // Best-effort: failures here must not block registry access.
        if (inviteData.status === 'pending') {
          try {
            await updateDoc(actualInviteRef, {
              status: 'accepted',
              acceptedAt: serverTimestamp(),
            })
            const ownerSettingsQuery = query(
              collection(db, 'userSettings'),
              where('uid', '==', ownerUid),
            )
            const ownerSnap = await getDocs(ownerSettingsQuery)
            if (!ownerSnap.empty) {
              const ownerData = ownerSnap.docs[0].data()
              if (ownerData.email) {
                await addDoc(collection(db, 'mail'), {
                  to: ownerData.email,
                  message: {
                    subject: `${inviteData.invitedName || user.email} accepted your Provenance invite`,
                    html: `
                      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1C1A17;">
                        <h1 style="font-size: 32px; font-weight: 400; margin-bottom: 8px;">Provenance</h1>
                        <p style="font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #9A7030; margin-bottom: 32px;">Estate Asset Registry</p>
                        <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;"><strong>${inviteData.invitedName || user.email}</strong> has accepted your invitation and can now view your Provenance registry.</p>
                        <hr style="border: none; border-top: 0.5px solid #D5D0C8; margin: 32px 0;" />
                        <p style="font-size: 12px; color: #A09890;">You received this because you invited someone to your Provenance registry.</p>
                      </div>
                    `,
                  },
                })
              }
            }
            await addDoc(collection(db, 'notifications'), {
              ownerUid,
              type: 'invite_accepted',
              fromName: inviteData.invitedName || user.displayName || user.email,
              fromEmail: user.email,
              read: false,
              createdAt: serverTimestamp(),
            })
          } catch (err) {
            console.error('Invite-accepted notification failed:', err)
          }
        }
      }

      // Load owner's active assets
      const assetSnap = await getDocs(query(
        collection(db, 'assets'),
        where('uid', '==', ownerUid),
      ))
      const list = assetSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => a.itemStatus !== 'archived')

      setAssets(list)

      // Button state is derived per-render via hasExpressedInterest(asset)
      // so no separate map needs to be kept in sync with the assets array.

      // Load estate documents shared with this viewer
      // (either explicitly by email, or via the '__all__' token)
      // Owners viewing their own page see everything they've shared.
      try {
        let sharedDocs = []
        if (user.uid === ownerUid) {
          // Owner: load all their estate docs and show only those marked as shared
          const ownerDocsSnap = await getDocs(query(
            collection(db, 'estateDocs'),
            where('uid', '==', ownerUid),
          ))
          sharedDocs = ownerDocsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => Array.isArray(d.sharedWith) && d.sharedWith.length > 0)
        } else {
          // Beneficiary: query by sharedWith and filter to this owner client-side
          const docsSnap = await getDocs(query(
            collection(db, 'estateDocs'),
            where('sharedWith', 'array-contains-any', [user.email, '__all__']),
          ))
          sharedDocs = docsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => d.uid === ownerUid)
        }
        setEstateDocs(sharedDocs)
      } catch (e) {
        console.error('Failed to load shared estate docs:', e)
      }

      setLoading(false)
    }
    load()

    return () => {
      if (unsubscribeInvite) unsubscribeInvite()
    }
  }, [ownerUid, user?.email])

  const handleExpressInterest = async (asset) => {
    if (!user) return
    if (hasExpressedInterest(asset)) return
    setExpressingInterest(asset.id)
    try {
      const assetRef = doc(db, 'assets', asset.id)
      const newEntry = {
        uid: user.uid,
        name: user.displayName || user.email,
        email: user.email,
        expressedAt: new Date().toISOString(),
      }
      await updateDoc(assetRef, {
        interestedParties: arrayUnion(newEntry),
      })

      // Look up the owner so we can both email them and write an
      // in-app notification.
      const ownerSettingsQuery = query(
        collection(db, 'userSettings'),
        where('uid', '==', ownerUid),
      )
      const ownerSnap = await getDocs(ownerSettingsQuery)
      if (!ownerSnap.empty) {
        const ownerData = ownerSnap.docs[0].data()
        const ownerEmail = ownerData.email
        const ownerName  = ownerData.displayName || ownerEmail
        if (ownerEmail) {
          await addDoc(collection(db, 'mail'), {
            to: ownerEmail,
            message: {
              subject: `${user.displayName || user.email} expressed interest in ${asset.name}`,
              html: `
                <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1C1A17;">
                  <h1 style="font-size: 32px; font-weight: 400; margin-bottom: 8px;">Provenance</h1>
                  <p style="font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #9A7030; margin-bottom: 32px;">Estate Asset Registry</p>
                  <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">Hi ${ownerName},</p>
                  <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;"><strong>${user.displayName || user.email}</strong> has expressed interest in <strong>${asset.name}</strong> from your Provenance registry.</p>
                  <div style="background: #F2EFE8; border-left: 3px solid #9A7030; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
                    <p style="font-size: 14px; color: #5A5650; margin: 0;">${asset.category} · Est. value: $${Number(asset.value || 0).toLocaleString()}</p>
                  </div>
                  <hr style="border: none; border-top: 0.5px solid #D5D0C8; margin: 32px 0;" />
                  <p style="font-size: 12px; color: #A09890;">You received this because someone viewed your Provenance registry.</p>
                </div>
              `,
            },
          })
        }
      }

      // In-app notification for the Home "Recent Activity" feed.
      await addDoc(collection(db, 'notifications'), {
        ownerUid,
        type: 'interest_expressed',
        assetId: asset.id,
        assetName: asset.name,
        fromName: user.displayName || user.email,
        fromEmail: user.email,
        read: false,
        createdAt: serverTimestamp(),
      })

      // Update local state to reflect expressed interest
      setAssets(prev => prev.map(a => a.id === asset.id
        ? { ...a, interestedParties: [...(a.interestedParties || []), newEntry] }
        : a
      ))
    } catch (err) {
      console.error('Express Interest error:', err)
    } finally {
      setExpressingInterest(null)
    }
  }

  // ── Unauthenticated: render an inline sign-in gate ──
  if (!user) {
    return (
      <div className="shared-auth-gate">
        <div className="shared-auth-gate-inner">
          <Logo variant="icon" size={56} />
          <h1 className="shared-auth-gate-title">Sign in to view this registry</h1>
          <p className="shared-auth-gate-subtext">
            You've been invited to view a private estate registry. Sign in or create a free account to continue.
          </p>

          {authError && <p className="shared-auth-gate-error">{authError}</p>}

          {!showEmailForm ? (
            <div className="shared-auth-gate-actions">
              <button
                type="button"
                className="login-social-btn login-social-btn--google"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="login-divider">
                <span className="login-divider-line" />
                <span className="login-divider-label">or</span>
                <span className="login-divider-line" />
              </div>

              <button
                type="button"
                className="login-email-toggle"
                onClick={() => setShowEmailForm(true)}
                disabled={authLoading}
              >
                Use email instead
              </button>
            </div>
          ) : (
            <form
              className="login-email-form shared-auth-gate-form"
              onSubmit={authMode === 'signup' ? handleEmailSignUp : handleEmailSignIn}
            >
              {authMode === 'signup' && (
                <input
                  className="login-input"
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={e => { setName(e.target.value); setAuthError('') }}
                  required
                  autoComplete="name"
                />
              )}
              <input
                className="login-input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => { setEmail(e.target.value); setAuthError('') }}
                required
                autoComplete="email"
              />
              <input
                className="login-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => { setPassword(e.target.value); setAuthError('') }}
                required
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              />
              {authMode === 'signup' && (
                <input
                  className="login-input"
                  type="password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setAuthError('') }}
                  required
                  autoComplete="new-password"
                />
              )}
              <button className="btn-primary" type="submit" disabled={authLoading}>
                {authLoading
                  ? (authMode === 'signup' ? 'Creating account...' : 'Signing in...')
                  : (authMode === 'signup' ? 'Create Account' : 'Sign In')}
              </button>
              <div className="login-switch-row">
                {authMode === 'signin' ? (
                  <>
                    <span className="login-switch-text">No account?</span>
                    <button type="button" className="login-switch-link" onClick={() => switchAuthMode('signup')}>
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    <span className="login-switch-text">Already have an account?</span>
                    <button type="button" className="login-switch-link" onClick={() => switchAuthMode('signin')}>
                      Sign in
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                className="login-back"
                onClick={() => { setShowEmailForm(false); setAuthError('') }}
              >
                ← Other sign-in options
              </button>
            </form>
          )}

          <p className="shared-auth-gate-note">
            Only invited beneficiaries can view this registry.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="page"><p className="placeholder-text">Loading...</p></div>
  }

  if (!hasAccess) {
    // Wrong account gets its own dedicated screen so the user can pivot
    // to a different login without losing the invite URL.
    if (denyReason === 'wrong-account') {
      return (
        <div className="shared-no-access">
          <div className="shared-no-access-inner">
            <div className="shared-ornament" />
            <h1 className="shared-no-access-title">Wrong account</h1>
            <p className="shared-no-access-text">
              The email address <strong>{user.email}</strong> hasn't been invited to this registry.
            </p>
            <button className="btn-primary" onClick={handleSwitchAccount}>
              Sign in with a different account
            </button>
          </div>
        </div>
      )
    }
    const title =
      denyReason === 'revoked' ? 'Access Revoked'
      : denyReason === 'invalid' ? 'Invite Unavailable'
      : 'Access Required'
    const message =
      denyReason === 'revoked' ? 'Your access to this registry has been revoked.'
      : denyReason === 'invalid' ? 'This link is no longer valid.'
      : 'You need an invitation to view this registry. Contact the owner to request access.'
    return (
      <div className="shared-no-access">
        <div className="shared-no-access-inner">
          <div className="shared-ornament" />
          <h1 className="shared-no-access-title">{title}</h1>
          <p className="shared-no-access-text">{message}</p>
          <button className="btn-ghost" onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="shared-page">

      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img className="lightbox-img" src={lightbox} alt="Full size" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div className="shared-header">
        <div className="shared-ornament" />
        <h1 className="shared-title">
          {ownerName ? `${ownerName.split(' ')[0]}'s Registry` : 'Shared Registry'}
        </h1>
        <p className="shared-subtitle">Shared with you · View only</p>
        <div className="shared-ornament" />
      </div>

      {assets.length === 0 ? (
        <p className="placeholder-text">No assets in this registry yet.</p>
      ) : (
        <div className="shared-asset-list">
          {assets.map(asset => {
            const heroSrc = asset.imageUrl || asset.imageBase64
            const interested = hasExpressedInterest(asset)
            return (
              <div key={asset.id} className="shared-asset-card">
                <div className="shared-asset-top">
                  <img
                    className="shared-asset-photo"
                    src={heroSrc || DEFAULT_IMAGE}
                    alt={asset.name}
                    onClick={() => heroSrc && setLightbox(heroSrc)}
                    style={{ cursor: heroSrc ? 'zoom-in' : 'default' }}
                  />
                  <div className="shared-asset-info">
                    <div className="shared-asset-category">{asset.category}</div>
                    <div className="shared-asset-name">{asset.name}</div>
                    {asset.value && <div className="shared-asset-value">${asset.value}</div>}
                  </div>
                </div>

                {asset.description && (
                  <p className="shared-asset-description">{asset.description}</p>
                )}

                {(asset.additionalImages?.length > 0) && (
                  <div className="shared-photo-strip">
                    {asset.additionalImages.slice(0, 6).map((img, i) => {
                      const src = typeof img === 'string' ? img : img.url
                      return (
                        <img
                          key={i}
                          className="shared-photo-strip-img"
                          src={src}
                          alt=""
                          onClick={() => setLightbox(src)}
                        />
                      )
                    })}
                  </div>
                )}

                <div className="shared-asset-footer">
                  <button
                    className={`shared-interest-btn ${interested ? 'shared-interest-btn--done' : ''}`}
                    onClick={() => handleExpressInterest(asset)}
                    disabled={interested || expressingInterest === asset.id}
                  >
                    {expressingInterest === asset.id
                      ? 'Saving...'
                      : interested
                        ? '✓ Interest Expressed'
                        : 'Express Interest'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {estateDocs.length > 0 && (
        <div className="shared-docs-section">
          <div className="shared-docs-heading-row">
            <h2 className="shared-docs-heading">Estate Documents</h2>
            <span className="shared-docs-count">{estateDocs.length}</span>
          </div>
          <p className="shared-docs-subhead">Documents the owner has shared with you.</p>

          <div className="shared-docs-list">
            {estateDocs.map(d => (
              <div key={d.id} className="shared-doc-row">
                <div className="shared-doc-left">
                  <span className="shared-doc-icon">
                    {d.fileType?.includes('pdf') ? '📄' : d.fileType?.includes('image') ? '🖼️' : '📎'}
                  </span>
                  <div className="shared-doc-info">
                    <span className="shared-doc-title">{d.title}</span>
                    <span className="shared-doc-meta">
                      {ESTATE_CATEGORY_LABELS[d.categoryId] || 'Document'}
                      {d.docDate ? ` · ${formatDate(d.docDate)}` : ''}
                      {d.version ? ` · v${d.version}` : ''}
                    </span>
                  </div>
                </div>
                <div className="shared-doc-right">
                  {d.status && (
                    <span className={
                      d.status === 'Current' ? 'edoc-status doc-status--current'
                      : d.status === 'Superseded' ? 'edoc-status doc-status--superseded'
                      : 'edoc-status doc-status--draft'
                    }>
                      {d.status}
                    </span>
                  )}
                  <button
                    className="shared-doc-open"
                    onClick={() => window.open(d.url, '_blank', 'noopener,noreferrer')}
                  >
                    ↗ Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SharedRegistry
