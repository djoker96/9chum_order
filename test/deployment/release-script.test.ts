import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repositoryRoot = path.resolve(__dirname, "../..")
const releaseScript = path.join(repositoryRoot, "scripts/deploy/release.sh")
const releaseLauncher = path.join(repositoryRoot, "scripts/deploy/release-launcher.sh")
const forcedCommandScript = path.join(repositoryRoot, "scripts/deploy/forced-command.sh")
const selectPortScript = path.join(repositoryRoot, "scripts/deploy/select-port.sh")
const composeFile = path.join(repositoryRoot, "compose.production.yml")
const executableDeploymentFiles = [
  ...[
    "audit-vps.sh",
    "backup-functions.sh",
    "backup.sh",
    "bootstrap-vps.sh",
    "forced-command.sh",
    "release-launcher.sh",
    "release.sh",
    "seed-admin.sh",
    "select-port.sh",
    "verify-restore.sh",
  ].map((file) => path.join(repositoryRoot, "scripts/deploy", file)),
  path.join(repositoryRoot, "deploy/postgres/init-app.sh"),
]
const validSha = "0123456789abcdef0123456789abcdef01234567"

interface NormalizedService {
  cap_drop?: string[]
  environment?: Record<string, string>
  healthcheck?: { test?: string[] }
  image?: string
  logging?: { options?: Record<string, string> }
  ports?: Array<{ host_ip?: string; published?: string; target?: number }>
  read_only?: boolean
  restart?: string
  security_opt?: string[]
  stop_grace_period?: string
}

interface NormalizedCompose {
  networks: Record<string, { internal?: boolean }>
  services: Record<string, NormalizedService>
}

function loadNormalizedCompose(): NormalizedCompose {
  const output = execFileSync(
    "docker",
    ["compose", "--profile", "ops", "--file", composeFile, "config", "--format", "json"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        APP_IMAGE: "example.invalid/app:test",
        OPS_IMAGE: "example.invalid/ops:test",
        POSTGRES_DB: "donhang",
        POSTGRES_USER: "donhang_app",
        POSTGRES_PASSWORD: "compose-validation-only",
        POSTGRES_ADMIN_USER: "donhang_admin",
        POSTGRES_ADMIN_PASSWORD: "compose-admin-validation-only",
        POSTGRES_MIGRATOR_USER: "donhang_migrator",
        POSTGRES_MIGRATOR_PASSWORD: "compose-migrator-validation-only",
        DATABASE_URL: "postgresql://donhang_app:app-only@db:5432/donhang?schema=public",
        MIGRATION_DATABASE_URL:
          "postgresql://donhang_migrator:migrations-only@db:5432/donhang?schema=public",
        APP_PORT: "3101",
        RUNTIME_ENV_FILE: "/dev/null",
      },
    },
  )

  return JSON.parse(output) as NormalizedCompose
}

describe("production release input validation", () => {
  it("ships the release script exercised by these tests", () => {
    expect(existsSync(releaseScript)).toBe(true)
  })

  it("accepts exactly one lowercase 40-character Git commit SHA", () => {
    const output = execFileSync(releaseScript, ["--validate-only", validSha], {
      encoding: "utf8",
    })

    expect(output.trim()).toBe(validSha)
  })

  it("validates the same immutable SHA at the host launcher boundary", () => {
    const output = execFileSync(releaseLauncher, ["--validate-only", validSha], {
      encoding: "utf8",
    })

    expect(output.trim()).toBe(validSha)
  })

  it.each([
    "",
    "main",
    "0123456789abcdef0123456789abcdef0123456",
    "0123456789abcdef0123456789abcdef012345678",
    "0123456789ABCDEF0123456789ABCDEF01234567",
    `${validSha};id`,
    `${validSha}\nwhoami`,
  ])("rejects an unsafe release reference: %j", (releaseRef) => {
    const result = spawnSync(releaseScript, ["--validate-only", releaseRef], {
      encoding: "utf8",
    })

    expect(result.status).toBe(64)
    expect(`${result.stdout}${result.stderr}`).toContain("Invalid release SHA.")
    expect(`${result.stdout}${result.stderr}`).not.toContain("whoami")
  })
})

describe("restricted SSH forced command", () => {
  it("accepts only the deploy verb followed by an exact SHA", () => {
    const output = execFileSync(
      forcedCommandScript,
      ["--validate-only", `deploy ${validSha}`],
      { encoding: "utf8" },
    )

    expect(output.trim()).toBe(validSha)
  })

  it.each([
    validSha,
    `deploy  ${validSha}`,
    `deploy ${validSha} extra`,
    `deploy ${validSha}\nid`,
    `DEPLOY ${validSha}`,
  ])("rejects a command outside the forced-command grammar: %j", (command) => {
    const result = spawnSync(
      forcedCommandScript,
      ["--validate-only", command],
      { encoding: "utf8" },
    )

    expect(result.status).toBe(64)
    expect(`${result.stdout}${result.stderr}`).toContain("Command rejected.")
  })
})

describe("loopback port selection", () => {
  it("uses 3101 when the beginning of the range is free", () => {
    const output = execFileSync(selectPortScript, ["--occupied"], {
      encoding: "utf8",
    })

    expect(output.trim()).toBe("3101")
  })

  it("selects the first free port through 3199", () => {
    const output = execFileSync(
      selectPortScript,
      ["--occupied", "3101", "3102", "3104"],
      { encoding: "utf8" },
    )

    expect(output.trim()).toBe("3103")
  })

  it("fails when every allowed port is occupied", () => {
    const occupiedPorts = Array.from({ length: 99 }, (_, index) => String(3101 + index))
    const result = spawnSync(
      selectPortScript,
      ["--occupied", ...occupiedPorts],
      { encoding: "utf8" },
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("No free app port in 3101-3199.")
  })
})

describe("deployment bundle executability", () => {
  it.each(executableDeploymentFiles)(
    "ships %s as an executable file",
    (script) => {
      expect(statSync(script).mode & 0o111).not.toBe(0)
    },
  )
})

describe("production Compose isolation", () => {
  it("keeps PostgreSQL private and exposes the app on loopback only", () => {
    const compose = loadNormalizedCompose()
    const database = compose.services.db
    const app = compose.services.app

    expect(database.ports).toBeUndefined()
    expect(app.ports).toEqual([
      expect.objectContaining({ host_ip: "127.0.0.1", published: "3101", target: 3000 }),
    ])
    expect(compose.networks.database?.internal).toBe(true)
  })

  it("defines health checks and container hardening for runtime services", () => {
    const compose = loadNormalizedCompose()
    const { app, db, ops } = compose.services

    expect(app.healthcheck?.test?.join(" ")).toContain("/api/health")
    expect(db.healthcheck?.test?.join(" ")).toContain("pg_isready")
    expect(ops.healthcheck).toBeUndefined()
    expect(app).toMatchObject({
      read_only: true,
      restart: "unless-stopped",
      security_opt: ["no-new-privileges:true"],
      cap_drop: ["ALL"],
      stop_grace_period: "30s",
      logging: { options: { "max-size": "10m", "max-file": "5" } },
    })
    expect(db).toMatchObject({
      restart: "unless-stopped",
      security_opt: ["no-new-privileges:true"],
      cap_drop: ["ALL"],
      stop_grace_period: "30s",
    })
    expect(ops).toMatchObject({
      read_only: true,
      security_opt: ["no-new-privileges:true"],
      cap_drop: ["ALL"],
    })
  })

  it("pins PostgreSQL and separates admin, migration, and runtime credentials", () => {
    const compose = loadNormalizedCompose()
    const { app, db, ops } = compose.services

    expect(db.image).toMatch(
      /^postgres:16\.14-bookworm@sha256:[0-9a-f]{64}$/,
    )
    expect(db.environment).toMatchObject({
      POSTGRES_USER: "donhang_admin",
      APP_DB_USER: "donhang_app",
      MIGRATOR_DB_USER: "donhang_migrator",
    })
    expect(app.environment?.DATABASE_URL).toContain("donhang_app:app-only@")
    expect(ops.environment?.DATABASE_URL).toContain(
      "donhang_migrator:migrations-only@",
    )
    expect(app.environment).not.toHaveProperty("POSTGRES_ADMIN_PASSWORD")
    expect(app.environment).not.toHaveProperty("MIGRATION_DATABASE_URL")
  })
})
