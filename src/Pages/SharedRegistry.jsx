import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, getDoc, query, where, doc, updateDoc } from 'firebase/firestore'

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

function SharedRegistry({ user }) {
  const { ownerUid } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [assets, setAssets] = useState([])
  const [estateDocs, setEstateDocs] = useState([])
  const [ownerName, setOwnerName] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const [expressingInterest, setExpressingInterest] = useState(null)
  const [interestedMap, setInterestedMap] = useState({}) // assetId -> bool

  useEffect(() => {
    const load = async () => {
      // Owner can always preview their own shared registry
      if (user.uid === ownerUid) {
        setHasAccess(true)
        setOwnerName(user.displayName || '')
      } else {
        // Deterministic invite ID lookup — no query, no composite index needed.
        // Format must match what Profile.jsx writes: `{ownerUid}_{lowercased email}`
        const userEmail = user.email.toLowerCase()
        const inviteId = `${ownerUid}_${userEmail}`
        const inviteSnap = await getDoc(doc(db, 'invites', inviteId))

        if (!inviteSnap.exists() || inviteSnap.data().status === 'declined') {
          setLoading(false)
          return
        }
        setHasAccess(true)
        setOwnerName(inviteSnap.data().ownerName || '')
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

      // Pre-compute which assets this user has already expressed interest in
      const map = {}
      list.forEach(a => {
        map[a.id] = (a.interestedParties || []).some(p => p.email === user.email)
      })
      setInterestedMap(map)

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
  }, [ownerUid, user.email])

  const handleExpressInterest = async (asset) => {
    if (interestedMap[asset.id]) return
    setExpressingInterest(asset.id)
    const updated = [
      ...(asset.interestedParties || []),
      { email: user.email, name: user.displayName, expressedAt: new Date().toISOString() },
    ]
    await updateDoc(doc(db, 'assets', asset.id), { interestedParties: updated })
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, interestedParties: updated } : a))
    setInterestedMap(prev => ({ ...prev, [asset.id]: true }))
    setExpressingInterest(null)
  }

  if (loading) {
    return <div className="page"><p className="placeholder-text">Loading...</p></div>
  }

  if (!hasAccess) {
    return (
      <div className="shared-no-access">
        <div className="shared-no-access-inner">
          <div className="shared-ornament" />
          <h1 className="shared-no-access-title">Access Required</h1>
          <p className="shared-no-access-text">
            You need an invitation to view this registry. Contact the owner to request access.
          </p>
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
            const interested = interestedMap[asset.id]
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
                        ? '✓ Interest expressed'
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
