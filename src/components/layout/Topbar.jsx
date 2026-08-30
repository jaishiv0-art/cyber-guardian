import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Plus, Bell, Search } from 'lucide-react'
import Button from '../common/Button.jsx'
import './Topbar.css'

const TITLES = {
  '/dashboard': ['Dashboard', 'Overview of recent activity and threat posture'],
  '/investigate': ['Investigate', 'Hand Guardian something to analyze'],
  '/history': ['History', 'Every investigation Guardian has run'],
  '/settings': ['Settings', 'Tune how Guardian works for you'],
}

export default function Topbar({ onOpenMobileNav }) {
  const location = useLocation()
  const navigate = useNavigate()
  const base = '/' + (location.pathname.split('/')[1] || 'dashboard')
  const [title, subtitle] = TITLES[base] || ['Guardian', '']

  return (
    <header className="g-topbar">
      <button className="g-topbar-menu" onClick={onOpenMobileNav} aria-label="Open navigation">
        <Menu size={20} />
      </button>

      <div className="g-topbar-heading">
        <h1 className="g-topbar-title">{title}</h1>
        <p className="g-topbar-subtitle">{subtitle}</p>
      </div>

      <div className="g-topbar-search">
        <Search size={16} />
        <input type="text" placeholder="Search past investigations…" />
        <kbd>⌘K</kbd>
      </div>

      <div className="g-topbar-actions">
        <button className="g-topbar-icon-btn" aria-label="Notifications">
          <Bell size={18} />
          <span className="g-topbar-dot" />
        </button>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => navigate('/investigate')}>
          New investigation
        </Button>
        <div className="g-topbar-avatar" title="Your account">JD</div>
      </div>
    </header>
  )
}
