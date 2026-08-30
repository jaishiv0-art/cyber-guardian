import GuardianCore from '../core/GuardianCore.jsx'
import './AgentVisualization.css'

export default function AgentVisualization({ steps, activeIndex, running, done }) {
  const current = steps[activeIndex]
  const state = done ? 'safe' : running ? 'scanning' : 'idle'

  return (
    <div className="g-agentviz">
      <GuardianCore
        state={state}
        size={168}
        label={done ? 'Investigation complete' : running ? 'Guardian is investigating' : 'Guardian Core'}
        sublabel={done ? 'verdict ready' : running ? current?.label : 'awaiting input'}
      />
      <div className="g-agentviz-progress">
        <div className="g-agentviz-bar">
          <div
            className="g-agentviz-bar-fill"
            style={{ width: `${done ? 100 : running ? Math.max(6, (activeIndex / steps.length) * 100) : 0}%` }}
          />
        </div>
        <span className="g-agentviz-progress-label mono">
          {done ? '6 / 6 steps' : running ? `${activeIndex + 1} / ${steps.length} steps` : 'idle'}
        </span>
      </div>
    </div>
  )
}
