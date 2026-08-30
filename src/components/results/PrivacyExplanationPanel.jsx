import { Eye, CheckCircle2, HelpCircle } from 'lucide-react'
import './PrivacyExplanationPanel.css'

export default function PrivacyExplanationPanel({ privacy }) {
  if (!privacy) return null

  if (!privacy.applicable) {
    return (
      <div className="g-privacyx g-privacyx--na">
        <span className="g-privacyx-icon"><Eye size={16} /></span>
        <div>
          <span className="g-privacyx-title">Privacy explanation</span>
          <p className="g-privacyx-na-text">{privacy.notApplicableReason || 'No privacy-related evidence applies to this investigation.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="g-privacyx">
      <div className="g-privacyx-head">
        <span className="g-privacyx-icon"><Eye size={16} /></span>
        <span className="g-privacyx-title">Privacy explanation</span>
      </div>
      {privacy.summary && <p className="g-privacyx-summary">{privacy.summary}</p>}

      <div className="g-privacyx-cols">
        <div className="g-privacyx-col">
          <span className="g-privacyx-col-head"><HelpCircle size={13} /> Permission exists</span>
          {privacy.permissionExists?.length > 0 ? (
            <ul>{privacy.permissionExists.map((p, i) => <li key={i}>{p}</li>)}</ul>
          ) : (
            <p className="g-privacyx-empty">None observed.</p>
          )}
        </div>
        <div className="g-privacyx-col">
          <span className="g-privacyx-col-head"><CheckCircle2 size={13} /> Confirmed data collection</span>
          {privacy.confirmedDataCollection?.length > 0 ? (
            <ul>{privacy.confirmedDataCollection.map((p, i) => <li key={i}>{p}</li>)}</ul>
          ) : (
            <p className="g-privacyx-empty">Not confirmed {'\u2014'} static analysis can see permissions, not proof of actual data transmission.</p>
          )}
        </div>
      </div>
    </div>
  )
}
