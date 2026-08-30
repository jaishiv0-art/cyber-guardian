import { useEffect, useState } from 'react'
import { Bell, Shield, Palette, KeyRound, Trash2, Volume2 } from 'lucide-react'
import GlassPanel from '../components/common/GlassPanel.jsx'
import Button from '../components/common/Button.jsx'
import { useVoiceSettings } from '../contexts/VoiceSettingsContext.jsx'
import { isVoiceSupported, useVoiceNarration } from '../hooks/useVoiceNarration.js'
import { clearHistory } from '../services/api.js'
import './Settings.css'

function Toggle({ checked, onChange }) {
  return (
    <button className={`g-toggle ${checked ? 'g-toggle--on' : ''}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
      <span className="g-toggle-thumb" />
    </button>
  )
}

function useAvailableVoices() {
  const [voices, setVoices] = useState([])

  useEffect(() => {
    if (!isVoiceSupported()) return
    function refresh() {
      setVoices(window.speechSynthesis.getVoices())
    }
    refresh()
    window.speechSynthesis.addEventListener('voiceschanged', refresh)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh)
  }, [])

  return voices
}

export default function Settings() {
  const [notif, setNotif] = useState({ critical: true, weekly: true, product: false })
  const [autoScan, setAutoScan] = useState(true)
  const [strictMode, setStrictMode] = useState(false)
  const [clearState, setClearState] = useState('idle') // idle | confirming | clearing | done | error

  const voice = useVoiceSettings()
  const voices = useAvailableVoices()
  const voiceSupported = isVoiceSupported()
  const preview = useVoiceNarration({ voiceURI: voice.voiceURI, rate: voice.rate })
  const previewing = preview.status === 'speaking' || preview.status === 'paused'

  function handlePreviewVoice() {
    if (previewing) {
      preview.stop()
      return
    }
    preview.speak(['Hi, this is how Cyber Guardian will sound when it briefs you after an investigation.'])
  }

  async function handleClearHistory() {
    if (clearState !== 'confirming') {
      setClearState('confirming')
      return
    }
    setClearState('clearing')
    try {
      await clearHistory()
      setClearState('done')
    } catch {
      setClearState('error')
    }
  }

  return (
    <div className="g-settings">
      <GlassPanel className="g-settings-section anim-fade-up">
        <div className="g-settings-section-head">
          <span className="g-settings-icon"><Bell size={17} /></span>
          <div>
            <h2>Notifications</h2>
            <p>Choose when Guardian should interrupt you.</p>
          </div>
        </div>
        <div className="g-settings-rows">
          <div className="g-settings-row">
            <div>
              <span className="g-settings-row-title">Critical findings</span>
              <p className="g-settings-row-desc">Get notified immediately when a critical-risk item is found.</p>
            </div>
            <Toggle checked={notif.critical} onChange={(v) => setNotif((s) => ({ ...s, critical: v }))} />
          </div>
          <div className="g-settings-row">
            <div>
              <span className="g-settings-row-title">Weekly summary</span>
              <p className="g-settings-row-desc">A digest of everything Guardian investigated this week.</p>
            </div>
            <Toggle checked={notif.weekly} onChange={(v) => setNotif((s) => ({ ...s, weekly: v }))} />
          </div>
          <div className="g-settings-row">
            <div>
              <span className="g-settings-row-title">Product updates</span>
              <p className="g-settings-row-desc">Occasional news about new Guardian capabilities.</p>
            </div>
            <Toggle checked={notif.product} onChange={(v) => setNotif((s) => ({ ...s, product: v }))} />
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="g-settings-section anim-fade-up" style={{ animationDelay: '0.05s' }}>
        <div className="g-settings-section-head">
          <span className="g-settings-icon"><Shield size={17} /></span>
          <div>
            <h2>Investigation behavior</h2>
            <p>Control how Guardian analyzes what you give it.</p>
          </div>
        </div>
        <div className="g-settings-rows">
          <div className="g-settings-row">
            <div>
              <span className="g-settings-row-title">Auto-scan pasted links</span>
              <p className="g-settings-row-desc">Start investigating the moment a URL is pasted, without pressing Investigate.</p>
            </div>
            <Toggle checked={autoScan} onChange={setAutoScan} />
          </div>
          <div className="g-settings-row">
            <div>
              <span className="g-settings-row-title">Strict mode</span>
              <p className="g-settings-row-desc">Flag borderline cases as medium risk instead of low risk.</p>
            </div>
            <Toggle checked={strictMode} onChange={setStrictMode} />
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="g-settings-section anim-fade-up" style={{ animationDelay: '0.08s' }}>
        <div className="g-settings-section-head">
          <span className="g-settings-icon"><Volume2 size={17} /></span>
          <div>
            <h2>Voice briefing</h2>
            <p>A spoken summary of a finished investigation — never a second investigator, just narration of the result already on screen.</p>
          </div>
        </div>
        <div className="g-settings-rows">
          <div className="g-settings-row">
            <div>
              <span className="g-settings-row-title">Voice briefing</span>
              <p className="g-settings-row-desc">
                {voiceSupported
                  ? 'When on, Guardian speaks a short briefing automatically once an investigation finishes. Default is off — you can always play it manually from the Results page.'
                  : 'Your browser does not support speech synthesis, so voice briefings are unavailable here.'}
              </p>
            </div>
            <Toggle checked={voice.enabled} onChange={voice.setEnabled} />
          </div>

          {voiceSupported && (
            <>
              <div className="g-settings-row">
                <div>
                  <span className="g-settings-row-title">Voice</span>
                  <p className="g-settings-row-desc">Which system voice narrates the briefing.</p>
                </div>
                <select
                  className="g-settings-select"
                  value={voice.voiceURI}
                  onChange={(e) => voice.setVoiceURI(e.target.value)}
                >
                  <option value="">Automatic — best female voice available</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} {v.lang ? `(${v.lang})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="g-settings-row">
                <div>
                  <span className="g-settings-row-title">Speaking speed</span>
                  <p className="g-settings-row-desc">Slower can be easier to follow for a first-time listener.</p>
                </div>
                <div className="g-settings-rate-control">
                  <input
                    type="range"
                    min="0.75"
                    max="1.5"
                    step="0.05"
                    value={voice.rate}
                    onChange={(e) => voice.setRate(e.target.value)}
                  />
                  <span className="mono">{voice.rate.toFixed(2)}x</span>
                </div>
              </div>
              <div className="g-settings-row">
                <div>
                  <span className="g-settings-row-title">Preview</span>
                  <p className="g-settings-row-desc">Hear the selected voice and speed before turning briefings on.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handlePreviewVoice}>
                  {previewing ? 'Stop' : 'Preview voice'}
                </Button>
              </div>
            </>
          )}
        </div>
      </GlassPanel>

      <GlassPanel className="g-settings-section anim-fade-up" style={{ animationDelay: '0.14s' }}>
        <div className="g-settings-section-head">
          <span className="g-settings-icon"><Palette size={17} /></span>
          <div>
            <h2>Appearance</h2>
            <p>Guardian is designed for a dark, low-glare environment.</p>
          </div>
        </div>
        <div className="g-settings-theme-row">
          <div className="g-settings-theme-card g-settings-theme-card--active">
            <span className="g-settings-theme-swatch g-settings-theme-swatch--void" />
            <span>Void (default)</span>
          </div>
          <div className="g-settings-theme-card g-settings-theme-card--disabled">
            <span className="g-settings-theme-swatch g-settings-theme-swatch--light" />
            <span>Light — coming soon</span>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="g-settings-section anim-fade-up" style={{ animationDelay: '0.18s' }}>
        <div className="g-settings-section-head">
          <span className="g-settings-icon"><KeyRound size={17} /></span>
          <div>
            <h2>API access</h2>
            <p>Connect Guardian to your own tools once the backend is live.</p>
          </div>
        </div>
        <div className="g-settings-api-row">
          <span className="g-settings-api-key mono">gk_live_•••• •••• •••• 8f21</span>
          <Button variant="secondary" size="sm">Reveal</Button>
          <Button variant="ghost" size="sm">Regenerate</Button>
        </div>
        <p className="g-settings-row-desc">This key is a placeholder — API access activates in a later phase.</p>
      </GlassPanel>

      <GlassPanel className="g-settings-section g-settings-danger anim-fade-up" style={{ animationDelay: '0.22s' }}>
        <div className="g-settings-section-head">
          <span className="g-settings-icon g-settings-icon--danger"><Trash2 size={17} /></span>
          <div>
            <h2>Danger zone</h2>
            <p>Clear investigation history stored for this account. This cannot be undone.</p>
          </div>
        </div>
        {clearState === 'done' ? (
          <p className="g-settings-row-desc">History cleared.</p>
        ) : clearState === 'error' ? (
          <>
            <p className="g-settings-row-desc">Could not clear history — the backend may be unreachable. Try again.</p>
            <Button variant="danger" size="sm" onClick={handleClearHistory}>Retry</Button>
          </>
        ) : clearState === 'confirming' ? (
          <div className="g-settings-danger-confirm">
            <span className="g-settings-row-desc">Are you sure? This permanently deletes every stored investigation.</span>
            <div className="g-settings-danger-confirm-actions">
              <Button variant="danger" size="sm" onClick={handleClearHistory}>Yes, clear everything</Button>
              <Button variant="ghost" size="sm" onClick={() => setClearState('idle')}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={handleClearHistory} disabled={clearState === 'clearing'}>
            {clearState === 'clearing' ? 'Clearing…' : 'Clear all investigation history'}
          </Button>
        )}
      </GlassPanel>
    </div>
  )
}
