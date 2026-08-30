import './ScoreCard.css'

function scoreColor(score) {
  if (score >= 75) return 'var(--risk-safe)'
  if (score >= 50) return 'var(--core-cyan)'
  if (score >= 30) return 'var(--risk-medium)'
  return 'var(--risk-critical)'
}

export default function ScoreCard({ icon: Icon, label, score, description }) {
  const color = scoreColor(score)
  return (
    <div className="g-scorecard">
      <div className="g-scorecard-head">
        <span className="g-scorecard-icon" style={{ color }}><Icon size={17} /></span>
        <span className="g-scorecard-label">{label}</span>
        <span className="g-scorecard-value" style={{ color }}>{score}</span>
      </div>
      <div className="g-scorecard-bar">
        <div className="g-scorecard-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      {description && <p className="g-scorecard-desc">{description}</p>}
    </div>
  )
}
