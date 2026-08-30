import './AttackStory.css'

export default function AttackStory({ steps = [] }) {
  if (steps.length === 0) {
    return <p className="g-story-empty">No attack sequence applies — Guardian found nothing exploitable here.</p>
  }

  return (
    <div className="g-story">
      {steps.map((step, i) => (
        <div key={step.id} className="g-story-step anim-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="g-story-step-marker">
            <span className="g-story-step-num mono">{String(i + 1).padStart(2, '0')}</span>
            {i < steps.length - 1 && <span className="g-story-step-line" />}
          </div>
          <div className="g-story-step-body">
            <span className="g-story-step-title">{step.title}</span>
            <p className="g-story-step-detail">{step.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
