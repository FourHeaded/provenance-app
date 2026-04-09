import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231A1A1A'/%3E%3Crect x='60' y='60' width='80' height='60' rx='4' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Ccircle cx='85' cy='82' r='8' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Cpolyline points='60,120 85,95 105,112 125,88 140,120' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3C/svg%3E"

function Registry({ user }) {
  const [assets, setAssets] = useState([])
  const [activeFilters, setActiveFilters] = useState([])
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const loadAssets = async () => {
    const q = query(collection(db, 'assets'), where('uid', '==', user.uid))
    const snapshot = await getDocs(q)
    setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(a => a.itemStatus !== 'archived'))
  }

  useEffect(() => {
    loadAssets()
  }, [])

  const toggleFilter = (category) => {
    setActiveFilters(prev =>
      prev.includes(category)
        ? prev.filter(f => f !== category)
        : [...prev, category]
    )
  }

  const usedCategories = [...new Set(assets.map(a => a.category).filter(Boolean))]

  const searchTerm = search.trim().toLowerCase()

  const filteredAssets = assets.filter(a => {
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