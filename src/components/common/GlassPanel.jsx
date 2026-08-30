import './GlassPanel.css'

export default function GlassPanel({ children, className = '', hover = false, as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`g-panel ${hover ? 'g-panel--hover' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  )
}
