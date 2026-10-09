import type { ApiErrorResponse, ApiSuccessResponse } from "@repo/validators"
import { env } from "@/env"
import { ApiError } from "./api-error"

/**
 * Typed fetch wrapper for the Nest API.
 *
 *   const notes = await api.get<NoteList>("/notes", { page: 2 })
 *
 * - Sends cookies (Better Auth session) with every request.
 * - Unwraps the `{ success, data }` envelope: you get `data` back.
 * - Throws `ApiError` (code, status, field details) for every failure.
 *
 * Types come from @repo/validators, so request and response shapes are the
 * exact ones the API validates against.
 */

const BASE_URL = `${env.VITE_API_URL ?? ""}/api`

type QueryParams = object

interface RequestOptions {
  query?: QueryParams
  body?: unknown
  signal?: AbortSignal
}

function buildUrl(path: string, query?: QueryParams) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue
    url.searchParams.set(key, String(value))
  }
  return url
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined
  let response: Response

  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      credentials: "include",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw ApiError.synthetic(0, "NETWORK_ERROR", "Can't reach the server. Check your connection.", method, path)
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccessResponse<T>
    | ApiErrorResponse
    | null

  if (payload?.success === true) return payload.data
  if (payload?.success === false) throw new ApiError(payload)
  throw ApiError.synthetic(
    response.status,
    response.ok ? "BAD_RESPONSE" : "HTTP_ERROR",
    response.ok ? "Unexpected response from the server" : `Request failed (${response.status})`,
    method,
    path
  )
}

export const api = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) =>
    request<T>("GET", path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T>(path: string) => request<T>("DELETE", path),
}
