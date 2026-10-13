import { describe, expect, it } from "vitest"
import { dockerFix } from "../src/utils/docker"

describe("docker fixes", () => {
  it("adds Linux users to the docker group instead of reaching for sudo every time", () => {
    const fix = dockerFix("denied", "linux")
    expect(fix.problem).toContain("permission denied")
    expect(fix.steps.map(([command]) => command)).toEqual(["sudo usermod -aG docker $USER", "newgrp docker"])
  })

  it("points macOS and Windows at Docker Desktop", () => {
    expect(dockerFix("stopped", "darwin").steps[0]![0]).toBe("open -a Docker")
    expect(dockerFix("stopped", "win32").steps[0]![0]).toContain("Docker Desktop")
    expect(dockerFix("denied", "win32").steps[0]![0]).toContain("docker-users")
    expect(dockerFix("missing", "darwin").steps[0]![1]).toContain("docs.docker.com")
  })

  it("starts the daemon on Linux", () => {
    expect(dockerFix("stopped", "linux").steps[0]![0]).toBe("sudo systemctl enable --now docker")
  })
})
