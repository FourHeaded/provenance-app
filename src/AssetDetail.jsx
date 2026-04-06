import { useState } from 'react'
import { db } from './firebase'
import { doc, updateDoc } from 'firebase/firestore'
import './App.css'

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231A1A1A'/%3E%3Crect x='60' y='60' width='80' height='60' rx='4' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Ccircle cx='85' cy='82' r='8' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Cpolyline points='60,120 85,95 105,112 125,88 140,120' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3C/svg%3E"

function AssetDetail({ asset, onBack, onUpdate }) {
  const [uploading, setUploading] = useState(false)

  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)

    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = reader.result
      const ref = doc(db, 'assets', asset.id)
      await updateDoc(ref, { imageBase64: base64 })
      onUpdate({ ...asset, imageBase64: base64 })
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="app">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>← Registry</button>
      </div>

      <div className="detail-hero">
        <div className="detail-hero-content">
          <div>
            <div className="detail-category">{asset.category}</div>
            <h1 className="detail-name">{asset.name}</h1>
            <div className="detail-value">${asset.value}</div>
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
          <p className="detail-text">
            {asset.description || 'No description recorded.'}
          </p>
        </div>
      </div>

      <div className="detail-section">
        <h2 className="section-label">Provenance Notes</h2>
        <div className="detail-card detail-empty">
          <p className="detail-placeholder">Notes, history, and origin details coming soon.</p>
        </div>
      </div>

      <div className="detail-section">
        <h2 className="section-label">Documents & Photos</h2>
        <div className="detail-card detail-empty">
          <p className="detail-placeholder">Receipts, appraisals, and photos coming soon.</p>
        </div>
      </div>
    </div>
  )
}

export default AssetDetail