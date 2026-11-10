// Small fetch wrapper for the app's own /api endpoints

export const goToLogin = () => {
  const here = location.pathname + location.search
  location.replace(here === '/' ? '/login.html' : `/login.html?next=${encodeURIComponent(here)}`)
}

/** JSON in, JSON out. Throws Error(message) with .status (HTTP) or .offline (no network). */
export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw Object.assign(new Error('Internet nahi chal raha, check karke dobara try karein'), { offline: true })
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && data.loggedOut) {
    goToLogin()
    throw Object.assign(new Error('Dobara login karein'), { status: 401 })
  }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Kuch gadbad ho gayi, dobara try karein'), { status: res.status })
  return data
}
