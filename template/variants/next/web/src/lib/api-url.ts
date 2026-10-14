/**
 * Where this server reaches the API: the /api rewrite and server-side session
 * checks. The browser never uses it — it calls /api on the web origin.
 */
export function apiUrl() {
  return (process.env.API_URL || `http://localhost:${process.env.API_PORT || 3000}`).replace(/\/$/, "")
}
