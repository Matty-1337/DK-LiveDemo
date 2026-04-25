// Stub for the missing src/utils/postLoginRedirect.js in the upstream
// livedemo-web-app image. Two exports referenced by the SPA:
//
//   - LoginPage.js:29  imports { getPostLoginPathFromLocation }
//                       called with react-router `location` object
//   - Auth.js:7         imports { sanitizeReturnPath }
//                       called with a candidate path string
//
// Inferred contract from caller sites:
//   getPostLoginPathFromLocation(location): string
//     Returns a path the user should land on after login. Looks at
//     ?next= or ?redirect= query params and sanitizes; defaults to '/'.
//
//   sanitizeReturnPath(path): string
//     Takes a candidate path; returns a same-origin path (never an
//     external URL, never a scheme like 'javascript:'). Defaults to
//     '/' on anything suspicious.
//
// These are conservative stubs — they preserve the SPA's basic redirect
// flow without enabling external-URL injection. The demo-viewing path
// (/livedemos/:storyId) doesn't require login and never exercises this
// code, so for the demo-generation pipeline these stubs are sufficient.

export function sanitizeReturnPath(path) {
  if (typeof path !== 'string' || path.length === 0) return '/'

  // Reject anything with a scheme — javascript:, data:, http:, etc.
  if (/^[a-z][a-z0-9+.\-]*:/i.test(path)) return '/'

  // Reject protocol-relative URLs (//evil.com)
  if (path.startsWith('//')) return '/'

  // Force leading slash so we always stay on origin
  if (!path.startsWith('/')) return '/' + path

  return path
}

export function getPostLoginPathFromLocation(location) {
  if (!location || typeof location !== 'object') return '/'
  try {
    const search = location.search || ''
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    const next = params.get('next') || params.get('redirect') || params.get('returnTo')
    if (next) return sanitizeReturnPath(next)
  } catch {
    // fall through
  }
  return '/'
}

export default { getPostLoginPathFromLocation, sanitizeReturnPath }
