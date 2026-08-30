import './Badge.css'
import { riskMeta } from '../../data/constants.js'

export function RiskBadge({ risk, size = 'md' }) {
  const meta = riskMeta[risk] || riskMeta.medium
  return (
    <span
      className={`g-badge g-badge--${size}`}
      style={{ color: meta.color, background: meta.bg, borderColor: `color-mix(in srgb, ${meta.color} 40%, transparent)` }}
    >
      <span className="g-badge-dot" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

export function Tag({ children }) {
  return <span className="g-tag">{children}</span>
}
