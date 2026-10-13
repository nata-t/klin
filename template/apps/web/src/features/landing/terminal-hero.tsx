import { useEffect, useState } from "react"

/** "klin" in the same block letters the CLI prints. */
const LOGO = [
  "██╗  ██╗██╗     ██╗███╗   ██╗",
  "██║ ██╔╝██║     ██║████╗  ██║",
  "█████╔╝ ██║     ██║██╔██╗ ██║",
  "██╔═██╗ ██║     ██║██║╚██╗██║",
  "██║  ██╗███████╗██║██║ ╚████║",
  "╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝",
]

// klin:if pnpm
const DEV_COMMAND = "pnpm dev"
// klin:elif bun
//? const DEV_COMMAND = "bun run dev"
// klin:elif npm
//? const DEV_COMMAND = "npm run dev"
// klin:endif

const OUTPUT: Array<[string, string]> = [
  ["web", "http://localhost:5173"],
  // klin:if nest-express
  ["api", "NestJS on Express · /api"],
  // klin:elif nest-fastify
  //? ["api", "NestJS on Fastify · /api"],
  // klin:elif plain-express
  //? ["api", "Express · /api"],
  // klin:elif plain-fastify
  //? ["api", "Fastify · /api"],
  // klin:endif
  ["auth", "Better Auth · /api/auth"],
  ["db", "Prisma Studio · :5555"],
]

/** Types `text` one character at a time (instantly for reduced motion). */
function useTyped(text: string, delay = 600) {
  const [reduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  const [count, setCount] = useState(reduced ? text.length : 0)
  useEffect(() => {
    if (reduced) return
    let timer: ReturnType<typeof setTimeout>
    const tick = (n: number) => {
      setCount(n)
      if (n < text.length) timer = setTimeout(() => tick(n + 1), 70)
    }
    timer = setTimeout(() => tick(1), delay)
    return () => clearTimeout(timer)
  }, [text, delay, reduced])
  return { typed: text.slice(0, count), done: count >= text.length }
}

/**
 * The hero's centerpiece: a grayscale terminal with a soft vignette — the same
 * look as the klin CLI — that "starts" the app you're looking at.
 */
export function TerminalHero() {
  const { typed, done } = useTyped(DEV_COMMAND)

  return (
    <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 text-left font-mono text-neutral-300 shadow-2xl shadow-neutral-950/20">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
        <span className="size-2.5 rounded-full bg-neutral-700" />
        <span className="size-2.5 rounded-full bg-neutral-600" />
        <span className="size-2.5 rounded-full bg-neutral-500" />
        <span className="mx-auto pr-10 text-xs text-neutral-500">klin — ~/klin-app</span>
      </div>
      <div className="bg-[radial-gradient(ellipse_at_center,rgb(255_255_255/0.05),transparent_70%)] px-4 py-6 sm:px-8 sm:py-8">
        <pre aria-label="klin" className="mx-auto w-fit max-w-full overflow-hidden text-[6.5px] leading-none min-[400px]:text-[8px] sm:text-xs">
          {LOGO.map((line, row) => (
            <span key={row} className="block" aria-hidden>
              {/* Solid blocks in white, the box-drawing shadow in gray — like the CLI banner. */}
              {line.split(/(█+)/).map((part, i) =>
                part.startsWith("█") ? (
                  <span key={i} className="text-neutral-50">
                    {part}
                  </span>
                ) : (
                  <span key={i} className="text-neutral-600">
                    {part}
                  </span>
                )
              )}
            </span>
          ))}
        </pre>
        <p className="mt-4 text-center text-xs text-neutral-500 sm:text-sm">a spotless full-stack starter</p>

        <div className="mt-6 space-y-1.5 text-xs sm:text-sm">
          <p>
            <span className="text-neutral-500">$ </span>
            <span className="text-neutral-100">{typed}</span>
            {!done && <span className="ml-px inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-neutral-300" />}
          </p>
          {done &&
            OUTPUT.map(([label, value], i) => (
              <p
                key={label}
                className="truncate animate-in fade-in slide-in-from-left-1 fill-mode-both"
                style={{ animationDelay: `${150 + i * 120}ms` }}
              >
                <span className="text-neutral-100">✓</span> <span className="inline-block w-10 text-neutral-500">{label}</span>{" "}
                {value}
              </p>
            ))}
          {done && (
            <p className="animate-in fade-in fill-mode-both" style={{ animationDelay: `${150 + OUTPUT.length * 120}ms` }}>
              <span className="text-neutral-500">$ </span>
              <span className="inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-neutral-300" />
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
