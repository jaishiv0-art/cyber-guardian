import { CheckCircle2, MinusCircle } from 'lucide-react'
import './AgentActivityTimeline.css'

export default function AgentActivityTimeline({ activity }) {
  if (!activity || activity.length === 0) return null

  return (
    <div className="g-agentact">
      {activity.map((a) => (
        <div key={a.agent} className={`g-agentact-row ${a.ran ? 'g-agentact-row--ran' : 'g-agentact-row--skipped'}`}>
          <span className="g-agentact-icon">
            {a.ran ? <CheckCircle2 size={15} /> : <MinusCircle size={15} />}
          </span>
          <div className="g-agentact-body">
            <span className="g-agentact-label">{a.label}</span>
            <span className="g-agentact-reason">{a.ran ? 'Ran \u2014 relevant evidence was found.' : a.reason}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
