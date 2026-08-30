import { AlertTriangle, ShieldAlert, ShieldCheck, Info, HelpCircle } from 'lucide-react'
import './RiskCard.css'

const SEVERITY_META = {
  critical: { color: 'var(--risk-critical)', bg: 'var(--risk-critical-bg)', icon: ShieldAlert },
  high: { color: 'var(--risk-high)', bg: 'rgba(255,122,92,0.1)', icon: AlertTriangle },
  medium: { color: 'var(--risk-medium)', bg: 'var(--risk-medium-bg)', icon: AlertTriangle },
  low: { color: 'var(--risk-low)', bg: 'rgba(123,224,201,0.1)', icon: Info },
  safe: { color: 'var(--risk-safe)', bg: 'var(--risk-safe-bg)', icon: ShieldCheck },
}

export default function RiskCard({ title, severity, detail, onWhy }) {
  const meta = SEVERITY_META[severity] || SEVERITY_META.medium
  const Icon = meta.icon

  return (
    <div className="g-riskcard">
      <span className="g-riskcard-icon" style={{ color: meta.color, background: meta.bg }}>
        <Icon size={16} />
      </span>
      <div className="g-riskcard-body">
        <div className="g-riskcard-top">
          <span className="g-riskcard-title">{title}</span>
          <span className="g-riskcard-severity" style={{ color: meta.color }}>{severity}</span>
        </div>
        <p className="g-riskcard-detail">{detail}</p>
      </div>
      {onWhy && (
        <button className="g-riskcard-why" onClick={onWhy}>
          <HelpCircle size={14} /> Why?
        </button>
      )}
    </div>
  )
}
