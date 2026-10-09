import { describe, expect, it } from "vitest"
import { mergeText } from "../src/commands/transition"

const base = ["import a", "// klin-anchor:imports", "", "modules: [", "  A,", "  // klin-anchor:modules", "]"].join("\n")

describe("3-way merge", () => {
  it("keeps both sides when both inserted at an anchor", () => {
    const ours = base.replace("// klin-anchor:imports", "import mine\n// klin-anchor:imports").replace("  // klin-anchor:modules", "  Mine,\n  // klin-anchor:modules")
    const theirs = base.replace("// klin-anchor:imports", "import theirs\n// klin-anchor:imports").replace("  // klin-anchor:modules", "  Theirs,\n  // klin-anchor:modules")
    const { content, conflicts } = mergeText(ours, base, theirs)
    expect(conflicts).toBe(0)
    expect(content).toContain("import mine\nimport theirs\n// klin-anchor:imports")
    expect(content).toContain("  Mine,\n  Theirs,\n  // klin-anchor:modules")
  })

  it("applies template changes to lines you didn't touch", () => {
    const ours = base.replace("import a", "import a // edited")
    const theirs = base.replace("  A,", "  A,\n  B,")
    const { content, conflicts } = mergeText(ours, base, theirs)
    expect(conflicts).toBe(0)
    expect(content).toContain("import a // edited")
    expect(content).toContain("  B,")
  })

  it("marks real conflicts", () => {
    const { content, conflicts } = mergeText(base.replace("  A,", "  Mine,"), base, base.replace("  A,", "  Theirs,"))
    expect(conflicts).toBe(1)
    expect(content).toContain("<<<<<<< yours\n  Mine,\n=======\n  Theirs,\n>>>>>>> klin")
  })
})
