import { describe, expect, it } from "vitest"
import { evaluate } from "../src/engine/expr"
import { MarkerError, processMarkers, referencedFlags } from "../src/engine/markers"

const flags = (on: string[], known = ["google", "github", "postgres", "mysql", "sqlite", "email", "queues", "i18n"]) => ({
  on: new Set(on),
  known: new Set(known),
})

describe("expressions", () => {
  it("evaluates operators with precedence", () => {
    const f = flags(["google", "postgres"])
    expect(evaluate("google", f)).toBe(true)
    expect(evaluate("!google", f)).toBe(false)
    expect(evaluate("github || google", f)).toBe(true)
    expect(evaluate("github || google && sqlite", f)).toBe(false)
    expect(evaluate("(github || google) && postgres", f)).toBe(true)
    expect(evaluate("!(github || sqlite)", f)).toBe(true)
  })

  it("rejects unknown flags", () => {
    expect(() => evaluate("gogle", flags([]))).toThrow(/Unknown flag "gogle"/)
  })
})

describe("markers", () => {
  it("keeps the selected branch and drops the rest", () => {
    const src = [
      "const a = 1",
      "// klin:if google",
      "const google = true",
      "// klin:elif github",
      "const github = true",
      "// klin:else",
      "const none = true",
      "// klin:endif",
      "const b = 2",
      "",
    ].join("\n")
    expect(processMarkers(src, flags(["github"]))).toBe("const a = 1\nconst github = true\nconst b = 2\n")
    expect(processMarkers(src, flags([]))).toBe("const a = 1\nconst none = true\nconst b = 2\n")
    expect(processMarkers(src, flags(["google", "github"]))).toBe("const a = 1\nconst google = true\nconst b = 2\n")
  })

  it("activates dormant lines in the chosen branch", () => {
    const src = [
      "datasource db {",
      "  // klin:if postgres",
      '  provider = "postgresql"',
      "  // klin:elif sqlite",
      '  //? provider = "sqlite"',
      "  // klin:endif",
      "}",
      "",
    ].join("\n")
    expect(processMarkers(src, flags(["sqlite"]))).toBe('datasource db {\n  provider = "sqlite"\n}\n')
    expect(processMarkers(src, flags(["postgres"]))).toBe('datasource db {\n  provider = "postgresql"\n}\n')
  })

  it("supports every comment style", () => {
    const src = [
      "<div>",
      "  {/* klin:if google */}",
      "  <Google />",
      "  {/* klin:endif */}",
      "  <Github /> {/* klin:only github */}",
      "</div>",
      "# klin:if email",
      "RESEND_API_KEY=",
      "# klin:endif",
      "/* klin:if i18n */",
      ".rtl {}",
      "/* klin:endif */",
      "<!-- klin:if queues -->",
      "## Jobs",
      "<!-- klin:endif -->",
      "",
    ].join("\n")
    expect(processMarkers(src, flags(["github", "email"]))).toBe(
      "<div>\n  <Github />\n</div>\nRESEND_API_KEY=\n"
    )
  })

  it("handles nesting", () => {
    const src = [
      "// klin:if email",
      "a",
      "// klin:if queues",
      "b",
      "// klin:else",
      "c",
      "// klin:endif",
      "// klin:endif",
      "",
    ].join("\n")
    expect(processMarkers(src, flags(["email"]))).toBe("a\nc\n")
    expect(processMarkers(src, flags(["queues"]))).toBe("")
  })

  it("drops a file via klin:file", () => {
    expect(processMarkers("// klin:file email\nexport {}\n", flags([]))).toBeNull()
    expect(processMarkers("// klin:file email\nexport {}\n", flags(["email"]))).toBe("export {}\n")
  })

  it("tidies blank lines only where code was removed", () => {
    const src = [
      "function x() {",
      "  one()",
      "",
      "  // klin:if email",
      "  two()",
      "  // klin:endif",
      "}",
      "",
      "",
      "keep()",
      "",
    ].join("\n")
    expect(processMarkers(src, flags([]))).toBe("function x() {\n  one()\n}\n\n\nkeep()\n")
  })

  it("reports malformed blocks with a location", () => {
    expect(() => processMarkers("// klin:if google\nx\n", flags([]), "a.ts")).toThrow(MarkerError)
    expect(() => processMarkers("// klin:endif\n", flags([]), "a.ts")).toThrow(/a\.ts:1/)
  })

  it("lists referenced flags", () => {
    expect(referencedFlags("// klin:if google || !email\nx // klin:only queues\n").sort()).toEqual([
      "email",
      "google",
      "queues",
    ])
  })
})
