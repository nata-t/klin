import { execFile } from "node:child_process"

/**
 * Whether this user can talk to Docker — the local services (`db:up`) need
 * it. klin never fixes this itself (it takes sudo or an installer); it
 * explains the one-time fix for the OS it's on instead.
 */

export type DockerState = "ready" | "missing" | "stopped" | "denied"

/** Asks the daemon for its version: fails fast when Docker is missing, stopped or off-limits. */
export function dockerState(): Promise<DockerState> {
  return new Promise((resolve) => {
    execFile("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 8000, windowsHide: true }, (error, _stdout, stderr) => {
      if (!error) return resolve("ready")
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolve("missing")
      resolve(/permission denied|access is denied/i.test(`${stderr}\n${error.message}`) ? "denied" : "stopped")
    })
  })
}

export interface DockerFix {
  /** One line: what's wrong. */
  problem: string
  /** Commands to run once, in order (a `#` command is something to do by hand). */
  steps: Array<[command: string, why: string]>
}

/**
 * The one-time fix, per OS. On Linux the daemon's socket belongs to root and
 * the `docker` group, so "permission denied" means the user isn't in it yet;
 * Docker Desktop (macOS, Windows) sets access up when it's installed.
 */
export function dockerFix(state: Exclude<DockerState, "ready">, platform: NodeJS.Platform = process.platform): DockerFix {
  const linux = platform === "linux"
  if (state === "missing") {
    return {
      problem: "Docker isn't installed",
      steps: [[`# install ${linux ? "Docker Engine" : "Docker Desktop"}`, linux ? "docs.docker.com/engine/install" : "docs.docker.com/get-docker"]],
    }
  }
  if (state === "stopped") {
    return {
      problem: "Docker isn't running",
      steps: linux
        ? [["sudo systemctl enable --now docker", "start it now and at boot"]]
        : platform === "darwin"
          ? [["open -a Docker", "start Docker Desktop"]]
          : [["# start Docker Desktop", "wait until it's running"]],
    }
  }
  if (platform === "win32") {
    return {
      problem: "Docker said access denied for your user",
      steps: [
        ["net localgroup docker-users %USERNAME% /add", "as administrator, once"],
        ["# sign out and back in", "to apply the group"],
      ],
    }
  }
  if (platform === "darwin") {
    return { problem: "Docker said permission denied for your user", steps: [["# quit and reopen Docker Desktop", "it resets access"]] }
  }
  return {
    problem: "Docker said permission denied for your user",
    steps: [
      ["sudo usermod -aG docker $USER", "join the docker group, once"],
      ["newgrp docker", "apply it here (or log in again)"],
    ],
  }
}
