import { useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { db, storage } from '../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import ProvenanceNotes from '../ProvenanceNotes'

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231A1A1A'/%3E%3Crect x='60' y='60' width='80' height='60' rx='4' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Ccircle cx='85' cy='82' r='8' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Cpolyline points='60,120 85,95 105,112 125,88 140,120' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3C/svg%3E"

function docIcon(type) {
  if (!type) return '📎'
  if (type.includes('pdf')) return '📄'
  if (type.includes('image')) return '🖼️'
  if (type.includes('word') || type.includes('doc')) return '📝'
  return '📎'
}

// Used only for backward-compat base64 documents
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

// Returns the src for a photo item — items may be legacy base64 strings or {url, storagePath} objects
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

function AssetDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const [asset, setAsset] = useState(location.state?.asset || null)
  const [editing, setEditing] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [addingPhoto, setAddingPhoto] = useState(false)
  const [addingDoc, setAddingDoc] = useState(false)
  const photoInputRef = useRef(null)
  const docInputRef = useRef(null)

  const [form, setForm] = useState({
    name: asset?.name || '',
    category: asset?.category || '',
    description: asset?.description || '',
    value: asset?.value || ''
  })

  if (!asset) {
    return <div className="page"><p className="placeholder-text">Asset not found.</p></div>
  }

  const uid = asset.uid
  const assetId = asset.id
  const photoBase = `users/${uid}/assets/${assetId}/photos`
  const docBase = `users/${uid}/assets/${assetId}/documents`

  // Gallery: hero first (URL or base64), then additionalImages
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

  const handleSave = async () => {
    setSaving(true)
    await updateDoc(doc(db, 'assets', assetId), form)
    setAsset({ ...asset, ...form })
    setEditing(false)
    setSaving(false)
  }

  const handleCancel = () => {
    setForm({ name: asset.name, category: asset.category, description: asset.description, value: asset.value })
    setEditing(false)
  }

  const handleArchive = async () => {
    await updateDoc(doc(db, 'assets', assetId), { itemStatus: 'archived' })
    navigate('/registry')
  }

  // ── Hero image (thumbnail) ──
  const handleHeroImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const storagePath = `${photoBase}/hero`
    const url = await uploadToStorage(storagePath, file)
    await updateDoc(doc(db, 'assets', assetId), { imageUrl: url, imageBase64: null })
    setAsset({ ...asset, imageUrl: url, imageBase64: null })
    setUploading(false)
  }

  // ── Additional photos ──
  const handleAddPhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAddingPhoto(true)
    const storagePath = `${photoBase}/${Date.now()}-${file.name}`
    const url = await uploadToStorage(storagePath, file)
    const newItem = { url, storagePath }
    const updated = [...(asset.additionalImages || []), newItem]
    await updateDoc(doc(db, 'assets', assetId), { additionalImages: updated })
    setAsset({ ...asset, additionalImages: updated })
    setAddingPhoto(false)
    photoInputRef.current.value = ''
  }

  const handleDeletePhoto = async (index) => {
    const item = galleryImages[index]
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

  return (
    <div className="page">

      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img
            className="lightbox-img"
            src={lightbox}
            alt="Full size"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate('/registry')}>← Registry</button>
        <div className="detail-header-actions">
          {editing ? (
            <>
              <button className="btn-ghost" onClick={handleCancel}>Cancel</button>
              <button className="btn-primary btn-small" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      </div>

      <div className="detail-hero">
        <div className="detail-hero-content">
          <div className="detail-hero-text">
            <div className="detail-category">
              {editing ? (
                <input name="category" value={form.category} onChange={handleChange}
                  className="edit-input edit-input-small" placeholder="Category" />
              ) : asset.category}
            </div>
            {editing ? (
              <input name="name" value={form.name} onChange={handleChange}
                className="edit-input edit-input-large" placeholder="Item name" />
            ) : (
              <h1 className="detail-name">{asset.name}</h1>
            )}
            {editing ? (
              <input name="value" value={form.value} onChange={handleChange}
                className="edit-input edit-input-value" placeholder="Estimated value" />
            ) : (
              <div className="detail-value">${asset.value}</div>
            )}
          </div>
          <div className="detail-thumbnail-wrap">
            <img
              src={asset.imageUrl || asset.imageBase64 || DEFAULT_IMAGE}
              alt={asset.name}
              className="detail-thumbnail"
            />
            <label className="thumbnail-upload-label">
              {uploading ? 'Saving...' : 'Change photo'}
              <input type="file" accept="image/*" onChange={handleHeroImageChange} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h2 className="section-label">Description</h2>
        <div className="detail-card">
          {editing ? (
            <textarea name="description" value={form.description} onChange={handleChange}
              className="edit-textarea" placeholder="Add a description" />
          ) : (
            <p className="detail-text">{asset.description || 'No description recorded.'}</p>
          )}
        </div>
      </div>

      <div className="detail-section">
        <h2 className="section-label">Provenance Notes</h2>
        <ProvenanceNotes asset={asset} onUpdate={setAsset} isPremium={false} />
      </div>

      <div className="detail-section">
        <h2 className="section-label">Documents & Photos</h2>

        {/* Photos */}
        <div className="vault-subsection">
          <div className="vault-subsection-header">
            <span className="vault-subsection-label">Photos</span>
            <button className="vault-add-btn" onClick={() => photoInputRef.current.click()} disabled={addingPhoto}>
              {addingPhoto ? 'Uploading...' : '+ Add Photo'}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*"
              onChange={handleAddPhoto} style={{ display: 'none' }} />
          </div>

          {galleryImages.length === 0 ? (
            <div className="vault-empty"><p>No photos yet. Add your first photo above.</p></div>
          ) : (
            <div className="photo-grid">
              {galleryImages.map((item, i) => (
                <div key={i} className="photo-grid-item" onClick={() => setLightbox(item.src)}>
                  <img src={item.src} alt={`Photo ${i + 1}`} className="photo-grid-img" />
                  <button
                    className="photo-delete-btn"
                    onClick={e => { e.stopPropagation(); handleDeletePhoto(i) }}
                    title="Remove photo"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="vault-subsection">
          <div className="vault-subsection-header">
            <span className="vault-subsection-label">Documents</span>
            <button className="vault-add-btn" onClick={() => docInputRef.current.click()} disabled={addingDoc}>
              {addingDoc ? 'Uploading...' : '+ Attach Document'}
            </button>
            <input ref={docInputRef} type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleAddDoc} style={{ display: 'none' }} />
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
      </div>

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
    </div>
  )
}

export default AssetDetailPage
