import type { ErrorRequestHandler, RequestHandler } from "express"
import { errorBody, notFound, toErrorShape } from "../lib/http"

/** Unknown routes get the same envelope as everything else. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`No route for ${req.method} ${req.path}`))
}

/**
 * Every error leaves the API as an `ApiErrorResponse`. Express 5 forwards
 * rejected promises from async handlers here, so routes can simply throw.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const shape = toErrorShape(error)
  if (shape.status >= 500) req.log.error({ err: error }, shape.message)
  res.status(shape.status).json(errorBody(shape, req, error))
}
