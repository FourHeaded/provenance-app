import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

function Home({ user }) {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const loadAssets = async () => {
      const q = query(collection(db, 'assets'), where('uid', '==', user.uid))
      const snapshot = await getDocs(q)
      setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(a => a.itemStatus !== 'archived'))
      setLoading(false)
    }
    loadAssets()
  }, [])

  const totalValue = assets.reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0)

  const categoryBreakdown = assets.reduce((acc, a) => {
    const cat = a.category || 'Uncategorized'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  const topCategories = Object.entries(categoryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const recentAssets = [...assets]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 3)

  if (loading) return <div className="page"><p className="placeholder-text">Loading...</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Provenance</h1>
        <p className="page-subtitle">Welcome back, {user.displayName?.split(' ')[0]}</p>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-value">{assets.length}</div>
          <div className="stat-label">Total Assets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${totalValue.toLocaleString()}</div>
          <div className="stat-label">Est. Total Value</div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2 className="section-label">Quick Actions</h2>
        <div className="quick-actions">
          <button className="quick-action-btn" onClick={() => navigate('/add')}>
            <span className="quick-action-icon">+</span>
            <span>Add Asset</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/registry')}>
            <span className="quick-action-icon">≡</span>
            <span>View Registry</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/documents')}>
            <span className="quick-action-icon">📄</span>
            <span>Documents</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/reports')}>
            <span className="quick-action-icon">↗</span>
            <span>Reports</span>
          </button>
        </div>
      </div>

      {topCategories.length > 0 && (
        <div className="dashboard-section">
          <h2 className="section-label">By Category</h2>
          <div className="category-breakdown">
            {topCategories.map(([cat, count]) => (
              <div className="breakdown-row" key={cat}>
                <span className="breakdown-label">{cat}</span>
                <div className="breakdown-bar-wrap">
                  <div
                    className="breakdown-bar"
                    style={{ width: `${(count / assets.length) * 100}%` }}
                  />
                </div>
                <span className="breakdown-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentAssets.length > 0 && (
        <div className="dashboard-section">
          <h2 className="section-label">Recently Added</h2>
          <div className="recent-assets">
            {recentAssets.map(asset => (
              <div
                key={asset.id}
                className="asset-card"
                onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
              >
                <div className="asset-card-left">
                  <div className="asset-name">{asset.name}</div>
                  <div className="asset-category">{asset.category}</div>
                </div>
                <div className="asset-card-right">
                  <span className="asset-value">${asset.value}</span>
                  <span className="asset-chevron">›</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Home