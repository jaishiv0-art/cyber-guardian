import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Activity, Timer, TrendingUp, ArrowUpRight, ArrowRight, Link2, FileUp, Smartphone, MessageSquare, Inbox } from 'lucide-react'
import GlassPanel from '../components/common/GlassPanel.jsx'
import Button from '../components/common/Button.jsx'
import { RiskBadge } from '../components/common/Badge.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { Skeleton } from '../components/common/Skeleton.jsx'
import GuardianCore from '../components/core/GuardianCore.jsx'
import { getHistory } from '../services/api.js'
import './Dashboard.css'

const TYPE_ICON = { url: Link2, file: FileUp, apk: Smartphone, message: MessageSquare }

function relativeTime(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const hrs = Math.round(diffMs / 3.6e6)
  if (hrs < 1) return 'just now'
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [recent, setRecent] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getHistory({ limit: 5 })
      .then((res) => {
        if (cancelled) return
        setRecent(res.data)
        setStats(res.stats)
      })
      .catch((err) => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const STAT_CARDS = stats
    ? [
        { icon: Activity, label: 'Investigations run', value: stats.total },
        { icon: ShieldCheck, label: 'Threats blocked', value: stats.threatsBlocked },
        { icon: Timer, label: 'Avg. response time', value: `${stats.avgResponseSeconds}s` },
        { icon: TrendingUp, label: 'Guardian trust score', value: `${stats.trustScore}%` },
      ]
    : []

  return (
    <div className="g-dash">
      <section className="g-dash-hero anim-fade-up">
        <GlassPanel className="g-dash-hero-panel">
          <div className="g-dash-hero-text">
            <span className="g-dash-hero-eyebrow">Guardian Core status</span>
            <h2>All systems monitoring. Ready when you are.</h2>
            <p>Drop in a link, file, APK, or message and Guardian will run a full multi-step investigation, live.</p>
            <Button variant="primary" onClick={() => navigate('/investigate')} iconRight={<ArrowRight size={16} />}>
              Start a new investigation
            </Button>
          </div>
          <div className="g-dash-hero-core">
            <GuardianCore state="idle" size={140} />
          </div>
        </GlassPanel>
      </section>

      <section className="g-dash-stats">
        {loading
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} h="98px" radius="20px" />)
          : STAT_CARDS.map(({ icon: Icon, label, value }, i) => (
              <GlassPanel key={label} hover className="g-dash-stat anim-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="g-dash-stat-top">
                  <span className="g-dash-stat-icon"><Icon size={16} /></span>
                </div>
                <span className="g-dash-stat-value">{value}</span>
                <span className="g-dash-stat-label">{label}</span>
              </GlassPanel>
            ))}
      </section>

      <section className="g-dash-grid">
        <GlassPanel className="g-dash-recent">
          <div className="g-dash-panel-head">
            <h3>Recent investigations</h3>
            <button className="g-dash-viewall" onClick={() => navigate('/history')}>
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="g-dash-recent-list">
            {loading ? (
              [0, 1, 2].map((i) => <Skeleton key={i} h="60px" radius="12px" />)
            ) : error ? (
              <EmptyState icon={<Inbox size={22} />} title="Could not load recent activity" detail={error.message} />
            ) : recent.length === 0 ? (
              <EmptyState
                icon={<Inbox size={22} />}
                title="No investigations yet"
                detail="Run your first investigation to see it appear here."
                action={<Button variant="primary" size="sm" onClick={() => navigate('/investigate')}>Investigate something</Button>}
              />
            ) : (
              recent.map((item) => {
                const Icon = TYPE_ICON[item.type] || Link2
                return (
                  <button key={item.id} className="g-dash-recent-row" onClick={() => navigate(`/results/${item.id}`)}>
                    <span className="g-dash-recent-icon"><Icon size={16} /></span>
                    <span className="g-dash-recent-main">
                      <span className="g-dash-recent-target mono">{item.target}</span>
                      <span className="g-dash-recent-summary">{item.summary}</span>
                    </span>
                    <span className="g-dash-recent-meta">
                      <RiskBadge risk={item.risk} size="sm" />
                      <span className="g-dash-recent-time">{relativeTime(item.date)}</span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </GlassPanel>

        <GlassPanel className="g-dash-tip">
          <h3>Quick investigate</h3>
          <p className="g-dash-tip-desc">Skip the console — jump straight into a specific analysis type.</p>
          <div className="g-dash-tip-grid">
            {[
              { icon: Link2, label: 'Check a link' },
              { icon: FileUp, label: 'Scan a file' },
              { icon: Smartphone, label: 'Scan an APK' },
              { icon: MessageSquare, label: 'Analyze a message' },
            ].map(({ icon: Icon, label }) => (
              <button key={label} className="g-dash-tip-btn" onClick={() => navigate('/investigate')}>
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </GlassPanel>
      </section>
    </div>
  )
}
