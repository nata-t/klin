# Background jobs

[BullMQ](https://docs.bullmq.io) queues backed by Redis (Valkey locally:
`pnpm db:up`), wired into Nest with `@nestjs/bullmq`. Everything lives in
`apps/api/src/modules/jobs`.

## The example

A **welcome email** is queued whenever a user signs up:

1. `sign-up.hooks.ts` is a Better Auth database hook as a Nest provider
   (`@DatabaseHook()` + `@AfterCreate("user")`). It enqueues a job.
2. `email.processor.ts` (`@Processor("email")`) handles it, with 3 attempts and
   exponential backoff (set in `jobs.module.ts`).

Try it by hand: `POST /api/jobs/welcome` enqueues one for you, then
`GET /api/jobs/:id` shows its state.

## Add a queue

```ts
// jobs.module.ts
BullModule.registerQueue({ name: "reports" })

// reports.processor.ts
@Processor("reports")
export class ReportsProcessor extends WorkerHost {
  async process(job: Job<{ month: string }>) { /* … */ }
}

// anywhere
constructor(@InjectQueue("reports") private readonly reports: Queue) {}
await this.reports.add("monthly", { month: "2026-10" }, { delay: 60_000 })
```

Processors run inside the API process. When jobs get heavy, move them to a
separate worker app that imports the same modules.
