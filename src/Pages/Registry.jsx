import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231A1A1A'/%3E%3Crect x='60' y='60' width='80' height='60' rx='4' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Ccircle cx='85' cy='82' r='8' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Cpolyline points='60,120 85,95 105,112 125,88 140,120' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3C/svg%3E"

function Registry({ user }) {
  const [assets, setAssets] = useState([])
  const [activeFilters, setActiveFilters] = useState([])
  const [search, setSearch] = useState('')
  const [scanBanner, setScanBanner] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  const loadAssets = async () => {
    const q = query(collection(db, 'assets'), where('uid', '==', user.uid))
    const snapshot = await getDocs(q)
    setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(a => a.itemStatus !== 'archived'))
  }

  useEffect(() => {
    loadAssets()
  }, [])

  // Pick up the scan-result banner from navigation state, then clear
  // it so a refresh doesn't re-show the banner.
  useEffect(() => {
    const result = location.state?.scanResult
    if (result) {
      setScanBanner(result)
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dismissAllPending = async () => {
    const pending = assets.filter(a => a.itemStatus === 'pending')
    await Promise.all(pending.map(p =>
      updateDoc(doc(db, 'assets', p.id), { itemStatus: null })
    ))
    setAssets(prev => prev.map(a =>
      a.itemStatus === 'pending' ? { ...a, itemStatus: null } : a
    ))
  }

  const toggleFilter = (category) => {
    setActiveFilters(prev =>
      prev.includes(category)
        ? prev.filter(f => f !== category)
        : [...prev, category]
    )
  }

  const pendingAssets = assets.filter(a => a.itemStatus === 'pending')
  const activeAssets  = assets.filter(a => a.itemStatus !== 'pending')

  const usedCategories = [...new Set(activeAssets.map(a => a.category).filter(Boolean))]

  const searchTerm = search.trim().toLowerCase()

  const filteredAssets = activeAssets.filter(a => {
    const matchesFilter = activeFilters.length === 0 || activeFilters.includes(a.category)
    const matchesSearch = !searchTerm
      || a.name?.toLowerCase().includes(searchTerm)
      || a.category?.toLowerCase().includes(searchTerm)
      || a.description?.toLowerCase().includes(searchTerm)
    return matchesFilter && matchesSearch
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Registry</h1>
      </div>

      {scanBanner && (
        <div className="scan-banner">
          <span className="scan-banner-icon">✓</span>
          <span className="scan-banner-text">
            {scanBanner.confirmed} item{scanBanner.confirmed === 1 ? '' : 's'} added to your registry.
            {scanBanner.pending > 0 && (
              <> {scanBanner.pending} pending item{scanBanner.pending === 1 ? '' : 's'} need photos and details.</>
            )}
          </span>
          <button className="scan-banner-close" onClick={() => setScanBanner(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {pendingAssets.length > 0 && (
        <div className="pending-section">
          <h2 className="section-label pending-section-label">Finish These Items</h2>
          <p className="pending-section-subtitle">
            These items were scanned but still need photos and details
          </p>
          <div className="pending-list">
            {pendingAssets.map(asset => (
              <button
                key={asset.id}
                type="button"
                className="pending-row"
                onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
              >
                <div className="pending-row-info">
                  <div className="pending-row-name">{asset.name || 'Untitled item'}</div>
                  <div className="pending-row-cat">{asset.category || 'Uncategorized'}</div>
                </div>
                <span className="pending-row-action">Tap to complete →</span>
              </button>
            ))}
          </div>
          <button type="button" className="pending-dismiss-all" onClick={dismissAllPending}>
            Dismiss all
          </button>
        </div>
      )}

      <div className="asset-list">
        <div className="registry-search-wrap">
          <input
            className="registry-search"
            type="search"
            placeholder="Search by name, category, or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <p className="registry-export-nudge">
          Want a printable record of your assets?{' '}
          <button
            type="button"
            className="registry-export-link"
            onClick={() => navigate('/reports')}
          >
            Generate Registry Export →
          </button>
        </p>

        {usedCategories.length > 0 && (
          <div className="filter-bar">
            {usedCategories.map(cat => (
              <button
                key={cat}
                className={`filter-chip ${activeFilters.includes(cat) ? 'active' : ''}`}
                onClick={() => toggleFilter(cat)}
              >
                {cat}
              </button>
            ))}
            {activeFilters.length > 0 && (
              <button className="filter-clear" onClick={() => setActiveFilters([])}>
                Clear
              </button>
            )}
          </div>
        )}

        <hr className="divider" />

        {filteredAssets.length === 0 ? (
          <p className="empty-state">
            {searchTerm || activeFilters.length > 0
              ? 'No assets match your search.'
              : 'No assets yet. Tap + to add your first item.'}
          </p>
        ) : (
          filteredAssets.map((asset) => (
            <div
              className="asset-card"
              key={asset.id}
              onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
            >
              <img
                className="asset-card-thumbnail"
                src={asset.imageBase64 || DEFAULT_IMAGE}
                alt=""
              />
              <div className="asset-card-left">
                <div className="asset-name">{asset.name}</div>
                <div className="asset-category">{asset.category}</div>
                {asset.description && <div className="asset-description">{asset.description}</div>}
              </div>
              <div className="asset-card-right">
                <span className="asset-value">${asset.value}</span>
                <span className="asset-chevron">›</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Registry