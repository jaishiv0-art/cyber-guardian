const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

/** Structured error thrown for any non-2xx API response, carrying the backend's error code/details. */
export class ApiError extends Error {
  constructor(code, message, status, details) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, options)
  } catch (err) {
    throw new ApiError('NETWORK_ERROR', 'Could not reach the Guardian backend. Is the server running?', 0, err.message)
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    // Non-JSON response (rare) — fall through with json = null
  }

  if (!res.ok) {
    const err = json?.error || {}
    throw new ApiError(
      err.code || 'UNKNOWN_ERROR',
      err.message || `Request failed with status ${res.status}`,
      res.status,
      err.details
    )
  }

  return json
}

export function analyzeUrl(url, personalContext = 'general') {
  return request('/analyze/url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url, personalContext }),
  }).then((json) => json.data)
}

export function analyzeMessage(message, personalContext = 'general') {
  return request('/analyze/message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, personalContext }),
  }).then((json) => json.data)
}

export function analyzeFile(file, personalContext = 'general') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('personalContext', personalContext)
  return request('/analyze/file', { method: 'POST', body: formData }).then((json) => json.data)
}

export function analyzeApk(file, personalContext = 'general') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('personalContext', personalContext)
  return request('/analyze/apk', { method: 'POST', body: formData }).then((json) => json.data)
}

export function getInvestigation(id) {
  return request(`/investigation/${id}`).then((json) => json.data)
}

/** URL for the downloadable PDF security report — same investigation record, no recomputation. */
export function getInvestigationReportUrl(id) {
  return `${BASE_URL}/investigation/${id}/report`
}

/** Settings > Danger zone > Clear all investigation history. Irreversible. */
export function clearHistory() {
  return request('/history', { method: 'DELETE' }).then((json) => json.data)
}

export function getHistory(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString()
  return request(`/history${query ? `?${query}` : ''}`)
}
