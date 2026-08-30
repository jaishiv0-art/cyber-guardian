import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Link2, FileUp, Smartphone, MessageSquare, Inbox, AlertTriangle } from 'lucide-react'
import GlassPanel from '../components/common/GlassPanel.jsx'
import { RiskBadge } from '../components/common/Badge.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { Skeleton } from '../components/common/Skeleton.jsx'
import { getHistory } from '../services/api.js'
import './History.css'

const TYPE_ICON = { url: Link2, file: FileUp, apk: Smartphone, message: MessageSquare }
const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'url', label: 'URLs' },
  { id: 'file', label: 'Files' },
  { id: 'apk', label: 'APKs' },
  { id: 'message', label: 'Messages' },
]
const RISK_FILTERS = ['all', 'critical', 'high', 'medium', 'low', 'safe']

export default function History() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(() => {
      setLoading(true)
      setError(null)
      getHistory({ type: typeFilter, risk: riskFilter, q: query, limit: 50 })
        .then((res) => { if (!cancelled) setItems(res.data) })
        .catch((err) => { if (!cancelled) setError(err) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, query ? 300 : 0) // small debounce only when typing a search query

    return () => { cancelled = true; clearTimeout(handle) }
  }, [query, typeFilter, riskFilter])

  return (
    <div className="g-history">
      <GlassPanel className="g-history-filters anim-fade-up">
        <div className="g-history-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by target…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="g-history-filter-row">
          <div className="g-history-chip-group">
            {TYPE_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                className={`g-history-chip ${typeFilter === id ? 'g-history-chip--active' : ''}`}
                onClick={() => setTypeFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="g-history-chip-group">
            {RISK_FILTERS.map((r) => (
              <button
                key={r}
                className={`g-history-chip g-history-chip--risk ${riskFilter === r ? 'g-history-chip--active' : ''}`}
                onClick={() => setRiskFilter(r)}
              >
                {r === 'all' ? 'All risk' : r}
              </button>
            ))}
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="g-history-list-panel anim-fade-up" style={{ animationDelay: '0.05s' }}>
        {loading ? (
          <div className="g-history-loading">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} h="52px" radius="12px" />)}
          </div>
        ) : error ? (
          <EmptyState
            icon={<AlertTriangle size={22} />}
            title="Could not load history"
            detail={error.message || 'The backend may be unreachable.'}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Inbox size={22} />}
            title="No investigations match"
            detail="Try a different search term or clear your filters — or run your first investigation."
          />
        ) : (
          <div className="g-history-table">
            <div className="g-history-row g-history-row--head">
              <span>Target</span>
              <span>Type</span>
              <span>Risk</span>
              <span>Date</span>
            </div>
            {items.map((item) => {
              const Icon = TYPE_ICON[item.type] || Link2
              return (
                <button key={item.id} className="g-history-row g-history-row--body" onClick={() => navigate(`/results/${item.id}`)}>
                  <span className="g-history-target">
                    <span className="g-history-target-icon"><Icon size={14} /></span>
                    <span>
                      <span className="g-history-target-text mono">{item.target}</span>
                      <span className="g-history-target-summary">{item.summary}</span>
                    </span>
                  </span>
                  <span className="g-history-type">{item.type}</span>
                  <span><RiskBadge risk={item.risk} size="sm" /></span>
                  <span className="g-history-date mono">{new Date(item.date).toLocaleDateString()}</span>
                </button>
              )
            })}
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
