import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ScanSearch, History, Settings, X, ShieldHalf } from 'lucide-react'
import GuardianCore from '../core/GuardianCore.jsx'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/investigate', label: 'Investigate', icon: ScanSearch },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  return (
    <aside className={`g-sidebar ${mobileOpen ? 'g-sidebar--open' : ''}`}>
      <div className="g-sidebar-top">
        <NavLink to="/dashboard" className="g-sidebar-brand" onClick={onCloseMobile}>
          <span className="g-sidebar-brand-mark">
            <GuardianCore state="idle" size={34} />
          </span>
          <span className="g-sidebar-brand-text">
            <span className="g-sidebar-brand-name">Guardian</span>
            <span className="g-sidebar-brand-tag">AI Security</span>
          </span>
        </NavLink>
        <button className="g-sidebar-close" onClick={onCloseMobile} aria-label="Close navigation">
          <X size={18} />
        </button>
      </div>

      <nav className="g-sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onCloseMobile}
            className={({ isActive }) => `g-sidebar-link ${isActive ? 'g-sidebar-link--active' : ''}`}
          >
            <span className="g-sidebar-link-icon"><Icon size={19} /></span>
            <span className="g-sidebar-link-text">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="g-sidebar-footer">
        <div className="g-sidebar-status">
          <span className="g-sidebar-status-dot" />
          <div className="g-sidebar-status-text">
            <span className="g-sidebar-status-title">Guardian Core online</span>
            <span className="g-sidebar-status-sub">v1.0 · monitoring</span>
          </div>
        </div>
        <div className="g-sidebar-shield">
          <ShieldHalf size={16} />
          <span>Live backend · Phase 2</span>
        </div>
      </div>
    </aside>
  )
}
