import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// Phase 4 — Voice briefing settings, shared between the Settings page and
// the Results page. This is the ONLY new piece of cross-page state Phase 4
// introduces; every other Settings section is untouched and keeps its
// existing local-only behavior. Persisted to localStorage (not the backend
// investigation store — this is a device/browser preference, not
// investigation data) so the ON/OFF choice survives a reload.
//
// Default is OFF, per spec: Guardian must never speak automatically unless
// the user has explicitly turned voice on.

const STORAGE_KEY = 'guardian:voiceSettings'

const DEFAULTS = {
  enabled: false,
  voiceURI: '', // '' = auto-pick a natural female voice, see voicePreferences.js
  rate: 0.95, // 0.75 - 1.5, SpeechSynthesisUtterance.rate — slightly under 1x
  // reads clearer for a first-time listener than the raw browser default,
  // without dragging (still user-adjustable in Settings).
}

function loadInitial() {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return {
      enabled: Boolean(parsed.enabled),
      voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : DEFAULTS.voiceURI,
      rate: typeof parsed.rate === 'number' && parsed.rate >= 0.5 && parsed.rate <= 2 ? parsed.rate : DEFAULTS.rate,
    }
  } catch {
    return DEFAULTS
  }
}

const VoiceSettingsContext = createContext(null)

export function VoiceSettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadInitial)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Private-browsing / storage-disabled — voice still works for this
      // session, it just won't remember the preference next visit.
    }
  }, [settings])

  const setEnabled = useCallback((enabled) => setSettings((s) => ({ ...s, enabled: Boolean(enabled) })), [])
  const setVoiceURI = useCallback((voiceURI) => setSettings((s) => ({ ...s, voiceURI: voiceURI || '' })), [])
  const setRate = useCallback((rate) => setSettings((s) => ({ ...s, rate: Number(rate) })), [])

  return (
    <VoiceSettingsContext.Provider value={{ ...settings, setEnabled, setVoiceURI, setRate }}>
      {children}
    </VoiceSettingsContext.Provider>
  )
}

export function useVoiceSettings() {
  const ctx = useContext(VoiceSettingsContext)
  if (!ctx) throw new Error('useVoiceSettings must be used within a VoiceSettingsProvider')
  return ctx
}
