import { ShieldCheck } from 'lucide-react'
import './DefenseSection.css'

export default function DefenseSection({ items = [] }) {
  return (
    <div className="g-defense">
      {items.map((item, i) => (
        <div key={item.id} className="g-defense-item anim-fade-up" style={{ animationDelay: `${i * 0.07}s` }}>
          <span className="g-defense-icon"><ShieldCheck size={16} /></span>
          <div>
            <span className="g-defense-action">{item.action}</span>
            <p className="g-defense-detail">{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
