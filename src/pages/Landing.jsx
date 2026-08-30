import { useNavigate } from 'react-router-dom'
import { Link2, FileUp, Smartphone, MessageSquare, ArrowRight, ShieldCheck, Eye, Zap } from 'lucide-react'
import GuardianCore from '../components/core/GuardianCore.jsx'
import Button from '../components/common/Button.jsx'
import GlassPanel from '../components/common/GlassPanel.jsx'
import './Landing.css'

const INPUT_KINDS = [
  { icon: Link2, label: 'Links' },
  { icon: FileUp, label: 'Files' },
  { icon: Smartphone, label: 'APKs' },
  { icon: MessageSquare, label: 'Messages' },
]

const PILLARS = [
  {
    icon: Eye,
    title: 'Explains itself',
    detail: 'Every verdict comes with a WHY — the exact evidence Guardian used, in plain language.',
  },
  {
    icon: Zap,
    title: 'Investigates in seconds',
    detail: 'A multi-step agent recons, analyzes and cross-references intel live, so you watch it think.',
  },
  {
    icon: ShieldCheck,
    title: 'Shows the whole story',
    detail: 'From "what could happen" to a step-by-step attack story and a concrete defense plan.',
  },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="g-land">
      <nav className="g-land-nav">
        <div className="g-land-brand">
          <GuardianCore state="idle" size={32} />
          <span>Guardian</span>
        </div>
        <div className="g-land-nav-actions">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>Dashboard</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/investigate')}>Start investigating</Button>
        </div>
      </nav>

      <section className="g-land-hero">
        <div className="g-land-hero-copy anim-fade-up">
          <span className="g-land-eyebrow">AI security investigator</span>
          <h1 className="g-land-title">
            Before you click, open,<br /> or install it —<span className="g-land-title-accent"> ask Guardian.</span>
          </h1>
          <p className="g-land-desc">
            Guardian is an AI agent that investigates links, files, APKs and messages the way
            a security analyst would — then explains exactly why something is dangerous, what
            could happen if you didn&rsquo;t stop, and how to defend yourself.
          </p>
          <div className="g-land-cta">
            <Button variant="primary" size="lg" iconRight={<ArrowRight size={17} />} onClick={() => navigate('/investigate')}>
              Investigate something now
            </Button>
            <Button variant="ghost" size="lg" onClick={() => navigate('/dashboard')}>
              See a live dashboard
            </Button>
          </div>
          <div className="g-land-kinds">
            {INPUT_KINDS.map(({ icon: Icon, label }) => (
              <span key={label} className="g-land-kind">
                <Icon size={14} /> {label}
              </span>
            ))}
          </div>
        </div>

        <div className="g-land-hero-core anim-fade-up" style={{ animationDelay: '0.1s' }}>
          <GuardianCore state="scanning" size={320} label="Guardian Core" sublabel="analyzing in real time" />
        </div>
      </section>

      <section className="g-land-pillars">
        {PILLARS.map(({ icon: Icon, title, detail }, i) => (
          <GlassPanel key={title} className="g-land-pillar anim-fade-up" hover style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
            <div className="g-land-pillar-icon"><Icon size={20} /></div>
            <h3>{title}</h3>
            <p>{detail}</p>
          </GlassPanel>
        ))}
      </section>

      <section className="g-land-footer-cta anim-fade-up">
        <GlassPanel className="g-land-footer-panel">
          <div>
            <h2>Guardian is watching your blind spots.</h2>
            <p>Paste a link, drop a file, or forward a suspicious message — the investigation starts immediately.</p>
          </div>
          <Button variant="primary" size="lg" iconRight={<ArrowRight size={17} />} onClick={() => navigate('/investigate')}>
            Open the investigation console
          </Button>
        </GlassPanel>
      </section>

      <footer className="g-land-bottom">
        <span>Guardian — Phase 1 frontend foundation. Mock data only, no live analysis yet.</span>
      </footer>
    </div>
  )
}
