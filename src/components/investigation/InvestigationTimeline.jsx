import { Check, Loader2 } from 'lucide-react'
import './InvestigationTimeline.css'

export default function InvestigationTimeline({ steps, activeIndex, done }) {
  return (
    <ol className="g-timeline">
      {steps.map((step, i) => {
        const isComplete = done || i < activeIndex
        const isActive = !done && i === activeIndex
        const isPending = !done && i > activeIndex

        return (
          <li
            key={step.id}
            className={`g-timeline-item ${isComplete ? 'g-timeline-item--done' : ''} ${isActive ? 'g-timeline-item--active' : ''} ${isPending ? 'g-timeline-item--pending' : ''}`}
          >
            <span className="g-timeline-marker">
              {isComplete ? <Check size={13} /> : isActive ? <Loader2 size={13} className="g-timeline-spin" /> : <span className="g-timeline-dot" />}
            </span>
            <span className="g-timeline-body">
              <span className="g-timeline-label">{step.label}</span>
              <span className="g-timeline-detail">{step.detail}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
