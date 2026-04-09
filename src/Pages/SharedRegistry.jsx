import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231A1A1A'/%3E%3Crect x='60' y='60' width='80' height='60' rx='4' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Ccircle cx='85' cy='82' r='8' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Cpolyline points='60,120 85,95 105,112 125,88 140,120' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3C/svg%3E"

function SharedRegistry({ user }) {
  const { ownerUid } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [assets, setAssets] = useState([])
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
        // Query by owner only (avoids composite index requirement),
        // then filter by the user's verified Google email client-side
        const userEmail = user.email.toLowerCase()
        const inviteSnap = await getDocs(query(
          collection(db, 'invites'),
          where('registryOwnerUid', '==', ownerUid),
        ))
        const validInvite = inviteSnap.docs
          .map(d => d.data())
          .find(d => d.invitedEmail === userEmail && d.status !== 'declined')

        if (!validInvite) {
          setLoading(false)
          return
        }
        setHasAccess(true)
        setOwnerName(validInvite.ownerName || '')
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
    </div>
  )
}

export default SharedRegistry
