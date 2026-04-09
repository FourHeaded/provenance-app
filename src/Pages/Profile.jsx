import { useState, useEffect } from 'react'
import { auth, db } from '../firebase'
import { signOut, updateProfile } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { isAdmin } from '../admin'
import {
  collection, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, doc, serverTimestamp
} from 'firebase/firestore'

const RELATIONSHIPS = ['Spouse', 'Child', 'Sibling', 'Parent', 'Attorney', 'Executor', 'Friend', 'Other']

const INVITE_URL = (ownerUid) => `https://provenance-510ad.web.app/shared/${ownerUid}`

function Profile({ user, theme, setTheme }) {
  const navigate = useNavigate()
  const [userSettings, setUserSettings] = useState(null)
  const [invites, setInvites] = useState([])
  const [loadingInvites, setLoadingInvites] = useState(true)
  const isPremium = userSettings?.isPremium || false
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', relationship: '' })
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [revokingId, setRevokingId] = useState(null)

  // Display name editing
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Fallback chain: explicit setting > auth profile > email prefix
  const effectiveDisplayName =
    userSettings?.displayName ||
    user.displayName ||
    (user.email ? user.email.split('@')[0] : 'User')

  const handleSignOut = () => signOut(auth)

  useEffect(() => {
    const load = async () => {
      const [invitesSnap, settingsSnap] = await Promise.all([
        getDocs(query(collection(db, 'invites'), where('registryOwnerUid', '==', user.uid))),
        getDocs(query(collection(db, 'userSettings'), where('uid', '==', user.uid))),
      ])
      setInvites(invitesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      if (!settingsSnap.empty) {
        const docSnap = settingsSnap.docs[0]
        setUserSettings({ id: docSnap.id, ...docSnap.data() })
      }
      setLoadingInvites(false)
    }
    load()
  }, [])

  const handleStartEditName = () => {
    setNameInput(effectiveDisplayName)
    setEditingName(true)
  }

  const handleCancelEditName = () => {
    setEditingName(false)
    setNameInput('')
  }

  const handleSaveName = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setSavingName(true)
    try {
      // Resolve the userSettings doc id (App.jsx upserts on sign-in, so it
      // should exist; re-query as a defensive fallback if it's missing).
      let settingsId = userSettings?.id
      if (!settingsId) {
        const snap = await getDocs(query(
          collection(db, 'userSettings'),
          where('uid', '==', user.uid),
        ))
        if (!snap.empty) settingsId = snap.docs[0].id
      }
      if (settingsId) {
        await updateDoc(doc(db, 'userSettings', settingsId), {
          displayName: trimmed,
        })
      }
      // Sync to Firebase Auth so other pages reading user.displayName
      // (e.g. Home greeting) pick up the new value
      await updateProfile(auth.currentUser, { displayName: trimmed })
      setUserSettings(prev => ({ ...(prev || {}), id: settingsId, displayName: trimmed }))
      setEditingName(false)
    } catch (e) {
      console.error('Failed to save display name:', e)
    } finally {
      setSavingName(false)
    }
  }

  const handleSendInvite = async (e) => {
    e.preventDefault()
    if (!inviteForm.name || !inviteForm.email || !inviteForm.relationship) return
    setSubmitting(true)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)
    const invitedEmail = inviteForm.email.toLowerCase().trim()
    const newInvite = {
      registryOwnerUid: user.uid,
      ownerName: user.displayName,
      invitedName: inviteForm.name,
      invitedEmail,
      relationship: inviteForm.relationship,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: expiresAt.toISOString(),
    }
    // Deterministic doc ID so the security rule can construct the path.
    // Format: `{registryOwnerUid}_{lowercased invitedEmail}`
    const inviteId = `${user.uid}_${invitedEmail}`
    await setDoc(doc(db, 'invites', inviteId), newInvite)
    const saved = { id: inviteId, ...newInvite, createdAt: new Date() }
    // Re-inviting the same email overwrites the existing invite, so dedupe by ID
    setInvites(prev => [saved, ...prev.filter(i => i.id !== inviteId)])
    setInviteForm({ name: '', email: '', relationship: '' })
    setShowInviteForm(false)
    setSubmitting(false)
    // Auto-copy the link
    handleCopyLink(inviteId)
  }

  const handleRevokeInvite = async (inviteId) => {
    setRevokingId(inviteId)
    await deleteDoc(doc(db, 'invites', inviteId))
    setInvites(prev => prev.filter(i => i.id !== inviteId))
    setRevokingId(null)
  }

  const handleCopyLink = (inviteId) => {
    navigator.clipboard.writeText(INVITE_URL(user.uid))
    setCopiedId(inviteId)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const statusLabel = (status) => {
    if (status === 'accepted') return 'Accepted'
    if (status === 'declined') return 'Declined'
    return 'Pending'
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
      </div>

      {/* Identity card */}
      <div className="profile-card">
        <div className="profile-avatar-wrap">
          {user.photoURL ? (
            <img className="profile-avatar" src={user.photoURL} alt={effectiveDisplayName} referrerPolicy="no-referrer" />
          ) : (
            <div className="profile-avatar-fallback">
              {effectiveDisplayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="profile-info">
          {editingName ? (
            <div className="profile-name-edit">
              <input
                className="profile-name-input"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') handleCancelEditName()
                }}
                autoFocus
              />
              <div className="profile-name-edit-actions">
                <button
                  type="button"
                  className="profile-name-action"
                  onClick={handleSaveName}
                  disabled={savingName || !nameInput.trim()}
                >
                  {savingName ? '...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="profile-name-action profile-name-action--cancel"
                  onClick={handleCancelEditName}
                  disabled={savingName}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="profile-name-row">
              <div className="profile-name">{effectiveDisplayName}</div>
              <button
                type="button"
                className="profile-name-edit-link"
                onClick={handleStartEditName}
              >
                Edit
              </button>
            </div>
          )}
          <div className="profile-email">{user.email}</div>
        </div>
      </div>

      {/* Plan */}
      <div className="profile-section">
        <div className="profile-row">
          <span className="profile-row-label">Plan</span>
          <span className={`premium-badge ${isPremium ? 'premium-badge--active' : 'premium-badge--free'}`}>
            {isPremium ? 'Premium' : 'Free'}
          </span>
        </div>
        {!isPremium && (
          <p className="profile-upgrade-hint">Upgrade to unlock reports, archive, and more.</p>
        )}
      </div>

      {/* Beneficiaries */}
      <div className="profile-section">
        <div className="beneficiary-header">
          <span className="beneficiary-header-label">Beneficiaries</span>
          {!showInviteForm && (
            <button className="vault-add-btn" onClick={() => setShowInviteForm(true)}>
              + Invite Someone
            </button>
          )}
        </div>

        {showInviteForm && (
          <form className="invite-form" onSubmit={handleSendInvite}>
            <input
              className="invite-input"
              placeholder="Full name"
              value={inviteForm.name}
              onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              className="invite-input"
              type="email"
              placeholder="Email address"
              value={inviteForm.email}
              onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              required
            />
            <select
              className="invite-select"
              value={inviteForm.relationship}
              onChange={e => setInviteForm(f => ({ ...f, relationship: e.target.value }))}
              required
            >
              <option value="">Relationship...</option>
              {RELATIONSHIPS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="invite-form-actions">
              <button type="button" className="btn-ghost" onClick={() => {
                setShowInviteForm(false)
                setInviteForm({ name: '', email: '', relationship: '' })
              }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary btn-small" disabled={submitting}>
                {submitting ? 'Saving...' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}

        {loadingInvites ? (
          <p className="invite-empty">Loading...</p>
        ) : invites.length === 0 && !showInviteForm ? (
          <p className="invite-empty">No beneficiaries invited yet. Share your registry with family, attorneys, or executors.</p>
        ) : (
          <div className="invite-list">
            {invites.map(invite => (
              <div key={invite.id} className="invite-row">
                <div className="invite-row-info">
                  <div className="invite-row-name">{invite.invitedName}</div>
                  <div className="invite-row-meta">
                    <span className="invite-relationship">{invite.relationship}</span>
                    <span className="invite-email">{invite.invitedEmail}</span>
                  </div>
                </div>
                <div className="invite-row-actions">
                  <span className={`invite-status invite-status--${invite.status}`}>
                    {statusLabel(invite.status)}
                  </span>
                  <button
                    className="invite-action-btn"
                    onClick={() => handleCopyLink(invite.id)}
                    title="Copy invite link"
                  >
                    {copiedId === invite.id ? '✓ Copied' : 'Copy link'}
                  </button>
                  <button
                    className="invite-action-btn invite-action-btn--danger"
                    onClick={() => handleRevokeInvite(invite.id)}
                    disabled={revokingId === invite.id}
                    title="Revoke access"
                  >
                    {revokingId === invite.id ? '...' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archive link */}
      <div className="profile-section">
        <button className="profile-menu-row" onClick={() => navigate('/archive')}>
          <div className="profile-menu-row-text">
            <span className="profile-menu-row-label">Archive</span>
            <span className="profile-menu-row-description">View and restore archived assets</span>
          </div>
          <span className="profile-menu-row-chevron">›</span>
        </button>
      </div>

      {/* Admin link — only visible to the operator */}
      {isAdmin(user) && (
        <div className="profile-section">
          <button className="profile-menu-row" onClick={() => navigate('/admin')}>
            <div className="profile-menu-row-text">
              <span className="profile-menu-row-label">Admin Dashboard</span>
              <span className="profile-menu-row-description">Operator tools and metrics</span>
            </div>
            <span className="profile-menu-row-chevron">›</span>
          </button>
        </div>
      )}

      {/* Appearance */}
      <div className="profile-section">
        <div className="section-label">Appearance</div>
        <div
          className="profile-row profile-row--clickable"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <span>{theme === 'dark' ? '☾ Dark mode' : '☀ Light mode'}</span>
          <span className="profile-row-value">{theme === 'dark' ? 'On' : 'Off'}</span>
        </div>
      </div>

      {/* Legal */}
      <div className="profile-section profile-legal">
        <div className="profile-legal-label">Legal</div>
        <button className="profile-legal-link" onClick={() => navigate('/terms')}>
          Terms of Service
        </button>
        <button className="profile-legal-link" onClick={() => navigate('/privacy')}>
          Privacy Policy
        </button>
      </div>

      {/* Sign out */}
      <div className="profile-section">
        <button className="btn-ghost profile-signout" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default Profile
