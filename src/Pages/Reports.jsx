import { useState } from 'react'
import { db } from '../firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { pdf } from '@react-pdf/renderer'
import RegistryDocument from '../pdf/RegistryDocument'

function Reports({ user, isPremium }) {
  const [includeNotes, setIncludeNotes] = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [error, setError]               = useState('')

  const handleGenerate = async () => {
    setError('')
    setGenerating(true)
    try {
      // Fetch all of the user's assets, filter archived client-side.
      // This matches Registry.jsx / Home.jsx and ensures legacy assets
      // without an `itemStatus` field are still included (Firestore's
      // `!=` filter excludes documents where the field is missing).
      // No composite index required.
      const q = query(
        collection(db, 'assets'),
        where('uid', '==', user.uid),
      )
      const snap = await getDocs(q)
      const assets = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => a.itemStatus !== 'archived')

      const doc = (
        <RegistryDocument
          ownerName={user.displayName || user.email}
          assets={assets}
          includeNotes={includeNotes}
        />
      )

      const blob = await pdf(doc).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      const date = new Date().toISOString().slice(0, 10)
      a.download = `provenance-registry-${date}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e) {
      console.error('PDF generation failed:', e)
      setError(e.message || 'Failed to generate PDF')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Printable records of your registry</p>
      </div>

      {/* ── Asset Registry Export ── */}
      <div className="report-card">
        <div className="report-card-head">
          <h2 className="report-card-title">Asset Registry Export</h2>
        </div>
        <p className="report-card-desc">
          A complete record of your registered assets formatted for insurance,
          legal, and estate planning purposes.
        </p>

        <div className="report-options">
          <button
            type="button"
            className={`report-option ${!includeNotes ? 'report-option--active' : ''}`}
            onClick={() => setIncludeNotes(false)}
          >
            Assets only
          </button>
          <button
            type="button"
            className={`report-option ${includeNotes ? 'report-option--active' : ''}`}
            onClick={() => setIncludeNotes(true)}
          >
            Include provenance notes
          </button>
        </div>

        {isPremium ? (
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Preparing your registry…' : 'Generate PDF'}
          </button>
        ) : (
          <div className="report-locked">
            <button className="btn-primary report-locked-btn" disabled>
              <span className="report-lock-icon">🔒</span>
              Unlock with Premium
            </button>
            <p className="report-locked-note">PDF export is a premium feature.</p>
          </div>
        )}

        {error && <p className="report-error">{error}</p>}
      </div>

      {/* ── Coming soon cards ── */}
      <div className="report-card report-card--coming">
        <span className="report-coming-badge">Coming soon</span>
        <h2 className="report-card-title">Valuation Summary</h2>
        <p className="report-card-desc">
          Category breakdown and total estate value with year-over-year changes.
        </p>
      </div>

      <div className="report-card report-card--coming">
        <span className="report-coming-badge">Coming soon</span>
        <h2 className="report-card-title">Beneficiary Report</h2>
        <p className="report-card-desc">
          Who has access to what, including expressed interest and shared documents.
        </p>
      </div>

      <div className="report-card report-card--coming">
        <span className="report-coming-badge">Coming soon</span>
        <h2 className="report-card-title">Document Status Review</h2>
        <p className="report-card-desc">
          Review your estate planning documents and flag anything overdue for an update.
        </p>
      </div>
    </div>
  )
}

export default Reports
