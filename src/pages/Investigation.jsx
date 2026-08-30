import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, RefreshCcw, AlertTriangle } from 'lucide-react'
import GlassPanel from '../components/common/GlassPanel.jsx'
import Button from '../components/common/Button.jsx'
import InvestigationInput from '../components/investigation/InvestigationInput.jsx'
import AgentVisualization from '../components/investigation/AgentVisualization.jsx'
import InvestigationTimeline from '../components/investigation/InvestigationTimeline.jsx'
import useInvestigationSimulation from '../hooks/useInvestigationSimulation.js'
import { analyzeUrl, analyzeMessage, analyzeFile, analyzeApk } from '../services/api.js'
import './Investigation.css'

export default function Investigation() {
  const navigate = useNavigate()
  const { steps, running, done, error, result, activeIndex, start, reset } = useInvestigationSimulation()
  const [subject, setSubject] = useState(null)
  const runSectionRef = useRef(null)

  // As soon as an investigation starts (subject goes from null to set), bring
  // the run panel into view automatically — without this, on smaller screens
  // it renders below the input panel and the user has to scroll down
  // manually to see the agent working. Offset accounts for the sticky
  // topbar (72px) so the panel isn't tucked underneath it.
  useEffect(() => {
    if (!subject || !runSectionRef.current) return
    const TOPBAR_OFFSET = 72 + 16
    const top = runSectionRef.current.getBoundingClientRect().top + window.scrollY - TOPBAR_OFFSET
    window.scrollTo({ top, behavior: 'smooth' })
  }, [subject])

  async function handleInvestigate({ type, target, file, personalContext }) {
    setSubject({ type, target })
    try {
      await start(() => {
        if (type === 'url') return analyzeUrl(target, personalContext)
        if (type === 'message') return analyzeMessage(target, personalContext)
        if (type === 'file') return analyzeFile(file, personalContext)
        if (type === 'apk') return analyzeApk(file, personalContext)
        throw new Error('Unknown investigation type')
      })
    } catch {
      // Error state is already captured by the hook — nothing further to do here.
    }
  }

  function handleReset() {
    reset()
    setSubject(null)
  }

  function handleViewReport() {
    if (result?.id) navigate(`/results/${result.id}`)
  }

  return (
    <div className="g-invpage">
      <section className="g-invpage-top anim-fade-up">
        <GlassPanel className="g-invpage-input-panel">
          <div className="g-invpage-input-head">
            <h2>What should Guardian look into?</h2>
            <p>Pick a type, add the target, and Guardian will run a full multi-step investigation.</p>
          </div>
          <InvestigationInput disabled={running} onInvestigate={handleInvestigate} />
        </GlassPanel>
      </section>

      {subject && (
        <section className="g-invpage-run anim-fade-up" ref={runSectionRef}>
          <GlassPanel className="g-invpage-core-panel">
            <AgentVisualization steps={steps} activeIndex={activeIndex} running={running} done={done} />

            {error ? (
              <div className="g-invpage-error">
                <span className="g-invpage-error-icon"><AlertTriangle size={16} /></span>
                <div>
                  <span className="g-invpage-error-title">
                    {error.code === 'NETWORK_ERROR' ? 'Could not reach the backend' : 'Investigation failed'}
                  </span>
                  <p className="g-invpage-error-detail">{error.message}</p>
                </div>
              </div>
            ) : done ? (
              <div className="g-invpage-done-actions">
                <Button variant="secondary" icon={<RefreshCcw size={15} />} onClick={handleReset}>
                  New investigation
                </Button>
                <Button variant="primary" iconRight={<ArrowRight size={16} />} onClick={handleViewReport}>
                  View full report
                </Button>
              </div>
            ) : (
              <div className="g-invpage-target">
                <span className="g-invpage-target-label">Investigating</span>
                <span className="g-invpage-target-value mono">{subject.target}</span>
              </div>
            )}

            {error && (
              <Button variant="secondary" icon={<RefreshCcw size={15} />} onClick={handleReset}>
                Try again
              </Button>
            )}
          </GlassPanel>

          <GlassPanel className="g-invpage-timeline-panel">
            <h3>Investigation timeline</h3>
            <InvestigationTimeline steps={steps} activeIndex={activeIndex} done={done} />
          </GlassPanel>
        </section>
      )}
    </div>
  )
}
