import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react'
import { canUseItMeta } from '../../data/constants.js'
import './CanUseItBanner.css'

const ICONS = {
  safe_to_use: ShieldCheck,
  use_with_caution: ShieldQuestion,
  avoid_if_possible: ShieldAlert,
  do_not_use: ShieldX,
}

export default function CanUseItBanner({ canUseIt }) {
  if (!canUseIt || !canUseIt.applicable) return null
  const meta = canUseItMeta[canUseIt.verdict] ?? canUseItMeta.use_with_caution
  const Icon = ICONS[canUseIt.verdict] ?? ShieldQuestion

  return (
    <div className="g-canuse" style={{ borderColor: `color-mix(in srgb, ${meta.color} 35%, transparent)`, background: `color-mix(in srgb, ${meta.color} 8%, transparent)` }}>
      <span className="g-canuse-icon" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 16%, transparent)` }}>
        <Icon size={20} />
      </span>
      <div className="g-canuse-body">
        <span className="g-canuse-verdict" style={{ color: meta.color }}>{meta.label}</span>
        <p className="g-canuse-explanation">{canUseIt.explanation}</p>
      </div>
      {canUseIt.source && <span className="g-canuse-source">{canUseIt.source === 'ai' ? 'AI-explained' : 'Template-explained'}</span>}
    </div>
  )
}
