import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { spawnSync } from "node:child_process"

const repositoryRoot = path.resolve(__dirname, "../..")
const releaseSha = "1111111111111111111111111111111111111111"
const previousSha = "2222222222222222222222222222222222222222"
let temporaryRoots: string[] = []

interface Harness {
  currentBundleLink: string
  currentShaFile: string
  dbReadyCounter: string
  env: NodeJS.ProcessEnv
  logFile: string
  releaseScript: string
}

function writeExecutable(file: string, content: string): void {
  writeFileSync(file, content, { mode: 0o755 })
  chmodSync(file, 0o755)
}

function createFakeCommands(binDir: string): void {
  writeExecutable(
    path.join(binDir, "id"),
    `#!/usr/bin/env bash
if [[ \${1:-} == -u ]]; then printf '0\\n'; else /usr/bin/id "$@"; fi
`,
  )
  writeExecutable(
    path.join(binDir, "stat"),
    `#!/usr/bin/env bash
if [[ \${1:-} == -c && \${2:-} == %a ]]; then
  if [[ $(/usr/bin/uname -s) == Linux ]]; then /usr/bin/stat -c '%a' "$3"; else /usr/bin/stat -f '%Lp' "$3"; fi
  exit
fi
if [[ \${1:-} == -c && \${2:-} == %U ]]; then printf 'root\\n'; exit; fi
exec /usr/bin/stat "$@"
`,
  )
  writeExecutable(
    path.join(binDir, "install"),
    `#!/usr/bin/env bash
args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|-g) shift 2 ;;
    *) args+=("$1"); shift ;;
  esac
done
exec /usr/bin/install "\${args[@]}"
`,
  )
  writeExecutable(path.join(binDir, "flock"), "#!/usr/bin/env bash\nexit \"${FAKE_LOCK_EXIT:-0}\"\n")
  writeExecutable(path.join(binDir, "sleep"), "#!/usr/bin/env bash\nexit 0\n")
  writeExecutable(
    path.join(binDir, "mv"),
    `#!/usr/bin/env bash
if [[ $(/usr/bin/uname -s) == Linux ]]; then exec /bin/mv "$@"; fi
if [[ \${1:-} == -Tf && $# -eq 3 ]]; then
  /bin/rm -f -- "$3"
  exec /bin/mv "$2" "$3"
fi
args=()
for arg in "$@"; do
  if [[ "$arg" == -Tf ]]; then args+=(-f); else args+=("$arg"); fi
done
exec /bin/mv "\${args[@]}"
`,
  )
  writeExecutable(
    path.join(binDir, "curl"),
    `#!/usr/bin/env bash
url="\${!#}"
printf 'curl %s\\n' "$url" >> "$FAKE_LOG"
if [[ "$url" == https://* && \${FAKE_FAIL_SMOKE:-0} == 1 ]]; then exit 22; fi
exit 0
`,
  )
  writeExecutable(
    path.join(binDir, "docker"),
    `#!/usr/bin/env bash
printf 'docker app_image=%s %s\\n' "\${APP_IMAGE:-none}" "$*" >> "$FAKE_LOG"

if [[ \${1:-} == image && \${2:-} == inspect ]]; then
  image="\${!#}"
  printf '%s\\n' "\${image##*-}"
  exit 0
fi

arguments=" $* "
if [[ "$arguments" == *' ps --status running --quiet db '* ]]; then
  [[ \${FAKE_DB_RUNNING:-1} == 1 ]] && printf 'fake-db-id\\n'
  exit 0
fi
if [[ "$arguments" == *' exec -T db pg_isready '* ]]; then
  ready_attempt=0
  if [[ -n \${FAKE_DB_READY_COUNTER:-} && -f \${FAKE_DB_READY_COUNTER} ]]; then
    ready_attempt="$(<"\${FAKE_DB_READY_COUNTER}")"
  fi
  ready_attempt=$((ready_attempt + 1))
  if [[ -n \${FAKE_DB_READY_COUNTER:-} ]]; then
    printf '%s\\n' "\${ready_attempt}" >"\${FAKE_DB_READY_COUNTER}"
  fi
  if (( ready_attempt <= \${FAKE_DB_NOT_READY_ATTEMPTS:-0} )); then exit 1; fi
  exit 0
fi
if [[ "$arguments" == *' exec -T db psql '* ]]; then
  printf '{"stable":true}\\n'
  exit 0
fi
if [[ "$arguments" == *' exec -T db pg_dump '* ]]; then
  [[ \${FAKE_BACKUP_FAIL:-0} == 1 ]] && exit 1
  printf 'fake custom dump\\n'
  exit 0
fi
if [[ "$arguments" == *' exec -T db pg_restore --list '* ]]; then
  exit 0
fi
if [[ "$arguments" == *' run --rm --no-deps ops '* && \${FAKE_MIGRATION_FAIL:-0} == 1 ]]; then
  exit 1
fi
exit 0
`,
  )
}

function createHarness(overrides: Record<string, string> = {}): Harness {
  const root = mkdtempSync(path.join(tmpdir(), "donhang-release-behavior-"))
  temporaryRoots = [...temporaryRoots, root]
  const installDir = path.join(root, "install")
  const releaseDir = path.join(installDir, "releases", releaseSha)
  const previousReleaseDir = path.join(installDir, "releases", previousSha)
  const stateDir = path.join(installDir, "state")
  const binDir = path.join(root, "fake-bin")
  const operatorSbin = path.join(root, "operator-sbin")
  const operatorLibexec = path.join(root, "operator-libexec")
  const backupDir = path.join(root, "backups")
  const dbReadyCounter = path.join(root, "db-ready-attempts")
  const logFile = path.join(root, "commands.log")

  mkdirSync(releaseDir, { recursive: true })
  mkdirSync(previousReleaseDir, { recursive: true })
  mkdirSync(stateDir, { recursive: true })
  mkdirSync(binDir)
  mkdirSync(operatorSbin)
  mkdirSync(operatorLibexec)
  mkdirSync(backupDir)
  writeFileSync(logFile, "")

  cpSync(path.join(repositoryRoot, "compose.production.yml"), path.join(releaseDir, "compose.production.yml"))
  cpSync(path.join(repositoryRoot, "deploy"), path.join(releaseDir, "deploy"), { recursive: true })
  cpSync(path.join(repositoryRoot, "scripts"), path.join(releaseDir, "scripts"), { recursive: true })
  cpSync(path.join(repositoryRoot, "compose.production.yml"), path.join(previousReleaseDir, "compose.production.yml"))
  const releaseScript = path.join(releaseDir, "scripts/deploy/release.sh")
  chmodSync(releaseScript, 0o755)

  const runtimeEnv = path.join(installDir, "runtime.env")
  writeFileSync(
    runtimeEnv,
    [
      "POSTGRES_DB=donhang",
      "POSTGRES_USER=donhang_app",
      "POSTGRES_PASSWORD=fake-app-password",
      "POSTGRES_ADMIN_USER=donhang_admin",
      "POSTGRES_ADMIN_PASSWORD=fake-admin-password",
      "POSTGRES_MIGRATOR_USER=donhang_migrator",
      "POSTGRES_MIGRATOR_PASSWORD=fake-migrator-password",
      "DATABASE_URL=postgresql://donhang_app:fake-app-password@db:5432/donhang?schema=public",
      "MIGRATION_DATABASE_URL=postgresql://donhang_migrator:fake-migrator-password@db:5432/donhang?schema=public",
      `POSTGRES_INIT_SCRIPT=${path.join(installDir, "postgres/init-app.sh")}`,
      "APP_PORT=3101",
      "APP_ORIGIN=https://donhang.9chum.vn",
      `BACKUP_DIR=${backupDir}`,
      "SMOKE_URL=https://donhang.9chum.vn/api/health",
      "AUTH_SESSION_TTL_DAYS=7",
      "AUTH_COOKIE_NAME=donhang_session",
      "",
    ].join("\n"),
    { mode: 0o600 },
  )
  chmodSync(runtimeEnv, 0o600)

  const currentShaFile = path.join(stateDir, "current-sha")
  writeFileSync(currentShaFile, `${previousSha}\n`, { mode: 0o600 })
  symlinkSync(`releases/${previousSha}`, path.join(installDir, "current"))
  createFakeCommands(binDir)

  return {
    currentBundleLink: path.join(installDir, "current"),
    currentShaFile,
    dbReadyCounter,
    logFile,
    releaseScript,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      DONHANG_INSTALL_DIR: installDir,
      DONHANG_LOCK_FILE: path.join(root, "maintenance.lock"),
      DONHANG_OPERATOR_SBIN_DIR: operatorSbin,
      DONHANG_OPERATOR_LIBEXEC_DIR: operatorLibexec,
      FAKE_LOG: logFile,
      FAKE_DB_READY_COUNTER: dbReadyCounter,
      FAKE_DB_RUNNING: "1",
      ...overrides,
    },
  }
}

function runRelease(harness: Harness) {
  return spawnSync(harness.releaseScript, [releaseSha], {
    encoding: "utf8",
    env: harness.env,
  })
}

afterEach(() => {
  const rootsToRemove = temporaryRoots
  temporaryRoots = []
  for (const root of rootsToRemove) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe("release state machine", () => {
  it("orders backup, migration, app health, HTTPS smoke, and state promotion", () => {
    const harness = createHarness()
    const result = runRelease(harness)
    const log = readFileSync(harness.logFile, "utf8")

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(log.indexOf(" pull ghcr.io/djoker96/9chum_order:app-")).toBeLessThan(
      log.indexOf(" pg_dump "),
    )
    expect(log.indexOf(" pg_dump ")).toBeLessThan(log.indexOf(" up -d --wait"))
    expect(log.indexOf(" up -d --wait")).toBeLessThan(
      log.indexOf("migrate deploy"),
    )
    expect(log.indexOf("migrate deploy")).toBeLessThan(
      log.indexOf(" up -d --no-deps app"),
    )
    expect(log.indexOf("http://127.0.0.1:3101/api/health")).toBeLessThan(
      log.indexOf("https://donhang.9chum.vn/api/health"),
    )
    expect(readFileSync(harness.currentShaFile, "utf8").trim()).toBe(releaseSha)
    expect(readlinkSync(harness.currentBundleLink)).toBe(`releases/${releaseSha}`)
  })

  it("waits for PostgreSQL readiness before creating the pre-migration backup", () => {
    const harness = createHarness({ FAKE_DB_NOT_READY_ATTEMPTS: "2" })
    const result = runRelease(harness)

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(readFileSync(harness.dbReadyCounter, "utf8").trim()).toBe("3")
    expect(readFileSync(harness.currentShaFile, "utf8").trim()).toBe(releaseSha)
  })

  it("aborts before migration when the pre-migration backup fails", () => {
    const harness = createHarness({ FAKE_BACKUP_FAIL: "1" })
    const result = runRelease(harness)
    const log = readFileSync(harness.logFile, "utf8")

    expect(result.status).not.toBe(0)
    expect(log).toContain("pg_dump")
    expect(log).not.toContain("prisma migrate deploy")
    expect(readFileSync(harness.currentShaFile, "utf8").trim()).toBe(previousSha)
  })

  it("does not update the app or state after a migration failure", () => {
    const harness = createHarness({ FAKE_MIGRATION_FAIL: "1" })
    const result = runRelease(harness)
    const log = readFileSync(harness.logFile, "utf8")

    expect(result.status).not.toBe(0)
    expect(log).toContain("migrate deploy")
    expect(log).not.toContain("up -d --no-deps app")
    expect(readFileSync(harness.currentShaFile, "utf8").trim()).toBe(previousSha)
  })

  it("restores the previous app after HTTPS smoke failure without rolling back DB", () => {
    const harness = createHarness({ FAKE_FAIL_SMOKE: "1" })
    const result = runRelease(harness)
    const log = readFileSync(harness.logFile, "utf8")

    expect(result.status).not.toBe(0)
    expect(log).toContain(`app_image=ghcr.io/djoker96/9chum_order:app-${previousSha}`)
    expect(log).not.toContain("pg_restore --dbname")
    expect(log).not.toMatch(/\b(stop|down)\b.*\bdb\b/i)
    expect(readFileSync(harness.currentShaFile, "utf8").trim()).toBe(previousSha)
  })
})
