import { useEffect, useRef } from 'react'
import { Volume2, VolumeX, Play, Pause, Square, RotateCcw, AlertTriangle } from 'lucide-react'
import { useVoiceSettings } from '../../contexts/VoiceSettingsContext.jsx'
import { useVoiceNarration } from '../../hooks/useVoiceNarration.js'
import { buildVoiceScript } from '../../services/voiceScript.js'
import './VoiceBriefingPanel.css'

/**
 * Sits on the Results page. Reads the SAME investigation record already
 * rendered on screen — it never fetches anything on its own — and either
 * plays it automatically (if Voice is ON in Settings) once the
 * investigation is fully loaded, or waits for the user to press Play.
 *
 * This is the only place in the frontend that talks to speechSynthesis;
 * turning Voice off, navigating away, or the browser not supporting
 * speech all resolve here without touching the rest of the Results page.
 */
export default function VoiceBriefingPanel({ record }) {
  const { enabled, voiceURI, rate } = useVoiceSettings()
  const { status, supported, errorMessage, speak, pause, resume, stop, replay } = useVoiceNarration({ voiceURI, rate })
  const autoPlayedForId = useRef(null)
  const wasEnabled = useRef(enabled)

  const script = record ? buildVoiceScript(record) : []
  const hasContent = script.length > 0

  // Auto-play exactly once per investigation, and only if the user has
  // Voice turned on in Settings. Default is OFF, so by default this
  // effect never speaks — matching "must not automatically speak" unless
  // explicitly enabled.
  useEffect(() => {
    if (!enabled || !supported || !hasContent || !record?.id) return
    if (autoPlayedForId.current === record.id) return
    autoPlayedForId.current = record.id
    speak(script)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, supported, hasContent, record?.id])

  // "If Voice is switched OFF while speech is playing: STOP CURRENT
  // SPEECH. Do not start it again automatically."
  useEffect(() => {
    if (wasEnabled.current && !enabled) stop()
    wasEnabled.current = enabled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  if (!hasContent) return null

  function handlePrimaryPlay() {
    if (status === 'ended' || status === 'idle' || status === 'error') speak(script)
  }

  return (
    <div className="g-voice">
      <div className="g-voice-head">
        <span className="g-voice-icon">
          {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </span>
        <div className="g-voice-head-text">
          <span className="g-voice-title">Voice briefing</span>
          <span className="g-voice-status">{statusLabel(status, enabled)}</span>
        </div>
      </div>

      {!supported || status === 'error' ? (
        <div className="g-voice-unavailable">
          <AlertTriangle size={14} />
          <span>{errorMessage || 'Voice briefing unavailable on this browser. The full explanation is available on screen.'}</span>
        </div>
      ) : (
        <div className="g-voice-controls">
          {(status === 'idle' || status === 'ended') && (
            <button className="g-voice-btn g-voice-btn--primary" onClick={handlePrimaryPlay}>
              <Play size={14} /> {status === 'ended' ? 'Play again' : 'Play briefing'}
            </button>
          )}
          {status === 'speaking' && (
            <button className="g-voice-btn" onClick={pause}>
              <Pause size={14} /> Pause
            </button>
          )}
          {status === 'paused' && (
            <button className="g-voice-btn g-voice-btn--primary" onClick={resume}>
              <Play size={14} /> Resume
            </button>
          )}
          {(status === 'speaking' || status === 'paused') && (
            <button className="g-voice-btn" onClick={stop}>
              <Square size={13} /> Stop
            </button>
          )}
          {status !== 'idle' && (
            <button className="g-voice-btn g-voice-btn--ghost" onClick={replay}>
              <RotateCcw size={13} /> Replay
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function statusLabel(status, enabled) {
  switch (status) {
    case 'speaking':
      return 'Speaking…'
    case 'paused':
      return 'Paused'
    case 'ended':
      return 'Briefing finished'
    case 'unsupported':
      return 'Not supported on this browser'
    case 'error':
      return 'Playback error'
    default:
      return enabled ? 'Voice is on — plays automatically' : 'Voice is off — play manually anytime'
  }
}
