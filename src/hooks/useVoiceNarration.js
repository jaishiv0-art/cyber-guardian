import { useCallback, useEffect, useRef, useState } from 'react'
import { pickDefaultVoice } from '../services/voicePreferences.js'

// Phase 4 — voice briefing playback engine. This hook is intentionally
// "dumb": it only ever speaks the exact segments handed to it by the
// caller (see src/services/voiceScript.js) — it never fetches data, never
// decides what to say, and has no concept of risk or findings. That keeps
// the "voice never independently investigates" invariant structural
// rather than just a convention.
//
// Browser SpeechSynthesis quirks this hook works around:
// - getVoices() can return [] until the async 'voiceschanged' event fires.
// - Calling speak() while something is already speaking queues instead of
//   replacing, which sounds like overlapping voices — every speak() call
//   here cancels first.
// - pause()/resume() operate on the whole queue, not a single utterance,
//   which is exactly the "Play/Pause/Resume/Stop/Replay" model the spec
//   asks for.

const SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined'

export function isVoiceSupported() {
  return SUPPORTED
}

/**
 * @returns {{
 *   status: 'idle'|'speaking'|'paused'|'ended'|'error'|'unsupported',
 *   supported: boolean,
 *   errorMessage: string|null,
 *   speak: (segments: string[]) => void,
 *   pause: () => void,
 *   resume: () => void,
 *   stop: () => void,
 *   replay: () => void,
 * }}
 */
export function useVoiceNarration({ voiceURI, rate = 1 } = {}) {
  const [status, setStatus] = useState(SUPPORTED ? 'idle' : 'unsupported')
  const [errorMessage, setErrorMessage] = useState(null)
  const segmentsRef = useRef([])
  const utteranceCountRef = useRef(0)
  const endedCountRef = useRef(0)

  // Always cancel any in-flight speech when this component unmounts (e.g.
  // navigating away from Results mid-briefing) — never let speech keep
  // going for a screen the user has left.
  useEffect(() => {
    return () => {
      if (SUPPORTED) window.speechSynthesis.cancel()
    }
  }, [])

  const stop = useCallback(() => {
    if (!SUPPORTED) return
    window.speechSynthesis.cancel()
    setStatus('idle')
  }, [])

  const speak = useCallback(
    (segments) => {
      if (!SUPPORTED) {
        setStatus('unsupported')
        return
      }
      const clean = (segments || []).filter((s) => typeof s === 'string' && s.trim().length > 0)
      if (clean.length === 0) return

      // Prevent overlapping speech: always cancel whatever is queued first.
      window.speechSynthesis.cancel()
      segmentsRef.current = clean
      setErrorMessage(null)
      utteranceCountRef.current = clean.length
      endedCountRef.current = 0

      const voices = window.speechSynthesis.getVoices()
      // If the user picked a specific voice in Settings, respect it exactly.
      // Otherwise, don't just leave this to the browser's own default (which
      // is often whichever voice happens to be first in the list, and can
      // sound flat/robotic) — actively pick the best-sounding female voice
      // available on this system.
      const chosenVoice = voiceURI
        ? voices.find((v) => v.voiceURI === voiceURI) || null
        : pickDefaultVoice(voices)

      clean.forEach((text, i) => {
        const utterance = new window.SpeechSynthesisUtterance(text)
        utterance.rate = Math.min(2, Math.max(0.5, rate || 1))
        if (chosenVoice) utterance.voice = chosenVoice

        utterance.onend = () => {
          endedCountRef.current += 1
          if (endedCountRef.current >= utteranceCountRef.current) {
            setStatus('ended')
          }
        }
        utterance.onerror = (event) => {
          // 'interrupted' / 'canceled' fire on our own stop()/replay() calls
          // — that's expected, not a real failure.
          if (event.error === 'interrupted' || event.error === 'canceled') return
          setStatus('error')
          setErrorMessage('Voice briefing unavailable. The full explanation is available on screen.')
        }

        window.speechSynthesis.speak(utterance)
      })

      setStatus('speaking')
    },
    [voiceURI, rate]
  )

  const pause = useCallback(() => {
    if (!SUPPORTED) return
    window.speechSynthesis.pause()
    setStatus('paused')
  }, [])

  const resume = useCallback(() => {
    if (!SUPPORTED) return
    window.speechSynthesis.resume()
    setStatus('speaking')
  }, [])

  const replay = useCallback(() => {
    if (segmentsRef.current.length > 0) speak(segmentsRef.current)
  }, [speak])

  return { status, supported: SUPPORTED, errorMessage, speak, pause, resume, stop, replay }
}
