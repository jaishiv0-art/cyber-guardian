import { AlertOctagon } from 'lucide-react'
import './WhatCouldHappen.css'

export default function WhatCouldHappen({ items = [] }) {
  return (
    <div className="g-wch">
      {items.map((item, i) => (
        <div key={item.id} className="g-wch-item anim-fade-up" style={{ animationDelay: `${i * 0.07}s` }}>
          <span className="g-wch-icon"><AlertOctagon size={16} /></span>
          <div>
            <span className="g-wch-title">{item.title}</span>
            <p className="g-wch-detail">{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
