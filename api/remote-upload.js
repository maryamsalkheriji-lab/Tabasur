// Deliberately closed. Reopening requires an explicit organizer request and a
// working, authenticated Drive destination for each track. Never read the body,
// create upload sessions, or contact storage while this endpoint is locked.
export default function handler(_req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.statusCode = 423
  res.end(JSON.stringify({ ok: false, code: 'UPLOADS_CLOSED' }))
}
