import './EmptyState.css'

export default function EmptyState({ icon, title, detail, action }) {
  return (
    <div className="g-empty anim-fade-up">
      {icon && <div className="g-empty-icon">{icon}</div>}
      <h3 className="g-empty-title">{title}</h3>
      {detail && <p className="g-empty-detail">{detail}</p>}
      {action && <div className="g-empty-action">{action}</div>}
    </div>
  )
}
