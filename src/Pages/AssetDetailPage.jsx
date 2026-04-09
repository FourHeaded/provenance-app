import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { db } from '../firebase'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import ProvenanceNotes from '../ProvenanceNotes'

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231A1A1A'/%3E%3Crect x='60' y='60' width='80' height='60' rx='4' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Ccircle cx='85' cy='82' r='8' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Cpolyline points='60,120 85,95 105,112 125,88 140,120' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3C/svg%3E"

function AssetDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id } = useParams()

  const [asset, setAsset] = useState(location.state?.asset || null)
  const [editing, setEditing] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: asset?.name || '',
    category: asset?.category || '',
    description: asset?.description || '',
    value: asset?.value || ''
  })

  if (!asset) {
    return (
      <div className="page">
        <p className="placeholder-text">Asset not found.</p>
      </div>
    )
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSave = async () => {
    setSaving(true)
    const ref = doc(db, 'assets', asset.id)
    await updateDoc(ref, form)
    setAsset({ ...asset, ...form })
    setEditing(false)
    setSaving(false)
  }

  const handleCancel = () => {
    setForm({
      name: asset.name,
      category: asset.category,
      description: asset.description,
      value: asset.value
    })
    setEditing(false)
  }

  const handleArchive = async () => {
    await updateDoc(doc(db, 'assets', asset.id), { itemStatus: 'archived' })
    navigate('/registry')
  }

  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = reader.result
      const ref = doc(db, 'assets', asset.id)
      await updateDoc(ref, { imageBase64: base64 })
      setAsset({ ...asset, imageBase64: base64 })
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="page">
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
                <input
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="edit-input edit-input-small"
                  placeholder="Category"
                />
              ) : asset.category}
            </div>
            {editing ? (
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="edit-input edit-input-large"
                placeholder="Item name"
              />
            ) : (
              <h1 className="detail-name">{asset.name}</h1>
            )}
            {editing ? (
              <input
                name="value"
                value={form.value}
                onChange={handleChange}
                className="edit-input edit-input-value"
                placeholder="Estimated value"
              />
            ) : (
              <div className="detail-value">${asset.value}</div>
            )}
          </div>
          <div className="detail-thumbnail-wrap">
            <img
              src={asset.imageBase64 || DEFAULT_IMAGE}
              alt={asset.name}
              className="detail-thumbnail"
            />
            <label className="thumbnail-upload-label">
              {uploading ? 'Saving...' : 'Change photo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h2 className="section-label">Description</h2>
        <div className="detail-card">
          {editing ? (
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="edit-textarea"
              placeholder="Add a description"
            />
          ) : (
            <p className="detail-text">{asset.description || 'No description recorded.'}</p>
          )}
        </div>
      </div>

      <div className="detail-section">
        <h2 className="section-label">Provenance Notes</h2>
        <ProvenanceNotes
          asset={asset}
          onUpdate={setAsset}
          isPremium={false}
        />
      </div>

      <div className="detail-section">
        <h2 className="section-label">Documents & Photos</h2>
        <div className="detail-card detail-empty">
          <p className="detail-placeholder">Receipts, appraisals, and photos coming soon.</p>
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