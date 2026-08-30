import { useEffect, useRef, useState } from 'react'
import { agentSteps } from '../data/constants.js'

const STEP_INTERVAL_MS = 750

/**
 * Orchestrates the Investigation page's live progress UI around a REAL
 * async backend call. The step timeline is a progress affordance only —
 * it advances on a timer up to the second-to-last step and then holds
 * there until the actual API call resolves (or fails). The verdict shown
 * afterwards is always exactly what the backend returned.
 */
export default function useInvestigationSimulation() {
  const [running, setRunning] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const timerRef = useRef(null)

  const holdIndex = agentSteps.length - 1

  function clearTimer() {
    clearInterval(timerRef.current)
    timerRef.current = null
  }

  /** @param {() => Promise<any>} task - performs the real API call and resolves with the investigation record */
  async function start(task) {
    clearTimer()
    setError(null)
    setResult(null)
    setDone(false)
    setRunning(true)
    setActiveIndex(0)

    let i = 0
    timerRef.current = setInterval(() => {
      i += 1
      if (i >= holdIndex) {
        setActiveIndex(holdIndex)
        clearTimer()
        return
      }
      setActiveIndex(i)
    }, STEP_INTERVAL_MS)

    try {
      const data = await task()
      clearTimer()
      setActiveIndex(agentSteps.length)
      setRunning(false)
      setDone(true)
      setResult(data)
      return data
    } catch (err) {
      clearTimer()
      setRunning(false)
      setDone(false)
      setError(err)
      throw err
    }
  }

  function reset() {
    clearTimer()
    setRunning(false)
    setDone(false)
    setError(null)
    setResult(null)
    setActiveIndex(-1)
  }

  useEffect(() => () => clearTimer(), [])

  return { steps: agentSteps, running, done, error, result, activeIndex, start, reset }
}
