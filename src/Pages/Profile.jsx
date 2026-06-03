import { useState, useEffect } from 'react'
import { auth, db, storage } from '../firebase'
import { signOut, updateProfile, deleteUser } from 'firebase/auth'
import { ref as storageRef, listAll, deleteObject } from 'firebase/storage'
import { useNavigate } from 'react-router-dom'
import { isAdmin } from '../admin'
import {
  collection, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, doc, serverTimestamp
} from 'firebase/firestore'

// Recursively delete every file under a Storage prefix.
// listAll() only returns one level, so we walk subfolders ourselves.
async function deleteStoragePrefix(folderRef) {
  const result = await listAll(folderRef)
  await Promise.all(result.items.map(item => deleteObject(item).catch(() => {})))
  await Promise.all(result.prefixes.map(prefix => deleteStoragePrefix(prefix)))
}

const RELATIONSHIPS = ['Spouse', 'Child', 'Sibling', 'Parent', 'Attorney', 'Executor', 'Friend', 'Other']

const INVITE_URL = (ownerUid) => `https://provenance-510ad.web.app/shared/${ownerUid}`

function Profile({ user, theme, setTheme }) {
  const navigate = useNavigate()
  const [userSettings, setUserSettings] = useState(null)
  const [invites, setInvites] = useState([])
  const [loadingInvites, setLoadingInvites] = useState(true)
  const [allAssets, setAllAssets] = useState([])
  const [expandedInvites, setExpandedInvites] = useState({}) // inviteId -> bool
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

  // Account deletion
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  // Fallback chain: explicit setting > auth profile > email prefix
  const effectiveDisplayName =
    userSettings?.displayName ||
    user.displayName ||
    (user.email ? user.email.split('@')[0] : 'User')

  const handleSignOut = () => signOut(auth)

  useEffect(() => {
    const load = async () => {
      const [invitesSnap, settingsSnap, assetsSnap] = await Promise.all([
        getDocs(query(collection(db, 'invites'), where('registryOwnerUid', '==', user.uid))),
        getDocs(query(collection(db, 'userSettings'), where('uid', '==', user.uid))),
        getDocs(query(collection(db, 'assets'), where('uid', '==', user.uid))),
      ])
      setInvites(invitesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setAllAssets(assetsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      if (!settingsSnap.empty) {
        const docSnap = settingsSnap.docs[0]
        setUserSettings({ id: docSnap.id, ...docSnap.data() })
      }
      setLoadingInvites(false)
    }
    load()
  }, [])

  const toggleExpanded = (inviteId) => {
    setExpandedInvites(prev => ({ ...prev, [inviteId]: !prev[inviteId] }))
  }

  // Find every active asset where this beneficiary's email shows up in
  // interestedParties. Tolerates the legacy bare-string entry shape.
  const interestedAssetsFor = (beneficiaryEmail) => {
    const target = (beneficiaryEmail || '').toLowerCase()
    if (!target) return []
    return allAssets
      .filter(a => a.itemStatus !== 'archived')
      .filter(asset =>
        (asset.interestedParties || []).some(entry =>
          typeof entry === 'string'
            ? entry.toLowerCase() === target
            : (entry?.email || '').toLowerCase() === target
        )
      )
  }

  const findInterestEntry = (asset, beneficiaryEmail) => {
    const target = (beneficiaryEmail || '').toLowerCase()
    return (asset.interestedParties || []).find(entry =>
      typeof entry === 'string'
        ? entry.toLowerCase() === target
        : (entry?.email || '').toLowerCase() === target
    )
  }

  const formatAcceptedAt = (ts) => {
    if (!ts) return ''
    const d = typeof ts.toDate === 'function' ? ts.toDate()
            : typeof ts.seconds === 'number' ? new Date(ts.seconds * 1000)
            : new Date(ts)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

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

    // Best-effort beneficiary invite email via the Firebase Trigger Email
    // extension (listens to the `mail` collection). Failures are swallowed so
    // a mail-write hiccup never blocks the invite itself.
    try {
      await addDoc(collection(db, 'mail'), {
        to: invitedEmail,
        message: {
          subject: `${user.displayName || 'Someone'} has shared their Provenance registry with you`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1C1A17;">
              <h1 style="font-size: 32px; font-weight: 400; margin-bottom: 8px;">Provenance</h1>
              <p style="font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #9A7030; margin-bottom: 32px;">Estate Asset Registry</p>
              <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">Hi ${inviteForm.name},</p>
              <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">${user.displayName || 'Someone'} has invited you to view their estate asset registry on Provenance. As a beneficiary, you can browse their cataloged items, view estate documents they've chosen to share, and express interest in items that are meaningful to you.</p>
              <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">Click below to accept the invitation and view their registry.</p>
              <div style="margin: 24px 0 12px 0;">
                <a href="https://provenance-510ad.web.app/shared/${user.uid}" style="background: #9A7030; color: #F2EFE8; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 14px; letter-spacing: 1px;">Accept Invitation</a>
              </div>
              <p style="font-size: 12px; color: #A09890; line-height: 1.6; margin-bottom: 24px;">You'll need a free Provenance account to view the registry. Creating one takes less than a minute.</p>
              <p style="font-size: 13px; color: #5A5650; line-height: 1.7;">Provenance helps families catalog what matters, preserve the stories behind it, and make sure the people they love know what they have — and what it means.</p>
              <hr style="border: none; border-top: 0.5px solid #D5D0C8; margin: 32px 0;" />
              <p style="font-size: 12px; color: #A09890;">You received this email because ${user.displayName || 'someone'} invited you to their Provenance registry. If you have questions, reply to this email.</p>
            </div>
          `,
        },
      })
    } catch (err) {
      console.error('Invite email queue failed:', err)
    }

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
    try {
      // Mark the invite as revoked rather than deleting it — keeps a
      // historical record on the owner's side and lets SharedRegistry's
      // onSnapshot kick the beneficiary out in real time.
      await updateDoc(doc(db, 'invites', inviteId), {
        status: 'revoked',
        revokedAt: serverTimestamp(),
      })

      // Strip this beneficiary's entries from every asset's
      // interestedParties array so a revoked party doesn't keep showing
      // up in the owner's "interested in" lists. Best-effort: a failure
      // here shouldn't undo the revoke itself.
      const revokedInvite = invites.find(i => i.id === inviteId)
      const targetEmail = (revokedInvite?.invitedEmail || '').toLowerCase()
      if (targetEmail) {
        try {
          const assetsSnap = await getDocs(query(
            collection(db, 'assets'),
            where('uid', '==', user.uid),
          ))
          await Promise.all(assetsSnap.docs.map(async (assetDoc) => {
            const asset = assetDoc.data()
            if (!asset.interestedParties?.length) return
            const filtered = asset.interestedParties.filter(entry =>
              typeof entry === 'string'
                ? entry.toLowerCase() !== targetEmail
                : (entry?.email || '').toLowerCase() !== targetEmail
            )
            if (filtered.length !== asset.interestedParties.length) {
              await updateDoc(assetDoc.ref, { interestedParties: filtered })
            }
          }))
          // Mirror the cleanup in local allAssets so the expanded
          // panel updates without a reload.
          setAllAssets(prev => prev.map(a => {
            if (!a.interestedParties?.length) return a
            const filtered = a.interestedParties.filter(entry =>
              typeof entry === 'string'
                ? entry.toLowerCase() !== targetEmail
                : (entry?.email || '').toLowerCase() !== targetEmail
            )
            return filtered.length === a.interestedParties.length
              ? a
              : { ...a, interestedParties: filtered }
          }))
        } catch (err) {
          console.error('Interest cleanup on revoke failed:', err)
        }
      }

      setInvites(prev => prev.map(i => i.id === inviteId
        ? { ...i, status: 'revoked' }
        : i
      ))
    } catch (err) {
      console.error('Revoke failed:', err)
    } finally {
      setRevokingId(null)
    }
  }

  const handleReinstateInvite = async (invite) => {
    setRevokingId(invite.id)
    try {
      const inviteRef = doc(db, 'invites', invite.id)
      await updateDoc(inviteRef, {
        status: 'accepted',
        revokedAt: null,
        reinstatedAt: serverTimestamp(),
      })

      // Best-effort notification email — failures don't undo the reinstate.
      try {
        await addDoc(collection(db, 'mail'), {
          to: invite.invitedEmail,
          message: {
            subject: `Your access to ${user.displayName || 'a'} Provenance registry has been restored`,
            html: `
              <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1C1A17;">
                <h1 style="font-size: 32px; font-weight: 400; margin-bottom: 8px;">Provenance</h1>
                <p style="font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #9A7030; margin-bottom: 32px;">Estate Asset Registry</p>
                <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">Hi ${invite.invitedName},</p>
                <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">${user.displayName || 'Someone'} has restored your access to their Provenance registry.</p>
                <div style="margin: 32px 0;">
                  <a href="https://provenance-510ad.web.app/shared/${user.uid}" style="background: #9A7030; color: #F2EFE8; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 14px; letter-spacing: 1px;">View Registry</a>
                </div>
                <hr style="border: none; border-top: 0.5px solid #D5D0C8; margin: 32px 0;" />
                <p style="font-size: 12px; color: #A09890;">You received this because your registry access was restored by the owner.</p>
              </div>
            `,
          },
        })
      } catch (err) {
        console.error('Reinstate email queue failed:', err)
      }

      setInvites(prev => prev.map(i => i.id === invite.id
        ? { ...i, status: 'accepted', revokedAt: null }
        : i
      ))
    } catch (err) {
      console.error('Reinstate failed:', err)
    } finally {
      setRevokingId(null)
    }
  }

  const handleDeleteInvite = async (invite) => {
    if (!window.confirm(`Remove ${invite.invitedName} from your beneficiaries permanently?`)) return
    setRevokingId(invite.id)
    try {
      await deleteDoc(doc(db, 'invites', invite.id))
      setInvites(prev => prev.filter(i => i.id !== invite.id))
    } catch (err) {
      console.error('Delete invite failed:', err)
    } finally {
      setRevokingId(null)
    }
  }

  const handleCopyLink = (inviteId) => {
    navigator.clipboard.writeText(INVITE_URL(user.uid))
    setCopiedId(inviteId)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // Permanently delete the signed-in user's account and every piece of
  // data they own. Sequence intentionally tears down Firestore + Storage
  // before deleting the auth account, so a mid-failure leaves the user
  // signed-in and able to retry rather than orphaned.
  const handleDeleteAccount = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      // 1. assets
      const assetsSnap = await getDocs(query(
        collection(db, 'assets'),
        where('uid', '==', user.uid),
      ))
      await Promise.all(assetsSnap.docs.map(d => deleteDoc(doc(db, 'assets', d.id))))

      // 2. userSettings
      const settingsSnap = await getDocs(query(
        collection(db, 'userSettings'),
        where('uid', '==', user.uid),
      ))
      await Promise.all(settingsSnap.docs.map(d => deleteDoc(doc(db, 'userSettings', d.id))))

      // 3. invites
      const invitesSnap = await getDocs(query(
        collection(db, 'invites'),
        where('registryOwnerUid', '==', user.uid),
      ))
      await Promise.all(invitesSnap.docs.map(d => deleteDoc(doc(db, 'invites', d.id))))

      // 4. estateDocs
      const estateSnap = await getDocs(query(
        collection(db, 'estateDocs'),
        where('uid', '==', user.uid),
      ))
      await Promise.all(estateSnap.docs.map(d => deleteDoc(doc(db, 'estateDocs', d.id))))

      // 4a. invites where THIS user was the beneficiary (incoming),
      // so they don't linger after the account is gone.
      const deletedUserEmail = (user.email || '').toLowerCase()
      if (deletedUserEmail) {
        try {
          const beneficiaryInvitesSnap = await getDocs(query(
            collection(db, 'invites'),
            where('invitedEmail', '==', deletedUserEmail),
          ))
          await Promise.all(beneficiaryInvitesSnap.docs.map(d => deleteDoc(d.ref)))
        } catch (err) {
          console.error('Beneficiary invite cleanup failed:', err)
        }
      }

      // 4b. notifications where THIS user was the actor. Self-delete may
      // hit permission-denied (rules let only the recipient/admin touch
      // these); best-effort, swallow so it doesn't block account removal.
      if (user.email) {
        try {
          const notificationsSnap = await getDocs(query(
            collection(db, 'notifications'),
            where('fromEmail', '==', user.email),
          ))
          await Promise.all(notificationsSnap.docs.map(d => deleteDoc(d.ref)))
        } catch (err) {
          console.error('Actor-notification cleanup failed:', err)
        }
      }

      // 5. storage files under users/{uid}/
      await deleteStoragePrefix(storageRef(storage, `users/${user.uid}`))

      // 6. Firebase Auth account
      await deleteUser(auth.currentUser)

      // 7. Auth gate in App.jsx will now flip to LoginScreen on its own;
      // navigating home is just a clean fallback.
      navigate('/')
    } catch (err) {
      console.error('Account deletion failed:', err)
      if (err.code === 'auth/requires-recent-login') {
        setDeleteError('For security, please sign out and sign back in before deleting your account.')
      } else {
        setDeleteError('Something went wrong while deleting your account. Please try again.')
      }
      setDeleting(false)
    }
  }

  const statusLabel = (status) => {
    if (status === 'accepted') return 'Accepted'
    if (status === 'declined') return 'Declined'
    if (status === 'revoked')  return 'Revoked'
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
            {invites.map(invite => {
              const isOpen = !!expandedInvites[invite.id]
              const interestedAssets = isOpen ? interestedAssetsFor(invite.invitedEmail) : []
              return (
                <div key={invite.id} className="invite-row-wrap">
                  <div
                    className="invite-row invite-row--clickable"
                    onClick={() => toggleExpanded(invite.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleExpanded(invite.id)
                      }
                    }}
                  >
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
                        onClick={e => { e.stopPropagation(); handleCopyLink(invite.id) }}
                        title="Copy invite link"
                      >
                        {copiedId === invite.id ? '✓ Copied' : 'Copy link'}
                      </button>
                      {invite.status === 'revoked' ? (
                        <>
                          <button
                            className="btn-ghost btn-small"
                            onClick={e => { e.stopPropagation(); handleReinstateInvite(invite) }}
                            disabled={revokingId === invite.id}
                            title="Restore access"
                          >
                            {revokingId === invite.id ? '...' : 'Reinstate'}
                          </button>
                          <button
                            className="invite-delete-link"
                            onClick={e => { e.stopPropagation(); handleDeleteInvite(invite) }}
                            disabled={revokingId === invite.id}
                            title="Delete permanently"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <button
                          className="invite-action-btn invite-action-btn--danger"
                          onClick={e => { e.stopPropagation(); handleRevokeInvite(invite.id) }}
                          disabled={revokingId === invite.id}
                          title="Revoke access"
                        >
                          {revokingId === invite.id ? '...' : 'Revoke'}
                        </button>
                      )}
                      <span className={`invite-chevron ${isOpen ? 'invite-chevron--open' : ''}`} aria-hidden="true">›</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="invite-expanded">
                      <div className="invite-expanded-status-row">
                        <span className={`invite-status invite-status--${invite.status}`}>
                          {statusLabel(invite.status)}
                        </span>
                        {invite.status === 'accepted' && invite.acceptedAt && (
                          <span className="invite-expanded-accepted-date">
                            on {formatAcceptedAt(invite.acceptedAt)}
                          </span>
                        )}
                      </div>

                      <div className="invite-expanded-section-label">Expressed Interest In</div>
                      {interestedAssets.length === 0 ? (
                        <p className="invite-interested-empty">No items yet</p>
                      ) : (
                        <div className="invite-interested-list">
                          {interestedAssets.map(asset => {
                            const entry = findInterestEntry(asset, invite.invitedEmail)
                            const note = typeof entry === 'object' ? entry?.note : ''
                            return (
                              <button
                                key={asset.id}
                                type="button"
                                className="invite-interested-row"
                                onClick={e => { e.stopPropagation(); navigate(`/asset/${asset.id}`) }}
                              >
                                <div className="invite-interested-text">
                                  <div className="invite-interested-name">{asset.name}</div>
                                  <div className="invite-interested-meta">{asset.category}</div>
                                  {note && (
                                    <div className="invite-interested-note">"{note}"</div>
                                  )}
                                </div>
                                <span className="invite-interested-arrow">→</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
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

      {/* Delete account */}
      <div className="profile-section">
        {confirmingDelete ? (
          <div className="delete-confirm-panel">
            <p className="delete-confirm-panel-text">
              This will permanently delete your account and all associated data.
              This cannot be undone.
            </p>
            {deleteError && (
              <p className="delete-confirm-panel-error">{deleteError}</p>
            )}
            <div className="delete-confirm-panel-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setConfirmingDelete(false)
                  setDeleteError(null)
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete My Account'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="delete-account-link"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete Account
          </button>
        )}
      </div>
    </div>
  )
}

export default Profile
