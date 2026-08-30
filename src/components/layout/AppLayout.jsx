import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import './AppLayout.css'

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="g-shell">
      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
      <div className="g-shell-main">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="g-shell-content">
          <Outlet />
        </main>
      </div>
      {mobileNavOpen && <div className="g-shell-scrim" onClick={() => setMobileNavOpen(false)} />}
    </div>
  )
}
