// klin:file queues
export const EMAIL_QUEUE = "email"

export type EmailJob = { type: "welcome"; to: string; name: string }
