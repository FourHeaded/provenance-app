import { useState, useEffect, useRef } from 'react'
import { db, storage } from '../firebase'
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

const CATEGORIES = [
  { id: 'will',           label: 'Will & Testament',                   guidance: 'A legal document that expresses your wishes for the distribution of your assets after death. Without one, your estate is distributed according to state law.' },
  { id: 'poa-financial',  label: 'Power of Attorney (Financial)',      guidance: 'Authorizes a trusted person to manage your financial affairs if you become unable to. Covers bank accounts, investments, real estate, and taxes.' },
  { id: 'poa-healthcare', label: 'Power of Attorney (Healthcare)',     guidance: 'Designates someone to make medical decisions on your behalf if you are incapacitated. Sometimes called a Healthcare Proxy.' },
  { id: 'living-will',    label: 'Living Will / Advance Directive',    guidance: 'Documents your wishes for end-of-life medical care, including life support and resuscitation preferences.' },
  { id: 'trust',          label: 'Trust Documents',                    guidance: 'Legal arrangements for holding assets on behalf of beneficiaries. Trusts can avoid probate, reduce taxes, and provide greater control over inheritance.' },
  { id: 'beneficiary',    label: 'Beneficiary Designations',           guidance: 'Designations for life insurance, retirement accounts (IRA, 401k), and other accounts. These override your will, so they must be kept current.' },
  { id: 'insurance',      label: 'Insurance Policies',                 guidance: 'Life, health, long-term care, and umbrella policies. Keep declarations pages and contact info here.' },
  { id: 'property',       label: 'Property Deeds & Titles',            guidance: 'Deeds for real estate, vehicle titles, and other titled property. Critical for proving ownership during estate settlement.' },
  { id: 'tax',            label: 'Tax Documents',                      guidance: 'Recent tax returns, gift tax filings, and estate-related tax records. Executors typically need the last 3–7 years of returns.' },
  { id: 'other',          label: 'Other Legal Documents',              guidance: 'Marriage certificates, divorce decrees, military records, birth certificates, passports, and any other documents relevant to your estate.' },
]

const STATUS_OPTIONS = ['Current', 'Draft', 'Superseded']
const STATUS_CLASS = {
  Current:    'doc-status--current',
  Draft:      'doc-status--draft',
  Superseded: 'doc-status--superseded',
}

const SHARE_ALL_TOKEN = '__all__'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isReviewDue(lastReviewed) {
  if (!lastReviewed) return false
  const msPerYear = 365 * 24 * 60 * 60 * 1000
  return Date.now() - new Date(lastReviewed).getTime() > msPerYear
}

function shareSummary(sharedWith) {
  if (!sharedWith || sharedWith.length === 0) return 'Private'
  if (sharedWith.includes(SHARE_ALL_TOKEN)) return 'Everyone'
  return `${sharedWith.length} ${sharedWith.length === 1 ? 'person' : 'people'}`
}

// ── Reusable Share Settings panel ────────────────────────────────────────────
function ShareSettings({ initialSharedWith, invites, onSave, onCancel, saving }) {
  const isEveryone = initialSharedWith?.includes(SHARE_ALL_TOKEN)
  const [mode, setMode] = useState(isEveryone ? 'everyone' : 'specific')
  const [selected, setSelected] = useState(
    initialSharedWith?.filter(e => e !== SHARE_ALL_TOKEN) || []
  )

  const toggleEmail = (email) => {
    setSelected(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  const handleSave = () => {
    if (mode === 'everyone') onSave([SHARE_ALL_TOKEN])
    else onSave(selected)
  }

  return (
    <div className="edoc-share-settings">
      <div className="edoc-share-mode">
        <label className="edoc-share-radio">
          <input
            type="radio"
            checked={mode === 'everyone'}
            onChange={() => setMode('everyone')}
          />
          <div>
            <div className="edoc-share-radio-label">Everyone with access</div>
            <div className="edoc-share-radio-desc">Visible to all current and future beneficiaries</div>
          </div>
        </label>
        <label className="edoc-share-radio">
          <input
            type="radio"
            checked={mode === 'specific'}
            onChange={() => setMode('specific')}
          />
          <div>
            <div className="edoc-share-radio-label">Specific beneficiaries</div>
            <div className="edoc-share-radio-desc">Choose individuals below</div>
          </div>
        </label>
        <label className="edoc-share-radio">
          <input
            type="radio"
            checked={mode === 'specific' && selected.length === 0}
            onChange={() => { setMode('specific'); setSelected([]) }}
          />
          <div>
            <div className="edoc-share-radio-label">Private (no one)</div>
            <div className="edoc-share-radio-desc">Only you can see this document</div>
          </div>
        </label>
      </div>

      {mode === 'specific' && invites.length > 0 && (
        <div className="edoc-share-specific">
          <div className="edoc-share-bulk-actions">
            <button type="button" className="edoc-share-bulk-link" onClick={() => setSelected(invites.map(i => i.invitedEmail))}>
              Select all
            </button>
            <button type="button" className="edoc-share-bulk-link" onClick={() => setSelected([])}>
              Clear
            </button>
          </div>
          <div className="edoc-share-list">
            {invites.map(inv => (
              <label key={inv.invitedEmail} className="edoc-share-row">
                <input
                  type="checkbox"
                  checked={selected.includes(inv.invitedEmail)}
                  onChange={() => toggleEmail(inv.invitedEmail)}
                />
                <span className="edoc-share-name">{inv.invitedName}</span>
                <span className="edoc-share-email">{inv.invitedEmail}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {mode === 'specific' && invites.length === 0 && (
        <p className="edoc-share-empty">No beneficiaries invited yet. Add them in Profile.</p>
      )}

      <div className="edoc-share-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn-primary btn-small" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Sharing'}
        </button>
      </div>
    </div>
  )
}

// ── Upload form ──────────────────────────────────────────────────────────────
function UploadForm({ categoryId, uid, onSave, onCancel }) {
  const [title, setTitle]       = useState('')
  const [notes, setNotes]       = useState('')
  const [status, setStatus]     = useState('Current')
  const [docDate, setDocDate]   = useState('')
  const [attorney, setAttorney] = useState('')
  const [version, setVersion]   = useState('1')
  const [file, setFile]         = useState(null)
  const [saving, setSaving]     = useState(false)
  const fileRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return
    setSaving(true)

    const filename = `${Date.now()}-${file.name}`
    const storagePath = `users/${uid}/estate-docs/${categoryId}/${filename}`
    const storageRef = ref(storage, storagePath)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)

    const record = {
      uid,
      categoryId,
      title:        title.trim() || file.name,
      notes:        notes.trim(),
      status,
      docDate:      docDate || null,
      attorney:     attorney.trim(),
      version:      version.trim() || '1',
      filename:     file.name,
      fileType:     file.type,
      storagePath,
      url,
      sharedWith:   [],
      uploadedAt:   new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
    }

    const docRef = await addDoc(collection(db, 'estateDocs'), record)
    onSave({ id: docRef.id, ...record })
    setSaving(false)
  }

  return (
    <form className="edoc-upload-form" onSubmit={handleSubmit}>
      <div className="edoc-upload-file-row">
        <button type="button" className="edoc-file-btn" onClick={() => fileRef.current.click()}>
          {file ? '📄 ' + file.name : '+ Choose file'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,image/*,application/pdf"
          onChange={e => setFile(e.target.files[0] || null)}
          style={{ display: 'none' }}
          required
        />
      </div>

      <input
        className="edoc-input"
        placeholder={`Title (e.g. "Primary Will — 2024")`}
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      <div className="edoc-row-2">
        <select className="edoc-select" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          className="edoc-input"
          type="text"
          placeholder="Version (e.g. 2.0)"
          value={version}
          onChange={e => setVersion(e.target.value)}
        />
      </div>

      <input
        className="edoc-input"
        type="date"
        value={docDate}
        onChange={e => setDocDate(e.target.value)}
        title="Date on the document (not upload date)"
      />

      <input
        className="edoc-input"
        placeholder="Attorney / preparer (optional)"
        value={attorney}
        onChange={e => setAttorney(e.target.value)}
      />

      <textarea
        className="edoc-textarea"
        placeholder="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
      />

      {!file && <p className="edoc-file-hint">Select a file to upload.</p>}

      <div className="edoc-form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary btn-small" disabled={saving || !file}>
          {saving ? 'Uploading...' : 'Save Document'}
        </button>
      </div>
    </form>
  )
}

// ── Document row ─────────────────────────────────────────────────────────────
function DocumentRow({ edoc, invites, onUpdate, onDelete, selectMode, isSelected, onToggleSelect }) {
  const [expanded, setExpanded]   = useState(false)
  const [sharing, setSharing]     = useState(false)
  const [shareSaving, setShareSaving] = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [editStatus, setEditStatus] = useState(edoc.status)
  const due = isReviewDue(edoc.lastReviewed)

  const handleOpen = () => window.open(edoc.url, '_blank', 'noopener,noreferrer')

  const handleStatusChange = async (newStatus) => {
    setEditStatus(newStatus)
    await updateDoc(doc(db, 'estateDocs', edoc.id), { status: newStatus })
    onUpdate({ ...edoc, status: newStatus })
  }

  const handleMarkReviewed = async () => {
    const now = new Date().toISOString()
    await updateDoc(doc(db, 'estateDocs', edoc.id), { lastReviewed: now })
    onUpdate({ ...edoc, lastReviewed: now })
  }

  const handleSaveSharing = async (newSharedWith) => {
    setShareSaving(true)
    await updateDoc(doc(db, 'estateDocs', edoc.id), { sharedWith: newSharedWith })
    onUpdate({ ...edoc, sharedWith: newSharedWith })
    setShareSaving(false)
    setSharing(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await deleteObject(ref(storage, edoc.storagePath)) } catch {}
    await deleteDoc(doc(db, 'estateDocs', edoc.id))
    onDelete(edoc.id)
  }

  const rowClick = () => {
    if (selectMode) onToggleSelect(edoc.id)
    else setExpanded(v => !v)
  }

  return (
    <div className={`edoc-row ${expanded ? 'edoc-row--expanded' : ''} ${selectMode && isSelected ? 'edoc-row--selected' : ''}`}>
      <div className="edoc-row-main" onClick={rowClick}>
        {selectMode && (
          <input
            type="checkbox"
            className="edoc-row-checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(edoc.id)}
            onClick={e => e.stopPropagation()}
          />
        )}
        <div className="edoc-row-left">
          <span className="edoc-file-icon">{edoc.fileType?.includes('pdf') ? '📄' : edoc.fileType?.includes('image') ? '🖼️' : '📎'}</span>
          <div className="edoc-row-info">
            <span className="edoc-title">{edoc.title}</span>
            <span className="edoc-meta">
              {edoc.docDate ? formatDate(edoc.docDate) : 'No date'}{edoc.version ? ` · v${edoc.version}` : ''}{edoc.attorney ? ` · ${edoc.attorney}` : ''}
            </span>
          </div>
        </div>
        <div className="edoc-row-right">
          {due && <span className="edoc-review-flag" title="Annual review due">⚑</span>}
          <span className="edoc-share-summary" title={`Shared with: ${shareSummary(edoc.sharedWith)}`}>
            {shareSummary(edoc.sharedWith)}
          </span>
          <span className={`edoc-status ${STATUS_CLASS[editStatus]}`}>{editStatus}</span>
          {!selectMode && <span className="edoc-chevron">{expanded ? '∧' : '∨'}</span>}
        </div>
      </div>

      {expanded && !selectMode && (
        <div className="edoc-detail">
          {edoc.notes && <p className="edoc-notes">{edoc.notes}</p>}

          <div className="edoc-detail-meta">
            <span>Uploaded {formatDate(edoc.uploadedAt)}</span>
            <span>·</span>
            <span>Last reviewed {formatDate(edoc.lastReviewed)}{due ? ' — review due' : ''}</span>
          </div>

          <div className="edoc-detail-actions">
            <button className="edoc-action-btn" onClick={handleOpen}>↗ Open</button>
            <button className="edoc-action-btn" onClick={handleMarkReviewed}>✓ Mark reviewed</button>

            <select
              className="edoc-status-select"
              value={editStatus}
              onChange={e => handleStatusChange(e.target.value)}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button className="edoc-action-btn" onClick={() => setSharing(v => !v)}>
              {sharing ? 'Close sharing' : '⇀ Sharing'}
            </button>

            {!confirmDel ? (
              <button className="edoc-action-btn edoc-action-btn--danger" onClick={() => setConfirmDel(true)}>Delete</button>
            ) : (
              <>
                <button className="edoc-action-btn" onClick={() => setConfirmDel(false)}>Cancel</button>
                <button className="edoc-action-btn edoc-action-btn--danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Confirm delete'}
                </button>
              </>
            )}
          </div>

          {sharing && (
            <ShareSettings
              initialSharedWith={edoc.sharedWith || []}
              invites={invites}
              onSave={handleSaveSharing}
              onCancel={() => setSharing(false)}
              saving={shareSaving}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Category section ─────────────────────────────────────────────────────────
function CategorySection({ category, docs, uid, invites, selectMode, selectedIds, onToggleSelect, onDocSaved, onDocUpdated, onDocDeleted }) {
  const [open, setOpen]             = useState(docs.length > 0)
  const [showUpload, setShowUpload] = useState(false)

  const handleSave = (record) => {
    onDocSaved(record)
    setShowUpload(false)
  }

  return (
    <div className="edoc-category">
      <button type="button" className="edoc-category-header" onClick={() => setOpen(v => !v)}>
        <div className="edoc-category-left">
          <span className="edoc-category-label">{category.label}</span>
          {docs.length > 0 && <span className="edoc-category-count">{docs.length}</span>}
        </div>
        <span className="edoc-category-chevron">{open ? '∧' : '∨'}</span>
      </button>

      {open && (
        <div className="edoc-category-body">
          {docs.length === 0 && !showUpload && (
            <div className="edoc-empty">
              <p className="edoc-empty-guidance">{category.guidance}</p>
            </div>
          )}

          {docs.map(d => (
            <DocumentRow
              key={d.id}
              edoc={d}
              invites={invites}
              onUpdate={onDocUpdated}
              onDelete={onDocDeleted}
              selectMode={selectMode}
              isSelected={selectedIds.has(d.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}

          {!selectMode && (
            showUpload ? (
              <UploadForm
                categoryId={category.id}
                uid={uid}
                onSave={handleSave}
                onCancel={() => setShowUpload(false)}
              />
            ) : (
              <button className="edoc-upload-btn" onClick={() => setShowUpload(true)}>
                + Upload {category.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
function Documents({ user }) {
  const [docs, setDocs]                   = useState([])
  const [invites, setInvites]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [selectMode, setSelectMode]       = useState(false)
  const [selectedIds, setSelectedIds]     = useState(new Set())
  const [bulkSharing, setBulkSharing]     = useState(false)
  const [bulkSaving, setBulkSaving]       = useState(false)

  useEffect(() => {
    const load = async () => {
      const [docsSnap, invitesSnap] = await Promise.all([
        getDocs(query(collection(db, 'estateDocs'), where('uid', '==', user.uid))),
        getDocs(query(collection(db, 'invites'),    where('registryOwnerUid', '==', user.uid))),
      ])
      setDocs(docsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setInvites(invitesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    load()
  }, [])

  const reviewDueCount = docs.filter(d => isReviewDue(d.lastReviewed) && d.status === 'Current').length

  const docsForCategory = (catId) => docs.filter(d => d.categoryId === catId)

  const handleDocSaved   = (record)  => setDocs(prev => [record, ...prev])
  const handleDocUpdated = (updated) => setDocs(prev => prev.map(d => d.id === updated.id ? updated : d))
  const handleDocDeleted = (id)      => setDocs(prev => prev.filter(d => d.id !== id))

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setBulkSharing(false)
  }

  const selectAllVisible = () => {
    setSelectedIds(new Set(docs.map(d => d.id)))
  }

  const handleBulkSave = async (newSharedWith) => {
    setBulkSaving(true)
    await Promise.all(
      Array.from(selectedIds).map(id =>
        updateDoc(doc(db, 'estateDocs', id), { sharedWith: newSharedWith })
      )
    )
    setDocs(prev => prev.map(d =>
      selectedIds.has(d.id) ? { ...d, sharedWith: newSharedWith } : d
    ))
    setBulkSaving(false)
    exitSelectMode()
  }

  if (loading) return <div className="page"><p className="placeholder-text">Loading...</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Documents</h1>
        <p className="page-subtitle">Estate Planning Document Center</p>
      </div>

      {reviewDueCount > 0 && !selectMode && (
        <div className="edoc-review-banner">
          <span className="edoc-review-banner-icon">⚑</span>
          <span>
            {reviewDueCount} document{reviewDueCount > 1 ? 's' : ''} due for annual review
          </span>
        </div>
      )}

      {/* Bulk sharing toolbar */}
      {!selectMode ? (
        docs.length > 0 && (
          <div className="edoc-toolbar">
            <button className="edoc-toolbar-btn" onClick={() => setSelectMode(true)}>
              ⇀ Bulk sharing
            </button>
          </div>
        )
      ) : (
        <div className="edoc-bulk-bar">
          <div className="edoc-bulk-bar-info">
            <span className="edoc-bulk-count">{selectedIds.size} selected</span>
            <button className="edoc-share-bulk-link" onClick={selectAllVisible}>Select all</button>
            <button className="edoc-share-bulk-link" onClick={() => setSelectedIds(new Set())}>Clear</button>
          </div>
          <div className="edoc-bulk-bar-actions">
            <button
              className="btn-primary btn-small"
              onClick={() => setBulkSharing(true)}
              disabled={selectedIds.size === 0}
            >
              Share Selected
            </button>
            <button className="btn-ghost" onClick={exitSelectMode}>Done</button>
          </div>

          {bulkSharing && (
            <div className="edoc-bulk-share-panel">
              <p className="edoc-bulk-share-heading">
                Apply sharing settings to {selectedIds.size} selected document{selectedIds.size > 1 ? 's' : ''}
              </p>
              <ShareSettings
                initialSharedWith={[]}
                invites={invites}
                onSave={handleBulkSave}
                onCancel={() => setBulkSharing(false)}
                saving={bulkSaving}
              />
            </div>
          )}
        </div>
      )}

      <div className="edoc-list">
        {CATEGORIES.map(cat => (
          <CategorySection
            key={cat.id}
            category={cat}
            docs={docsForCategory(cat.id)}
            uid={user.uid}
            invites={invites}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onDocSaved={handleDocSaved}
            onDocUpdated={handleDocUpdated}
            onDocDeleted={handleDocDeleted}
          />
        ))}
      </div>
    </div>
  )
}

export default Documents
