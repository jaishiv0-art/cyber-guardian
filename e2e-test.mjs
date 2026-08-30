import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import fs from 'node:fs'

const LOG = '/tmp/e2e-results.log'
fs.writeFileSync(LOG, '')
function log(line) {
  try { fs.appendFileSync(LOG, line + '\n') } catch {}
  console.log(line)
}

function waitForPort(url, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url)
        if (res.ok || res.status < 500) return resolve()
      } catch {}
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`))
      setTimeout(tick, 300)
    }
    tick()
  })
}

let backend, frontend, browser
const results = []
const check = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra })
  log(`${cond ? 'PASS' : 'FAIL'} - ${name}${extra ? ' :: ' + extra : ''}`)
}

async function run() {
  backend = spawn('node', ['src/server.js'], { cwd: '/home/claude/project/guardian/server', stdio: 'ignore' })
  frontend = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { cwd: '/home/claude/project/guardian', stdio: 'ignore' })
  await waitForPort('http://localhost:4000/api/health')
  await waitForPort('http://localhost:5173/')
  log('servers up')

  browser = await chromium.launch()
  const page = await browser.newPage()
  page.setDefaultTimeout(8000)
  const consoleErrors = []
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message))

  await page.addInitScript(() => {
    window.__speakLog = []
    class FakeUtterance extends EventTarget {
      constructor(text) { super(); this.text = text; this.rate = 1; this.voice = null; this.onend = null; this.onerror = null }
    }
    const fakeSynth = {
      _paused: false, speaking: false, pending: false,
      speak(u) {
        window.__speakLog.push('speak:' + u.text)
        this.speaking = true
        setTimeout(() => { if (this._paused) return; this.speaking = false; if (u.onend) u.onend() }, 400)
      },
      cancel() { window.__speakLog.push('cancel'); this.speaking = false; this._paused = false },
      pause() { window.__speakLog.push('pause'); this._paused = true },
      resume() { window.__speakLog.push('resume'); this._paused = false },
      getVoices() { return [{ voiceURI: 'v1', name: 'Test Voice', lang: 'en-US' }] },
      addEventListener() {}, removeEventListener() {},
    }
    // `speechSynthesis` is typically a non-configurable getter inherited
    // from the Window prototype in real Chromium — plain assignment is
    // silently ignored, so real (audio-less, headless) speech synthesis
    // would fire instead of this mock. Object.defineProperty forces the
    // override so we can assert on the app's actual call sequence.
    Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true, writable: true })
    window.SpeechSynthesisUtterance = FakeUtterance
  })

  // ---- Investigate -> Results -------------------------------------------
  await page.goto('http://localhost:5173/investigate', { waitUntil: 'domcontentloaded' })
  const urlInput = page.locator('input.g-inv-url-input')
  await urlInput.waitFor({ timeout: 5000 })
  await urlInput.fill('http://paypal.account-verify-secure.tk/login/verify')

  const submitBtn = page.getByRole('button', { name: /^investigate$/i })
  await submitBtn.waitFor({ timeout: 5000 })
  await submitBtn.click()

  // The Investigate page runs a step-progress simulation around the real
  // API call, then shows a "View full report" button — it does not
  // auto-navigate. Wait for that button, then click through to Results.
  const viewReportBtn = page.getByRole('button', { name: /view full report/i })
  await viewReportBtn.waitFor({ timeout: 15000 })
  await viewReportBtn.click()

  await page.waitForURL(/\/results\//, { timeout: 8000 })
  check('Navigated to Results page after investigation', page.url().includes('/results/'))
  await page.waitForTimeout(700)

  const bodyText = await page.locator('body').innerText()
  check('Results shows MEDIUM risk', /medium/i.test(bodyText))
  check('Results shows Can I Use It verdict', /use with caution|avoid|safe to use|do not use/i.test(bodyText))
  check('Results shows Voice briefing panel', /voice briefing/i.test(bodyText))
  check('Results shows Download report button', /download report/i.test(bodyText))
  check('Results shows Attack Story', /attack story|the lure/i.test(bodyText))
  check('No page errors on Results', consoleErrors.length === 0, consoleErrors.join(' | '))

  // ---- Voice controls: default OFF, manual play/pause/resume/stop/replay
  const speakBeforePlay = await page.evaluate(() => window.__speakLog.slice())
  // Note: React.StrictMode (dev-only) double-invokes effects, which can
  // produce a harmless stray `cancel()` from the hook's unmount-cleanup
  // effect. The actual requirement is "must not automatically speak" —
  // so we assert on the absence of speak() calls specifically, not on an
  // empty log.
  check(
    'Voice OFF by default: no auto-speak',
    speakBeforePlay.filter((l) => l.startsWith('speak:')).length === 0,
    JSON.stringify(speakBeforePlay)
  )

  const playBtn = page.getByRole('button', { name: /play briefing/i })
  await playBtn.waitFor({ timeout: 5000 })
  await playBtn.click()
  await page.waitForTimeout(150)
  const afterPlay = await page.evaluate(() => window.__speakLog.slice())
  check('Play triggers speak()', afterPlay.some((l) => l.startsWith('speak:')), JSON.stringify(afterPlay))

  const pauseBtn = page.getByRole('button', { name: /^pause$/i })
  if (await pauseBtn.count()) {
    await pauseBtn.click()
    await page.waitForTimeout(80)
    const afterPause = await page.evaluate(() => window.__speakLog.slice())
    check('Pause calls speechSynthesis.pause()', afterPause.includes('pause'), JSON.stringify(afterPause))
    const resumeBtn = page.getByRole('button', { name: /^resume$/i })
    await resumeBtn.click()
    await page.waitForTimeout(80)
    const afterResume = await page.evaluate(() => window.__speakLog.slice())
    check('Resume calls speechSynthesis.resume()', afterResume.includes('resume'), JSON.stringify(afterResume))
  } else {
    check('Pause control appears mid-speech', false, 'utterances finished before pause could be clicked (timing)')
  }

  await page.waitForTimeout(2000)
  const replayBtn = page.getByRole('button', { name: /replay/i })
  await replayBtn.waitFor({ timeout: 5000 })
  await page.evaluate(() => { window.__speakLog = [] })
  await replayBtn.click()
  await page.waitForTimeout(150)
  const afterReplay = await page.evaluate(() => window.__speakLog.slice())
  check('Replay cancels then re-speaks (no overlap)', afterReplay[0] === 'cancel' && afterReplay.some((l) => l.startsWith('speak:')), JSON.stringify(afterReplay))

  const stopBtn = page.getByRole('button', { name: /^stop$/i })
  if (await stopBtn.count()) {
    await stopBtn.click()
    await page.waitForTimeout(80)
    const afterStop = await page.evaluate(() => window.__speakLog.slice())
    check('Stop calls speechSynthesis.cancel()', afterStop.includes('cancel'), JSON.stringify(afterStop))
  }

  // ---- Report download link -------------------------------------------
  const reportHref = await page.locator('a:has-text("Download report")').getAttribute('href')
  check('Report link targets /investigation/:id/report', /\/api\/investigation\/.+\/report/.test(reportHref || ''), reportHref)
  const reportResp = await page.request.get(reportHref)
  check('Report link downloads a real PDF', reportResp.headers()['content-type'] === 'application/pdf', reportResp.headers()['content-type'])

  // ---- Settings: Voice section present, toggle works, danger zone works
  await page.goto('http://localhost:5173/settings', { waitUntil: 'domcontentloaded' })
  const settingsText = await page.locator('body').innerText()
  check('Settings shows Voice briefing section', /voice briefing/i.test(settingsText))
  check('Settings preserves Notifications section', /notifications/i.test(settingsText))
  check('Settings preserves Danger zone section', /danger zone/i.test(settingsText))

  const voiceToggle = page.locator('.g-settings-row', { hasText: 'Voice briefing' }).locator('.g-toggle').first()
  await voiceToggle.click()
  await page.waitForTimeout(80)

  await page.goto('http://localhost:5173/investigate', { waitUntil: 'domcontentloaded' })
  const urlInput2 = page.locator('input.g-inv-url-input')
  await urlInput2.waitFor({ timeout: 5000 })
  await urlInput2.fill('https://www.wikipedia.org')
  await page.evaluate(() => { window.__speakLog = [] })
  await page.getByRole('button', { name: /^investigate$/i }).click()
  const viewReportBtn2 = page.getByRole('button', { name: /view full report/i })
  await viewReportBtn2.waitFor({ timeout: 15000 })
  await viewReportBtn2.click()
  await page.waitForURL(/\/results\//, { timeout: 8000 })
  await page.waitForTimeout(900)
  const autoSpeak = await page.evaluate(() => window.__speakLog.slice())
  check('Voice ON: briefing auto-plays after investigation completes', autoSpeak.some((l) => l.startsWith('speak:')), JSON.stringify(autoSpeak))

  await page.goto('http://localhost:5173/settings', { waitUntil: 'domcontentloaded' })
  const clearBtn = page.getByRole('button', { name: /clear all investigation history/i })
  await clearBtn.click()
  await page.waitForTimeout(120)
  const confirmBtn = page.getByRole('button', { name: /yes, clear everything/i })
  check('Danger zone requires confirmation step', await confirmBtn.count() > 0)
  await confirmBtn.click()
  await page.waitForTimeout(400)
  const afterClearText = await page.locator('body').innerText()
  check('History cleared confirmation shown', /history cleared/i.test(afterClearText))

  log('\n=== SUMMARY ===')
  const failed = results.filter((r) => !r.pass)
  log(`${results.length - failed.length}/${results.length} passed`)
  failed.forEach((f) => log('FAIL: ' + f.name + ' :: ' + f.extra))
  return failed.length === 0
}

let ok = false
try {
  ok = await run()
} catch (err) {
  log('TEST SCRIPT ERROR: ' + (err?.message || err))
} finally {
  log('cleaning up...')
  try { if (browser) await browser.close() } catch {}
  try { if (backend) backend.kill('SIGKILL') } catch {}
  try { if (frontend) frontend.kill('SIGKILL') } catch {}
  log('cleanup done')
}
process.exit(ok ? 0 : 1)
