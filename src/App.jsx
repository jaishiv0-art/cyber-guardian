import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import Landing from './pages/Landing.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Investigation from './pages/Investigation.jsx'
import Results from './pages/Results.jsx'
import History from './pages/History.jsx'
import Settings from './pages/Settings.jsx'
import { VoiceSettingsProvider } from './contexts/VoiceSettingsContext.jsx'

export default function App() {
  return (
    <VoiceSettingsProvider>
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/investigate" element={<Investigation />} />
          <Route path="/results/:id" element={<Results />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </VoiceSettingsProvider>
  )
}
