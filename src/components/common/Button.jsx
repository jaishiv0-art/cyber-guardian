import './Button.css'

export default function Button({
  children,
  variant = 'primary', // primary | secondary | ghost | danger
  size = 'md', // sm | md | lg
  icon,
  iconRight,
  full = false,
  ...rest
}) {
  return (
    <button
      className={`g-btn g-btn--${variant} g-btn--${size} ${full ? 'g-btn--full' : ''}`}
      {...rest}
    >
      {icon && <span className="g-btn-icon">{icon}</span>}
      <span>{children}</span>
      {iconRight && <span className="g-btn-icon g-btn-icon--right">{iconRight}</span>}
    </button>
  )
}
