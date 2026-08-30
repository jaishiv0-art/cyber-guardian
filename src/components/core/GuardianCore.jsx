import './GuardianCore.css'

/**
 * GuardianCore — the visual identity of the app.
 * A living orb that reflects the AI agent's state.
 *
 * state: 'idle' | 'scanning' | 'safe' | 'warning' | 'danger'
 * size:  px diameter
 */
export default function GuardianCore({ state = 'idle', size = 220, label, sublabel }) {
  return (
    <div
      className="g-core"
      data-state={state}
      style={{ '--core-size': `${size}px` }}
      role="img"
      aria-label={`Guardian Core, status: ${state}`}
    >
      <div className="g-core-halo" />
      <div className="g-core-ring g-core-ring--outer" />
      <div className="g-core-ring g-core-ring--mid" />

      <div className="g-core-orbit g-core-orbit--a">
        <span className="g-core-node" />
      </div>
      <div className="g-core-orbit g-core-orbit--b">
        <span className="g-core-node" />
      </div>
      <div className="g-core-orbit g-core-orbit--c">
        <span className="g-core-node" />
      </div>

      <div className="g-core-nucleus">
        <div className="g-core-nucleus-core" />
        <div className="g-core-scanline" />
      </div>

      {(label || sublabel) && (
        <div className="g-core-caption">
          {label && <span className="g-core-label">{label}</span>}
          {sublabel && <span className="g-core-sublabel">{sublabel}</span>}
        </div>
      )}
    </div>
  )
}
