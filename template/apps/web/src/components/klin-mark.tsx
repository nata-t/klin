import { cn } from "@/lib/utils"

/**
 * How the egg hatches (it rocks, then the cap hops): "hover" while an ancestor with the
 * group/hatch class is hovered, "loop" every few seconds, "busy" without a rest (for loaders).
 */
export type Hatch = "hover" | "loop" | "busy"

// The egg rocks and the cap hops, each pivoting on the bottom of its own box. The animations live in styles.css.
const pivot = "origin-bottom transform-fill"
const egg: Record<Hatch, string> = {
  hover: "motion-safe:group-hover/hatch:animate-egg-rock",
  loop: "motion-safe:animate-egg-rock-loop",
  busy: "motion-safe:animate-egg-rock-busy",
}
const cap: Record<Hatch, string> = {
  hover: "motion-safe:group-hover/hatch:animate-cap-hop",
  loop: "motion-safe:animate-cap-hop-loop",
  busy: "motion-safe:animate-cap-hop-busy",
}

/** The klin mark (an egg with its first crack, the cap lifted), in the color of the text around it. Swap it for your own logo in ./logo.tsx. */
export function KlinMark({ className, hatch }: { className?: string; hatch?: Hatch }) {
  return (
    <svg className={className} viewBox="0 0 152 190" fill="currentColor" aria-hidden>
      <g className={cn(pivot, hatch && egg[hatch])}>
        <g transform="translate(76 114)">
          <path d="M-68.57 -44L-54.49 -44L-26 -15.51L0 -41.51L26 -15.51L54.49 -44L68.57 -44A76 102 0 0 1 76 0A76 76 0 0 1 0 76A76 76 0 0 1 -76 0A76 102 0 0 1 -68.57 -44Z" />
          <path className={cn(pivot, hatch && cap[hatch])} d="M-63.52 -68A76 102 0 0 1 63.52 -68L49.51 -68L26 -44.49L0 -70.49L-26 -44.49L-49.51 -68L-63.52 -68Z" />
        </g>
      </g>
    </svg>
  )
}
