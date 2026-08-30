import { Radar } from 'lucide-react'
import { trackingClassificationMeta } from '../../data/constants.js'
import './TrackingExplanationPanel.css'

export default function TrackingExplanationPanel({ tracking }) {
  if (!tracking) return null

  if (!tracking.applicable) {
    return (
      <div className="g-trackx g-trackx--na">
        <span className="g-trackx-icon"><Radar size={16} /></span>
        <div>
          <span className="g-trackx-title">Ads & tracking explanation</span>
          <p className="g-trackx-na-text">{tracking.notApplicableReason || 'No tracking-related evidence applies to this investigation.'}</p>
        </div>
      </div>
    )
  }

  const meta = trackingClassificationMeta[tracking.classification] ?? trackingClassificationMeta.normal_advertising

  return (
    <div className="g-trackx">
      <div className="g-trackx-head">
        <span className="g-trackx-icon"><Radar size={16} /></span>
        <span className="g-trackx-title">Ads & tracking explanation</span>
        <span className="g-trackx-badge" style={{ color: meta.color, borderColor: `color-mix(in srgb, ${meta.color} 40%, transparent)` }}>{meta.label}</span>
      </div>
      {tracking.summary && <p className="g-trackx-summary">{tracking.summary}</p>}
      {tracking.indicators?.length > 0 && (
        <ul className="g-trackx-list">
          {tracking.indicators.map((ind, i) => <li key={i}>{ind}</li>)}
        </ul>
      )}
    </div>
  )
}
