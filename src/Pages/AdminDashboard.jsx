import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { ADMIN_UID, isAdmin } from '../admin'

// __APP_VERSION__ is injected by vite.config.js at build time
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
const ENV = import.meta.env.MODE

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '—' }
}

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch { return '—' }
}

function daysAgo(iso) {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
}

function shortUid(uid) {
  if (!uid) return '—'
  return uid.slice(0, 8) + '…'
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card admin-stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function AdminDashboard({ user }) {
  const allowed = isAdmin(user)

  const [loading, setLoading]   = useState(true)
  const [users, setUsers]       = useState([])
  const [assets, setAssets]     = useState([])
  const [invites, setInvites]   = useState([])
  const [search, setSearch]     = useState('')
  const [savingUid, setSavingUid] = useState(null)
  const [apiTest, setApiTest]   = useState(null)
  const [apiTesting, setApiTesting] = useState(false)

  useEffect(() => {
    // Defense in depth: never query the cross-user collections
    // unless the current user is the configured admin.
    if (!allowed) return
    const load = async () => {
      try {
        const [usersSnap, assetsSnap, invitesSnap] = await Promise.all([
          getDocs(collection(db, 'userSettings')),
          getDocs(collection(db, 'assets')),
          getDocs(collection(db, 'invites')),
        ])
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setAssets(assetsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setInvites(invitesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error('Admin load failed:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [allowed])

  // ── Computed metrics ──
  const assetCountByUid = useMemo(() => {
    const map = {}
    assets.forEach(a => { map[a.uid] = (map[a.uid] || 0) + 1 })
    return map
  }, [assets])

  const newUsers7d   = useMemo(() => users.filter(u => daysAgo(u.createdAt) <= 7).length, [users])
  const newAssets7d  = useMemo(() => assets.filter(a => {
    const created = a.createdAt?.toDate ? a.createdAt.toDate().toISOString() : a.createdAt
    return daysAgo(typeof created === 'string' ? created : created?.toISOString?.()) <= 7
  }).length, [assets])

  const avgAssetsPerUser = users.length > 0
    ? (assets.length / users.length).toFixed(1)
    : '0'

  const categoryBreakdown = useMemo(() => {
    const map = {}
    assets.forEach(a => {
      const cat = a.category || 'Uncategorized'
      map[cat] = (map[cat] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [assets])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      u.email?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.uid?.toLowerCase().includes(q)
    )
  }, [users, search])

  const recentAssets = useMemo(() => {
    const getCreated = (a) => {
      const c = a.createdAt
      if (!c) return 0
      if (c.toDate) return c.toDate().getTime()
      return new Date(c).getTime()
    }
    return [...assets].sort((a, b) => getCreated(b) - getCreated(a)).slice(0, 20)
  }, [assets])

  const recentInvites = useMemo(() => {
    const getCreated = (i) => {
      const c = i.createdAt
      if (!c) return 0
      if (c.toDate) return c.toDate().getTime()
      return new Date(c).getTime()
    }
    return [...invites].sort((a, b) => getCreated(b) - getCreated(a)).slice(0, 20)
  }, [invites])

  const userByUid = useMemo(() => {
    const map = {}
    users.forEach(u => { map[u.uid] = u })
    return map
  }, [users])

  // ── Actions ──
  const handleTogglePremium = async (userDoc) => {
    setSavingUid(userDoc.uid)
    const newValue = !userDoc.isPremium
    await updateDoc(doc(db, 'userSettings', userDoc.id), { isPremium: newValue })
    setUsers(prev => prev.map(u => u.id === userDoc.id ? { ...u, isPremium: newValue } : u))
    setSavingUid(null)
  }

  const handleTestAPI = async () => {
    setApiTesting(true)
    setApiTest(null)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 30,
          messages: [{ role: 'user', content: 'Reply with one word: PONG' }],
        }),
      })
      const data = await res.json()
      if (res.ok && data.content?.[0]?.text) {
        setApiTest({ ok: true, response: data.content[0].text.trim() })
      } else {
        setApiTest({ ok: false, error: data.error?.message || `HTTP ${res.status}` })
      }
    } catch (e) {
      setApiTest({ ok: false, error: e.message })
    } finally {
      setApiTesting(false)
    }
  }

  // Access guard — placed AFTER all hooks to satisfy rules-of-hooks.
  // Non-admin users are silently redirected to home.
  if (!allowed) return <Navigate to="/" replace />

  if (loading) return <div className="page"><p className="placeholder-text">Loading admin data...</p></div>

  const maxCategoryCount = categoryBreakdown[0]?.[1] || 1

  return (
    <div className="page admin-page">
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">Operator dashboard</p>
      </div>

      {/* ── Stats ── */}
      <div className="admin-stats-grid">
        <StatCard label="Total Users" value={users.length} />
        <StatCard label="Total Assets" value={assets.length} />
        <StatCard label="New Users (7d)" value={newUsers7d} />
        <StatCard label="New Assets (7d)" value={newAssets7d} />
        <StatCard label="Avg Assets / User" value={avgAssetsPerUser} />
        <StatCard label="Total Invites" value={invites.length} />
      </div>

      {/* ── Category Breakdown ── */}
      {categoryBreakdown.length > 0 && (
        <section className="admin-section">
          <h2 className="section-label">Assets by Category</h2>
          <div className="admin-category-bars">
            {categoryBreakdown.map(([cat, count]) => (
              <div key={cat} className="admin-category-row">
                <span className="admin-category-label">{cat}</span>
                <div className="admin-category-bar-wrap">
                  <div
                    className="admin-category-bar"
                    style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                  />
                </div>
                <span className="admin-category-count">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Users ── */}
      <section className="admin-section">
        <div className="admin-section-header">
          <h2 className="section-label">Users ({filteredUsers.length})</h2>
        </div>
        <input
          className="admin-search"
          placeholder="Search by name, email, or UID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="admin-table admin-table--users">
          <div className="admin-table-head">
            <div className="admin-col-name">Name</div>
            <div className="admin-col-email">Email</div>
            <div className="admin-col-uid">UID</div>
            <div className="admin-col-num">Assets</div>
            <div className="admin-col-date">Created</div>
            <div className="admin-col-date">Last Login</div>
            <div className="admin-col-plan">Plan</div>
          </div>
          {filteredUsers.length === 0 ? (
            <div className="admin-empty">No users match this search.</div>
          ) : (
            filteredUsers.map(u => (
              <div key={u.id} className="admin-table-row">
                <div className="admin-col-name" title={u.displayName}>{u.displayName || '—'}</div>
                <div className="admin-col-email" title={u.email}>{u.email || '—'}</div>
                <div className="admin-col-uid" title={u.uid}>{shortUid(u.uid)}</div>
                <div className="admin-col-num">{assetCountByUid[u.uid] || 0}</div>
                <div className="admin-col-date">{formatDate(u.createdAt)}</div>
                <div className="admin-col-date">{formatDate(u.lastLogin)}</div>
                <div className="admin-col-plan">
                  <button
                    className={`admin-plan-toggle ${u.isPremium ? 'admin-plan-toggle--premium' : 'admin-plan-toggle--free'}`}
                    onClick={() => handleTogglePremium(u)}
                    disabled={savingUid === u.uid}
                    title="Click to toggle premium"
                  >
                    {savingUid === u.uid ? '...' : (u.isPremium ? 'Premium' : 'Free')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Recent Assets ── */}
      <section className="admin-section">
        <h2 className="section-label">Recent Assets ({recentAssets.length})</h2>
        <div className="admin-table admin-table--assets">
          <div className="admin-table-head">
            <div className="admin-col-name">Name</div>
            <div className="admin-col-cat">Category</div>
            <div className="admin-col-num">Value</div>
            <div className="admin-col-email">Owner</div>
            <div className="admin-col-date">Created</div>
          </div>
          {recentAssets.length === 0 ? (
            <div className="admin-empty">No assets yet.</div>
          ) : (
            recentAssets.map(a => {
              const owner = userByUid[a.uid]
              const created = a.createdAt?.toDate ? a.createdAt.toDate().toISOString() : a.createdAt
              return (
                <div key={a.id} className="admin-table-row">
                  <div className="admin-col-name" title={a.name}>{a.name}</div>
                  <div className="admin-col-cat">{a.category || '—'}</div>
                  <div className="admin-col-num">{a.value ? `$${a.value}` : '—'}</div>
                  <div className="admin-col-email" title={owner?.email || a.uid}>
                    {owner?.email || shortUid(a.uid)}
                  </div>
                  <div className="admin-col-date">{formatDate(created)}</div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* ── Recent Invites ── */}
      <section className="admin-section">
        <h2 className="section-label">Recent Invites ({recentInvites.length})</h2>
        <div className="admin-table admin-table--invites">
          <div className="admin-table-head">
            <div className="admin-col-email">Owner</div>
            <div className="admin-col-email">Invited</div>
            <div className="admin-col-cat">Relationship</div>
            <div className="admin-col-plan">Status</div>
            <div className="admin-col-date">Created</div>
          </div>
          {recentInvites.length === 0 ? (
            <div className="admin-empty">No invites yet.</div>
          ) : (
            recentInvites.map(i => {
              const owner = userByUid[i.registryOwnerUid]
              const created = i.createdAt?.toDate ? i.createdAt.toDate().toISOString() : i.createdAt
              return (
                <div key={i.id} className="admin-table-row">
                  <div className="admin-col-email" title={owner?.email || i.registryOwnerUid}>
                    {owner?.email || i.ownerName || shortUid(i.registryOwnerUid)}
                  </div>
                  <div className="admin-col-email" title={i.invitedEmail}>{i.invitedEmail}</div>
                  <div className="admin-col-cat">{i.relationship || '—'}</div>
                  <div className="admin-col-plan">
                    <span className={`invite-status invite-status--${i.status || 'pending'}`}>
                      {i.status || 'pending'}
                    </span>
                  </div>
                  <div className="admin-col-date">{formatDate(created)}</div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* ── System ── */}
      <section className="admin-section">
        <h2 className="section-label">System</h2>
        <div className="admin-system">
          <div className="admin-system-row">
            <span className="admin-system-label">Environment</span>
            <span className={`admin-env-badge admin-env-badge--${ENV}`}>{ENV}</span>
          </div>
          <div className="admin-system-row">
            <span className="admin-system-label">App Version</span>
            <span className="admin-system-value">v{APP_VERSION}</span>
          </div>
          <div className="admin-system-row">
            <span className="admin-system-label">Admin UID</span>
            <span className="admin-system-value admin-system-value--mono">{shortUid(ADMIN_UID)}</span>
          </div>
          <div className="admin-system-row">
            <span className="admin-system-label">Anthropic API</span>
            <button
              className="admin-system-test-btn"
              onClick={handleTestAPI}
              disabled={apiTesting}
            >
              {apiTesting ? 'Testing...' : 'Test connection'}
            </button>
          </div>
          {apiTest && (
            <div className={`admin-api-result ${apiTest.ok ? 'admin-api-result--ok' : 'admin-api-result--err'}`}>
              {apiTest.ok ? `✓ ${apiTest.response}` : `✗ ${apiTest.error}`}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default AdminDashboard
