import { X, Sparkles } from 'lucide-react'
import './WhyDrawer.css'

export default function WhyDrawer({ open, onClose, why = [], verdictHeadline }) {
  return (
    <>
      <div className={`g-why-scrim ${open ? 'g-why-scrim--open' : ''}`} onClick={onClose} />
      <aside className={`g-why-drawer ${open ? 'g-why-drawer--open' : ''}`} aria-hidden={!open}>
        <div className="g-why-head">
          <div className="g-why-head-title">
            <span className="g-why-head-icon"><Sparkles size={16} /></span>
            <h3>Why this verdict</h3>
          </div>
          <button className="g-why-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {verdictHeadline && <p className="g-why-headline">{verdictHeadline}</p>}

        <div className="g-why-list">
          {why.map((w, i) => (
            <div key={w.id} className="g-why-item anim-fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
              <span className="g-why-item-index mono">{String(i + 1).padStart(2, '0')}</span>
              <div className="g-why-item-body">
                <span className="g-why-item-claim">{w.claim}</span>
                <p className="g-why-item-evidence">{w.evidence}</p>
              </div>
            </div>
          ))}
          {why.length === 0 && (
            <p className="g-why-empty">No specific risk evidence was flagged for this investigation.</p>
          )}
        </div>
      </aside>
    </>
  )
}
