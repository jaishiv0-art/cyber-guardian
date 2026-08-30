import { useEffect, useState } from 'react'
import { riskMeta } from '../../data/constants.js'
import './RiskMeter.css'

const SIZE = 200
const STROKE = 14
const RADIUS = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * RADIUS

export default function RiskMeter({ score, risk }) {
  const meta = riskMeta[risk] || riskMeta.medium
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 150)
    return () => clearTimeout(t)
  }, [score])

  const offset = CIRC - (animated / 100) * CIRC

  return (
    <div className="g-riskmeter">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={meta.color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{
            transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)',
            filter: `drop-shadow(0 0 10px ${meta.color}88)`,
          }}
        />
      </svg>
      <div className="g-riskmeter-center">
        <span className="g-riskmeter-score">{score}</span>
        <span className="g-riskmeter-max">/ 100</span>
        <span className="g-riskmeter-tag" style={{ color: meta.color }}>{meta.label}</span>
      </div>
    </div>
  )
}
