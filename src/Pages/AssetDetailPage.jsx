import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { db, storage } from '../firebase'
import { collection, doc, getDocs, query, updateDoc, where, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import ProvenanceNotes from '../ProvenanceNotes'
import PhotoUploadButtons from '../components/PhotoUploadButtons'

// ── Constants for the new field groups ──
const CONDITION_OPTIONS    = ['Excellent', 'Good', 'Fair', 'Poor', 'Unknown']
const ACQUISITION_OPTIONS  = ['Purchased', 'Inherited', 'Gifted', 'Commissioned', 'Other']

function formatLongDate(iso) {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatMoney(v) {
  if (v === '' || v == null) return ''
  const n = parseFloat(v)
  if (isNaN(n)) return ''
  return `$${n.toLocaleString('en-US')}`
}

function priceLabel(acquisitionType) {
  return acquisitionType === 'Inherited' || acquisitionType === 'Gifted'
    ? 'Appraised at acquisition'
    : 'Purchase price'
}

function summarize(parts) {
  return parts.filter(Boolean).join(' · ')
}

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231A1A1A'/%3E%3Crect x='60' y='60' width='80' height='60' rx='4' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Ccircle cx='85' cy='82' r='8' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Cpolyline points='60,120 85,95 105,112 125,88 140,120' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3C/svg%3E"

function docIcon(type) {
  if (!type) return '📎'
  if (type.includes('pdf')) return '📄'
  if (type.includes('image')) return '🖼️'
  if (type.includes('word') || type.includes('doc')) return '📝'
  return '📎'
}

function openBase64(base64, type) {
  const byteStr = atob(base64.split(',')[1])
  const ab = new ArrayBuffer(byteStr.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i)
  const blob = new Blob([ab], { type })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

function openDocument(document) {
  if (document.url) {
    window.open(document.url, '_blank', 'noopener,noreferrer')
  } else if (document.base64) {
    openBase64(document.base64, document.type)
  }
}

function photoSrc(item) {
  return typeof item === 'string' ? item : item.url
}

async function uploadToStorage(storagePath, file) {
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

async function deleteFromStorage(storagePath) {
  try {
    await deleteObject(ref(storage, storagePath))
  } catch {
    // File may not exist (e.g. legacy base64 assets) — ignore
  }
}

// ── Reusable accordion section ───────────────────────────────────
function SectionAccordion({ label, summary, expanded, editable, editing, onToggle, children }) {
  const editingHighlight = editable && editing
  return (
    <div className={`detail-section ${expanded ? 'detail-section--open' : ''}`}>
      <button
        type="button"
        className={`detail-section-toggle ${editingHighlight ? 'detail-section-toggle--editing' : ''}`}
        onClick={onToggle}
      >
        <h2 className="section-label">{label}</h2>
        <span className="detail-section-summary">{summary}</span>
        <span className="detail-section-chevron">{expanded ? '∧' : '∨'}</span>
      </button>
      {expanded && <div className="detail-section-body">{children}</div>}
    </div>
  )
}

function emptyState(text) {
  return <span className="detail-section-empty">{text}</span>
}

// ── Page ─────────────────────────────────────────────────────────
function AssetDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const [asset, setAsset]                 = useState(location.state?.asset || null)
  const [editing, setEditing]             = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [saving, setSaving]               = useState(false)
  const [lightbox, setLightbox]           = useState(null)  // { src, index, isHero } | null
  const [addingPhoto, setAddingPhoto]     = useState(false)
  const [addingDoc, setAddingDoc]         = useState(false)
  const [invites, setInvites]             = useState([])

  // Default-expand sections that already have content
  const [openSections, setOpenSections] = useState(() => {
    const a = location.state?.asset
    const hasNotes = !!(a?.notes?.origin || a?.notes?.history || a?.notes?.meaning || a?.notes?.legacy)
    return {
      description: !!a?.description,
      details:     false,
      ownership:   false,
      insurance:   false,
      provenance:  hasNotes,
      beneficiary: false,
      photos:      false,
      documents:   false,
    }
  })

  const docInputRef = useRef(null)

  const [form, setForm] = useState({
    name: asset?.name || '',
    category: asset?.category || '',
    description: asset?.description || '',
    value: asset?.value || '',
    details: {
      condition: asset?.details?.condition || '',
      location:  asset?.details?.location  || '',
    },
    ownership: {
      acquisitionType: asset?.ownership?.acquisitionType || '',
      acquiredFrom:    asset?.ownership?.acquiredFrom    || '',
      acquiredDate:    asset?.ownership?.acquiredDate    || '',
      purchasePrice:   asset?.ownership?.purchasePrice ?? '',
    },
    insurance: {
      insurer:        asset?.insurance?.insurer        || '',
      policyNumber:   asset?.insurance?.policyNumber   || '',
      coverageAmount: asset?.insurance?.coverageAmount ?? '',
      lastAppraised:  asset?.insurance?.lastAppraised  || '',
      appraisedBy:    asset?.insurance?.appraisedBy    || '',
    },
    assignedBeneficiary: asset?.assignedBeneficiary || '',
  })

  // Load the owner's invites for the beneficiary dropdown
  useEffect(() => {
    if (!asset?.uid) return
    const loadInvites = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'invites'),
          where('registryOwnerUid', '==', asset.uid),
        ))
        setInvites(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(i => i.status !== 'declined')
        )
      } catch (e) {
        console.error('Failed to load invites:', e)
      }
    }
    loadInvites()
  }, [asset?.uid])

  const handleNestedChange = (group, field, value) => {
    setForm(prev => ({ ...prev, [group]: { ...prev[group], [field]: value } }))
  }

  const toggleSection = (key) => {
    setOpenSections(s => ({ ...s, [key]: !s[key] }))
  }

  if (!asset) {
    return <div className="page"><p className="placeholder-text">Asset not found.</p></div>
  }

  const uid = asset.uid
  const assetId = asset.id
  const photoBase = `users/${uid}/assets/${assetId}/photos`
  const docBase = `users/${uid}/assets/${assetId}/documents`

  // Gallery: hero first, then additionalImages
  const heroSrc = asset.imageUrl || asset.imageBase64 || null
  const galleryImages = [
    ...(heroSrc ? [{ src: heroSrc, isHero: true }] : []),
    ...(asset.additionalImages || []).map(item => ({
      src: photoSrc(item),
      storagePath: typeof item === 'string' ? null : item.storagePath,
      isHero: false,
    })),
  ]

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const numericOrEmpty = (v) => {
    if (v === '' || v == null) return ''
    const n = parseFloat(v)
    return isNaN(n) ? '' : n
  }

  const handleSave = async () => {
    setSaving(true)
    const updates = {
      name: form.name,
      category: form.category,
      description: form.description,
      value: form.value,
      'details.condition':         form.details.condition,
      'details.location':          form.details.location,
      'ownership.acquisitionType': form.ownership.acquisitionType,
      'ownership.acquiredFrom':    form.ownership.acquiredFrom,
      'ownership.acquiredDate':    form.ownership.acquiredDate,
      'ownership.purchasePrice':   numericOrEmpty(form.ownership.purchasePrice),
      'insurance.insurer':         form.insurance.insurer,
      'insurance.policyNumber':    form.insurance.policyNumber,
      'insurance.coverageAmount':  numericOrEmpty(form.insurance.coverageAmount),
      'insurance.lastAppraised':   form.insurance.lastAppraised,
      'insurance.appraisedBy':     form.insurance.appraisedBy,
      assignedBeneficiary:         form.assignedBeneficiary,
      updatedAt:                   serverTimestamp(),
    }
    await updateDoc(doc(db, 'assets', assetId), updates)

    setAsset({
      ...asset,
      name: form.name,
      category: form.category,
      description: form.description,
      value: form.value,
      details: {
        ...(asset.details || {}),
        condition: form.details.condition,
        location:  form.details.location,
      },
      ownership: {
        ...(asset.ownership || {}),
        acquisitionType: form.ownership.acquisitionType,
        acquiredFrom:    form.ownership.acquiredFrom,
        acquiredDate:    form.ownership.acquiredDate,
        purchasePrice:   numericOrEmpty(form.ownership.purchasePrice),
      },
      insurance: {
        ...(asset.insurance || {}),
        insurer:        form.insurance.insurer,
        policyNumber:   form.insurance.policyNumber,
        coverageAmount: numericOrEmpty(form.insurance.coverageAmount),
        lastAppraised:  form.insurance.lastAppraised,
        appraisedBy:    form.insurance.appraisedBy,
      },
      assignedBeneficiary: form.assignedBeneficiary,
    })
    setEditing(false)
    setSaving(false)
  }

  const handleCancel = () => {
    setForm({
      name: asset.name,
      category: asset.category,
      description: asset.description,
      value: asset.value,
      details: {
        condition: asset.details?.condition || '',
        location:  asset.details?.location  || '',
      },
      ownership: {
        acquisitionType: asset.ownership?.acquisitionType || '',
        acquiredFrom:    asset.ownership?.acquiredFrom    || '',
        acquiredDate:    asset.ownership?.acquiredDate    || '',
        purchasePrice:   asset.ownership?.purchasePrice ?? '',
      },
      insurance: {
        insurer:        asset.insurance?.insurer        || '',
        policyNumber:   asset.insurance?.policyNumber   || '',
        coverageAmount: asset.insurance?.coverageAmount ?? '',
        lastAppraised:  asset.insurance?.lastAppraised  || '',
        appraisedBy:    asset.insurance?.appraisedBy    || '',
      },
      assignedBeneficiary: asset.assignedBeneficiary || '',
    })
    setEditing(false)
  }

  const handleArchive = async () => {
    await updateDoc(doc(db, 'assets', assetId), { itemStatus: 'archived' })
    navigate('/registry')
  }

  const handleMarkComplete = async () => {
    await updateDoc(doc(db, 'assets', assetId), { itemStatus: null })
    setAsset({ ...asset, itemStatus: null })
  }

  // ── Hero image (thumbnail) ──
  const handleHeroPhotoChange = async (file) => {
    if (!file) return
    setUploading(true)
    const storagePath = `${photoBase}/hero`
    const url = await uploadToStorage(storagePath, file)
    await updateDoc(doc(db, 'assets', assetId), { imageUrl: url, imageBase64: null })
    setAsset({ ...asset, imageUrl: url, imageBase64: null })
    setUploading(false)
  }

  // ── Additional photos ──
  const handleAdditionalPhoto = async (file) => {
    if (!file) return
    setAddingPhoto(true)
    const storagePath = `${photoBase}/${Date.now()}-${file.name}`
    const url = await uploadToStorage(storagePath, file)
    const newItem = { url, storagePath }
    const updated = [...(asset.additionalImages || []), newItem]
    await updateDoc(doc(db, 'assets', assetId), { additionalImages: updated })
    setAsset({ ...asset, additionalImages: updated })
    setAddingPhoto(false)
  }

  const handleDeletePhoto = async (index) => {
    const item = galleryImages[index]
    if (!item) return
    if (item.isHero) {
      if (asset.imageUrl) await deleteFromStorage(`${photoBase}/hero`)
      await updateDoc(doc(db, 'assets', assetId), { imageUrl: null, imageBase64: null })
      setAsset({ ...asset, imageUrl: null, imageBase64: null })
    } else {
      const additionalIndex = heroSrc ? index - 1 : index
      const target = (asset.additionalImages || [])[additionalIndex]
      if (target?.storagePath) await deleteFromStorage(target.storagePath)
      const updated = (asset.additionalImages || []).filter((_, i) => i !== additionalIndex)
      await updateDoc(doc(db, 'assets', assetId), { additionalImages: updated })
      setAsset({ ...asset, additionalImages: updated })
    }
  }

  // ── Make Hero (swap a non-hero photo into the hero slot) ──
  // Pointer-only swap: imageUrl points at the chosen photo's URL, the
  // old hero is moved into additionalImages at the same index.
  const handleMakeHero = async (galleryIndex) => {
    if (galleryIndex === 0 && heroSrc) return
    const additionalIndex = heroSrc ? galleryIndex - 1 : galleryIndex
    const newHero = (asset.additionalImages || [])[additionalIndex]
    if (!newHero) return

    const oldHeroUrl = asset.imageUrl
    const newAdditional = [...(asset.additionalImages || [])]
    if (oldHeroUrl) {
      newAdditional[additionalIndex] = {
        url: oldHeroUrl,
        storagePath: `${photoBase}/hero`,
      }
    } else {
      newAdditional.splice(additionalIndex, 1)
    }

    await updateDoc(doc(db, 'assets', assetId), {
      imageUrl: newHero.url,
      additionalImages: newAdditional,
    })
    setAsset({ ...asset, imageUrl: newHero.url, additionalImages: newAdditional })
    setLightbox(null)
  }

  // Delete the photo currently shown in the lightbox
  const handleDeleteFromLightbox = async () => {
    if (!lightbox) return
    await handleDeletePhoto(lightbox.index)
    setLightbox(null)
  }

  // ── Documents ──
  const handleAddDoc = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAddingDoc(true)
    const storagePath = `${docBase}/${Date.now()}-${file.name}`
    const url = await uploadToStorage(storagePath, file)
    const newDoc = {
      name: file.name,
      type: file.type,
      url,
      storagePath,
      uploadedAt: new Date().toISOString(),
    }
    const updated = [...(asset.documents || []), newDoc]
    await updateDoc(doc(db, 'assets', assetId), { documents: updated })
    setAsset({ ...asset, documents: updated })
    setAddingDoc(false)
    docInputRef.current.value = ''
  }

  const handleDeleteDoc = async (index) => {
    const target = (asset.documents || [])[index]
    if (target?.storagePath) await deleteFromStorage(target.storagePath)
    const updated = (asset.documents || []).filter((_, i) => i !== index)
    await updateDoc(doc(db, 'assets', assetId), { documents: updated })
    setAsset({ ...asset, documents: updated })
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // ── Section summaries ──
  const descriptionSummary = asset.description
    ? <span className="detail-section-summary-text">{asset.description}</span>
    : emptyState('No description added')

  const detailsSummary = (() => {
    const s = summarize([asset.details?.condition, asset.details?.location])
    return s ? <span>{s}</span> : emptyState('Condition and location not recorded')
  })()

  const ownershipSummary = (() => {
    const s = summarize([
      asset.ownership?.acquisitionType,
      asset.ownership?.acquiredDate ? formatLongDate(asset.ownership.acquiredDate) : null,
    ])
    return s ? <span>{s}</span> : emptyState('Acquisition history not recorded')
  })()

  const insuranceSummary = (() => {
    const s = summarize([
      asset.insurance?.insurer,
      asset.insurance?.coverageAmount ? `${formatMoney(asset.insurance.coverageAmount)} coverage` : null,
    ])
    return s ? <span>{s}</span> : emptyState('No insurance or appraisal on file')
  })()

  const provenanceSummary = (() => {
    const n = asset.notes || {}
    const filled = ['origin', 'history', 'meaning', 'legacy'].filter(k => n[k]).length
    if (filled === 0) return emptyState('No story recorded yet')
    return <span>{filled} of 4 sections written</span>
  })()

  const assignedInvite = invites.find(i => i.id === asset.assignedBeneficiary)
  const beneficiarySummary = assignedInvite
    ? <span>{assignedInvite.invitedName} — {assignedInvite.relationship}</span>
    : emptyState('Unassigned')

  const additionalCount = (asset.additionalImages || []).length
  const photosSummary = additionalCount > 0
    ? <span>{additionalCount} additional photo{additionalCount === 1 ? '' : 's'}</span>
    : emptyState('No additional photos')

  const docsCount = (asset.documents || []).length
  const documentsSummary = docsCount > 0
    ? <span>{docsCount} document{docsCount === 1 ? '' : 's'} attached</span>
    : emptyState('No documents attached')

  // ── Summary card derived values ──
  const heroImage = asset.imageUrl || asset.imageBase64 || DEFAULT_IMAGE
  const summaryCondition = asset.details?.condition
  const summaryLocation  = asset.details?.location
  const summaryValue     = asset.value

  return (
    <div className={`page asset-detail-page ${editing ? 'asset-detail-page--editing' : ''}`}>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <img className="lightbox-img" src={lightbox.src} alt="Full size" />
            {!lightbox.isHero && (
              <div className="lightbox-actions">
                <button className="btn-ghost" onClick={() => handleMakeHero(lightbox.index)}>
                  Make Primary Photo
                </button>
                <button className="btn-ghost lightbox-action-delete" onClick={handleDeleteFromLightbox}>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="asset-detail-topbar">
        <button className="btn-back" onClick={() => navigate('/registry')}>← Registry</button>
      </div>

      {asset.itemStatus === 'pending' && (
        <div className="pending-asset-banner">
          <span className="pending-asset-banner-text">
            This item needs a photo and a few more details to be complete.
          </span>
          <button
            type="button"
            className="pending-asset-banner-link"
            onClick={handleMarkComplete}
          >
            Mark as complete
          </button>
        </div>
      )}

      {/* ── Summary card ── */}
      <div className="asset-summary">
        <div className="asset-summary-photo-wrap">
          <img className="asset-summary-photo" src={heroImage} alt={asset.name} />
          <div className="asset-summary-photo-shade" />
          <div className="asset-summary-photo-bottom">
            <h1 className="asset-summary-name">{asset.name}</h1>
          </div>
          {asset.category && (
            <span className="asset-summary-category-badge">{asset.category}</span>
          )}
          {!editing && (
            <button className="asset-summary-edit-btn" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>

        <div className="asset-summary-meta">
          <div className="asset-summary-value">
            {summaryValue ? `$${parseFloat(summaryValue).toLocaleString('en-US')}` : '$0'}
          </div>
          <div className="asset-summary-meta-extras">
            {summaryCondition && (
              <span className="asset-summary-meta-pill">{summaryCondition}</span>
            )}
            {summaryLocation && (
              <span className="asset-summary-meta-text">{summaryLocation}</span>
            )}
          </div>
        </div>

        {editing && (
          <div className="asset-summary-edit-fields">
            <PhotoUploadButtons
              onFileSelected={handleHeroPhotoChange}
              label={uploading ? 'Saving...' : 'Change Primary Photo'}
              disabled={uploading}
            />
            <div className="asset-summary-edit-row">
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="detail-field-input"
                placeholder="Item name"
              />
            </div>
            <div className="asset-summary-edit-row">
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                className="detail-field-input"
                placeholder="Category"
              />
              <input
                name="value"
                value={form.value}
                onChange={handleChange}
                className="detail-field-input"
                placeholder="Estimated value"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Description ── */}
      <SectionAccordion
        label="Description"
        summary={descriptionSummary}
        expanded={openSections.description}
        editable
        editing={editing}
        onToggle={() => toggleSection('description')}
      >
        {editing ? (
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            className="edit-textarea"
            placeholder="Add a description"
          />
        ) : (
          <p className="detail-text">
            {asset.description || <span className="detail-field-empty">No description recorded.</span>}
          </p>
        )}
      </SectionAccordion>

      {/* ── Details ── */}
      <SectionAccordion
        label="Details"
        summary={detailsSummary}
        expanded={openSections.details}
        editable
        editing={editing}
        onToggle={() => toggleSection('details')}
      >
        <div className="detail-fields">
          <div className="detail-field">
            <div className="detail-field-label">Condition</div>
            <div className="pill-row">
              {CONDITION_OPTIONS.map(opt => {
                const active = ((editing ? form.details.condition : asset.details?.condition) || 'Unknown') === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    className={`pill ${active ? 'pill--active' : ''}`}
                    onClick={() => editing && handleNestedChange('details', 'condition', opt === 'Unknown' ? '' : opt)}
                    disabled={!editing}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Location</div>
            {editing ? (
              <input
                type="text"
                className="detail-field-input"
                value={form.details.location}
                onChange={e => handleNestedChange('details', 'location', e.target.value)}
                placeholder="e.g. Safe deposit box — First Bank"
              />
            ) : (
              <div className="detail-field-value">
                {asset.details?.location || <span className="detail-field-empty">—</span>}
              </div>
            )}
          </div>
        </div>
      </SectionAccordion>

      {/* ── Ownership ── */}
      <SectionAccordion
        label="Ownership"
        summary={ownershipSummary}
        expanded={openSections.ownership}
        editable
        editing={editing}
        onToggle={() => toggleSection('ownership')}
      >
        {(() => {
          const activeType = editing ? form.ownership.acquisitionType : (asset.ownership?.acquisitionType || '')
          const currentPriceLabel = priceLabel(editing ? form.ownership.acquisitionType : asset.ownership?.acquisitionType)
          return (
            <div className="detail-fields">
              <div className="detail-field">
                <div className="detail-field-label">Acquisition type</div>
                <div className="pill-row">
                  {ACQUISITION_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      className={`pill ${activeType === opt ? 'pill--active' : ''}`}
                      onClick={() => editing && handleNestedChange('ownership', 'acquisitionType', opt)}
                      disabled={!editing}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Acquired from</div>
                {editing ? (
                  <input
                    type="text"
                    className="detail-field-input"
                    value={form.ownership.acquiredFrom}
                    onChange={e => handleNestedChange('ownership', 'acquiredFrom', e.target.value)}
                    placeholder="Person, dealer, or estate"
                  />
                ) : (
                  <div className="detail-field-value">
                    {asset.ownership?.acquiredFrom || <span className="detail-field-empty">—</span>}
                  </div>
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Acquired date</div>
                {editing ? (
                  <input
                    type="date"
                    className="detail-field-input"
                    value={form.ownership.acquiredDate}
                    onChange={e => handleNestedChange('ownership', 'acquiredDate', e.target.value)}
                  />
                ) : (
                  <div className="detail-field-value">
                    {asset.ownership?.acquiredDate
                      ? formatLongDate(asset.ownership.acquiredDate)
                      : <span className="detail-field-empty">—</span>}
                  </div>
                )}
              </div>
              <div className="detail-field">
                <div className="detail-field-label">{currentPriceLabel}</div>
                {editing ? (
                  <input
                    type="number"
                    step="0.01"
                    className="detail-field-input"
                    value={form.ownership.purchasePrice}
                    onChange={e => handleNestedChange('ownership', 'purchasePrice', e.target.value)}
                    placeholder="0"
                  />
                ) : (
                  <div className="detail-field-value">
                    {asset.ownership?.purchasePrice
                      ? formatMoney(asset.ownership.purchasePrice)
                      : <span className="detail-field-empty">—</span>}
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </SectionAccordion>

      {/* ── Insurance & Appraisal ── */}
      <SectionAccordion
        label="Insurance & Appraisal"
        summary={insuranceSummary}
        expanded={openSections.insurance}
        editable
        editing={editing}
        onToggle={() => toggleSection('insurance')}
      >
        <div className="detail-fields">
          <div className="detail-field">
            <div className="detail-field-label">Insurer</div>
            {editing ? (
              <input
                type="text"
                className="detail-field-input"
                value={form.insurance.insurer}
                onChange={e => handleNestedChange('insurance', 'insurer', e.target.value)}
                placeholder="Insurance company"
              />
            ) : (
              <div className="detail-field-value">
                {asset.insurance?.insurer || <span className="detail-field-empty">—</span>}
              </div>
            )}
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Policy number</div>
            {editing ? (
              <input
                type="text"
                className="detail-field-input"
                value={form.insurance.policyNumber}
                onChange={e => handleNestedChange('insurance', 'policyNumber', e.target.value)}
                placeholder="Policy #"
              />
            ) : (
              <div className="detail-field-value">
                {asset.insurance?.policyNumber || <span className="detail-field-empty">—</span>}
              </div>
            )}
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Coverage amount</div>
            {editing ? (
              <input
                type="number"
                step="0.01"
                className="detail-field-input"
                value={form.insurance.coverageAmount}
                onChange={e => handleNestedChange('insurance', 'coverageAmount', e.target.value)}
                placeholder="0"
              />
            ) : (
              <div className="detail-field-value">
                {asset.insurance?.coverageAmount
                  ? formatMoney(asset.insurance.coverageAmount)
                  : <span className="detail-field-empty">—</span>}
              </div>
            )}
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Last appraised</div>
            {editing ? (
              <input
                type="date"
                className="detail-field-input"
                value={form.insurance.lastAppraised}
                onChange={e => handleNestedChange('insurance', 'lastAppraised', e.target.value)}
              />
            ) : (
              <div className="detail-field-value">
                {asset.insurance?.lastAppraised
                  ? formatLongDate(asset.insurance.lastAppraised)
                  : <span className="detail-field-empty">—</span>}
              </div>
            )}
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Appraised by</div>
            {editing ? (
              <input
                type="text"
                className="detail-field-input"
                value={form.insurance.appraisedBy}
                onChange={e => handleNestedChange('insurance', 'appraisedBy', e.target.value)}
                placeholder="Appraiser name"
              />
            ) : (
              <div className="detail-field-value">
                {asset.insurance?.appraisedBy || <span className="detail-field-empty">—</span>}
              </div>
            )}
          </div>
        </div>
      </SectionAccordion>

      {/* ── Provenance Story ── (autosaves on its own) */}
      <SectionAccordion
        label="Provenance Story"
        summary={provenanceSummary}
        expanded={openSections.provenance}
        editable={false}
        editing={editing}
        onToggle={() => toggleSection('provenance')}
      >
        <ProvenanceNotes asset={asset} onUpdate={setAsset} isPremium={false} />
      </SectionAccordion>

      {/* ── Assigned Beneficiary ── */}
      <SectionAccordion
        label="Assigned Beneficiary"
        summary={beneficiarySummary}
        expanded={openSections.beneficiary}
        editable
        editing={editing}
        onToggle={() => toggleSection('beneficiary')}
      >
        <div className="detail-fields">
          {editing ? (
            invites.length === 0 ? (
              <p className="detail-field-empty">
                No beneficiaries invited yet. Add them in Profile.
              </p>
            ) : (
              <select
                className="detail-field-input"
                value={form.assignedBeneficiary}
                onChange={e => setForm(prev => ({ ...prev, assignedBeneficiary: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {invites.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invitedName} — {inv.relationship}
                  </option>
                ))}
              </select>
            )
          ) : (
            <div className="detail-field-value">
              {assignedInvite
                ? `${assignedInvite.invitedName} — ${assignedInvite.relationship}`
                : <span className="detail-field-empty">Unassigned</span>}
            </div>
          )}
        </div>
      </SectionAccordion>

      {/* ── Photos ── */}
      <SectionAccordion
        label="Photos"
        summary={photosSummary}
        expanded={openSections.photos}
        editable={false}
        editing={editing}
        onToggle={() => toggleSection('photos')}
      >
        <div className="detail-fields">
          {galleryImages.length === 0 ? (
            <div className="vault-empty"><p>No photos yet. Add one below.</p></div>
          ) : (
            <div className="photo-grid">
              {galleryImages.map((item, i) => (
                <div
                  key={i}
                  className={`photo-grid-item ${item.isHero ? 'photo-grid-item--hero' : ''}`}
                  onClick={() => setLightbox({ src: item.src, index: i, isHero: item.isHero })}
                >
                  <img src={item.src} alt={`Photo ${i + 1}`} className="photo-grid-img" />
                  {item.isHero && <span className="photo-grid-hero-badge">Primary</span>}
                </div>
              ))}
            </div>
          )}

          <PhotoUploadButtons
            onFileSelected={handleAdditionalPhoto}
            label={addingPhoto ? 'Uploading...' : 'Add Photo'}
            disabled={addingPhoto}
            className="vault-photo-upload"
          />
        </div>
      </SectionAccordion>

      {/* ── Documents ── */}
      <SectionAccordion
        label="Documents"
        summary={documentsSummary}
        expanded={openSections.documents}
        editable={false}
        editing={editing}
        onToggle={() => toggleSection('documents')}
      >
        <div className="detail-fields">
          <div className="vault-subsection-header">
            <span className="vault-subsection-label">Attached Documents</span>
            <button className="vault-add-btn" onClick={() => docInputRef.current.click()} disabled={addingDoc}>
              {addingDoc ? 'Uploading...' : '+ Attach Document'}
            </button>
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleAddDoc}
              style={{ display: 'none' }}
            />
          </div>

          {(asset.documents || []).length === 0 ? (
            <div className="vault-empty">
              <p>No documents attached. Add receipts, appraisals, or certificates above.</p>
            </div>
          ) : (
            <div className="doc-list">
              {asset.documents.map((document, i) => (
                <div key={i} className="doc-row">
                  <button className="doc-row-main" onClick={() => openDocument(document)} title="Open document">
                    <span className="doc-icon">{docIcon(document.type)}</span>
                    <div className="doc-info">
                      <span className="doc-name">{document.name}</span>
                      <span className="doc-date">{formatDate(document.uploadedAt)}</span>
                    </div>
                    <span className="doc-open">↗</span>
                  </button>
                  <button className="doc-delete-btn" onClick={() => handleDeleteDoc(i)} title="Delete document">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionAccordion>

      {/* ── Archive zone (unchanged) ── */}
      <div className="detail-delete-zone">
        {confirmArchive ? (
          <div className="delete-confirm">
            <p>Move <strong>{asset.name}</strong> to the archive? You can reinstate it later.</p>
            <div className="delete-confirm-actions">
              <button className="btn-ghost" onClick={() => setConfirmArchive(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleArchive}>Move to Archive</button>
            </div>
          </div>
        ) : (
          <button className="btn-delete-trigger" onClick={() => setConfirmArchive(true)}>
            Move to Archive
          </button>
        )}
      </div>

      {/* ── Sticky save bar (edit mode only) ── */}
      {editing && (
        <div className="edit-action-bar">
          <button className="btn-ghost edit-action-cancel" onClick={handleCancel} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary edit-action-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  )
}

export default AssetDetailPage
