import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Lock, Eye, Radar, HelpCircle, RefreshCcw,
  Link2, FileUp, Smartphone, MessageSquare, Target, Gauge, BadgeCheck, ExternalLink, Download,
} from 'lucide-react'
import GlassPanel from '../components/common/GlassPanel.jsx'
import Button from '../components/common/Button.jsx'
import { RiskBadge } from '../components/common/Badge.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { SkeletonCard } from '../components/common/Skeleton.jsx'
import GuardianCore from '../components/core/GuardianCore.jsx'
import RiskMeter from '../components/results/RiskMeter.jsx'
import ScoreCard from '../components/results/ScoreCard.jsx'
import RiskCard from '../components/results/RiskCard.jsx'
import WhyDrawer from '../components/results/WhyDrawer.jsx'
import WhatCouldHappen from '../components/results/WhatCouldHappen.jsx'
import AttackStory from '../components/results/AttackStory.jsx'
import DefenseSection from '../components/results/DefenseSection.jsx'
import CanUseItBanner from '../components/results/CanUseItBanner.jsx'
import PrivacyExplanationPanel from '../components/results/PrivacyExplanationPanel.jsx'
import TrackingExplanationPanel from '../components/results/TrackingExplanationPanel.jsx'
import AgentActivityTimeline from '../components/results/AgentActivityTimeline.jsx'
import VoiceBriefingPanel from '../components/voice/VoiceBriefingPanel.jsx'
import { getInvestigation, getInvestigationReportUrl } from '../services/api.js'
import './Results.css'

const TYPE_ICON = { url: Link2, file: FileUp, apk: Smartphone, message: MessageSquare }
const CORE_STATE = { safe: 'safe', low: 'safe', medium: 'warning', high: 'danger', critical: 'danger' }

export default function Results() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [whyOpen, setWhyOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getInvestigation(id)
      .then((data) => { if (!cancelled) setResult(data) })
      .catch((err) => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="g-results">
        <div className="g-results-skeleton-grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <GlassPanel>
        <EmptyState
          icon={<Target size={22} />}
          title={error?.code === 'INVESTIGATION_NOT_FOUND' ? 'Investigation not found' : 'Could not load this report'}
          detail={error?.message || 'This investigation may not exist, or the backend is unreachable.'}
          action={<Button variant="primary" onClick={() => navigate('/investigate')}>Start a new investigation</Button>}
        />
      </GlassPanel>
    )
  }

  const TypeIcon = TYPE_ICON[result.type] || Link2

  return (
    <div className="g-results">
      <button className="g-results-back" onClick={() => navigate('/history')}>
        <ArrowLeft size={15} /> Back to history
      </button>

      <GlassPanel className="g-results-header anim-fade-up">
        <div className="g-results-header-left">
          <span className="g-results-type-icon"><TypeIcon size={18} /></span>
          <div>
            <div className="g-results-header-top">
              <RiskBadge risk={result.risk} />
              <span className="g-results-date">{new Date(result.date).toLocaleString()}</span>
            </div>
            <h1 className="g-results-target mono">{result.target}</h1>
            <p className="g-results-verdict">{result.verdictHeadline}</p>
          </div>
        </div>
        <div className="g-results-header-actions">
          <a
            className="g-btn g-btn--secondary g-btn--sm"
            href={getInvestigationReportUrl(result.id)}
            target="_blank"
            rel="noreferrer"
          >
            <span className="g-btn-icon"><Download size={15} /></span>
            <span>Download report</span>
          </a>
          <Button variant="secondary" size="sm" icon={<HelpCircle size={15} />} onClick={() => setWhyOpen(true)}>
            Why this verdict
          </Button>
          <Button variant="primary" size="sm" icon={<RefreshCcw size={15} />} onClick={() => navigate('/investigate')}>
            New investigation
          </Button>
        </div>
      </GlassPanel>

      {result.aiExplanation?.canUseIt && (
        <div className="anim-fade-up">
          <CanUseItBanner canUseIt={result.aiExplanation.canUseIt} />
        </div>
      )}

      <div className="anim-fade-up">
        <VoiceBriefingPanel record={result} />
      </div>


      <section className="g-results-overview">
        <GlassPanel className="g-results-meter-panel anim-fade-up">
          <span className="g-results-panel-label">Overall risk</span>
          <RiskMeter score={result.overallScore} risk={result.risk} />
          <GuardianCore state={CORE_STATE[result.risk] || 'idle'} size={64} />
        </GlassPanel>

        <GlassPanel className="g-results-scores-panel anim-fade-up" style={{ animationDelay: '0.06s' }}>
          <span className="g-results-panel-label">Dimension scores</span>
          <div className="g-results-scores-grid">
            <ScoreCard icon={Lock} label="Security" score={result.scores.security} description="Resistance to exploitation or compromise." />
            <ScoreCard icon={Eye} label="Privacy" score={result.scores.privacy} description="How well your personal data is protected." />
            <ScoreCard icon={Radar} label="Tracking" score={result.scores.tracking} description="Freedom from covert tracking or profiling." />
          </div>
        </GlassPanel>
      </section>

      <section className="g-results-metastats anim-fade-up">
        <GlassPanel className="g-results-metastat">
          <span className="g-results-metastat-icon"><Gauge size={15} /></span>
          <div>
            <span className="g-results-metastat-value">{result.threatProbability}%</span>
            <span className="g-results-metastat-label">Threat probability</span>
          </div>
        </GlassPanel>
        <GlassPanel className="g-results-metastat">
          <span className="g-results-metastat-icon"><Target size={15} /></span>
          <div>
            <span className="g-results-metastat-value">{result.potentialImpact}</span>
            <span className="g-results-metastat-label">Potential impact</span>
          </div>
        </GlassPanel>
        <GlassPanel className="g-results-metastat">
          <span className="g-results-metastat-icon"><BadgeCheck size={15} /></span>
          <div>
            <span className="g-results-metastat-value">{result.confidence}%</span>
            <span className="g-results-metastat-label">Confidence</span>
          </div>
        </GlassPanel>
        {result.meta?.vt?.permalink && (
          <a className="g-results-vt-link" href={result.meta.vt.permalink} target="_blank" rel="noreferrer">
            View on VirusTotal <ExternalLink size={13} />
          </a>
        )}
      </section>

      <section className="g-results-section anim-fade-up">
        <h2 className="g-results-section-title">Risk findings</h2>
        <div className="g-results-riskcards">
          {result.riskCards.map((card) => (
            <RiskCard key={card.id} title={card.title} severity={card.severity} detail={card.detail} onWhy={() => setWhyOpen(true)} />
          ))}
        </div>
      </section>

      <section className="g-results-section anim-fade-up">
        <h2 className="g-results-section-title">Privacy &amp; tracking</h2>
        <div className="g-results-explain-grid">
          <PrivacyExplanationPanel privacy={result.aiExplanation?.privacy} />
          <TrackingExplanationPanel tracking={result.aiExplanation?.tracking} />
        </div>
      </section>

      <section className="g-results-section anim-fade-up">
        <h2 className="g-results-section-title">What could happen</h2>
        <WhatCouldHappen items={result.whatCouldHappen} />
      </section>

      <section className="g-results-section anim-fade-up">
        <h2 className="g-results-section-title">Attack story</h2>
        <GlassPanel className="g-results-story-panel">
          <AttackStory steps={result.attackStory} />
        </GlassPanel>
      </section>

      <section className="g-results-section anim-fade-up">
        <h2 className="g-results-section-title">Defense — what to do now</h2>
        <DefenseSection items={result.defense} />
      </section>

      {result.aiExplanation?.agentActivity && (
        <section className="g-results-section anim-fade-up">
          <h2 className="g-results-section-title">Agent activity</h2>
          <GlassPanel className="g-results-agentactivity-panel">
            <AgentActivityTimeline activity={result.aiExplanation.agentActivity} />
          </GlassPanel>
        </section>
      )}

      <WhyDrawer
        open={whyOpen}
        onClose={() => setWhyOpen(false)}
        why={result.why}
        verdictHeadline={result.aiExplanation?.security?.summary || result.verdictHeadline}
      />
    </div>
  )
}
