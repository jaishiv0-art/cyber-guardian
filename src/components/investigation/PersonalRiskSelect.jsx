import { personalContexts } from '../../data/constants.js'
import './PersonalRiskSelect.css'

export default function PersonalRiskSelect({ value, onChange, disabled }) {
  return (
    <div className="g-prisk">
      <div className="g-prisk-head">
        <span className="g-prisk-label">Personal context</span>
        <span className="g-prisk-hint">Personalizes the explanation only — never changes the risk score</span>
      </div>
      <div className="g-prisk-chips" role="radiogroup" aria-label="Personal risk context">
        {personalContexts.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            disabled={disabled}
            className={`g-prisk-chip ${value === id ? 'g-prisk-chip--active' : ''}`}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
