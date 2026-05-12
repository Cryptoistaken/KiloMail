/**
 * health-check.mjs
 *
 * Called by .github/workflows/provider-health.yml
 * Tests every provider's API proxy on the live Vercel deployment.
 *
 * Env vars (set by the workflow):
 *   BASE_URL         — e.g. https://kilomail.vercel.app
 *   TARGET_PROVIDER  — "kilolabs" | "hd" | "edu" | "all"
 *   VERBOSE          — "true" to print full response bodies
 */

const BASE      = (process.env.BASE_URL ?? "").replace(/\/$/, "")
const TARGET    = process.env.TARGET_PROVIDER ?? "all"
const VERBOSE   = process.env.VERBOSE === "true"
const TIMEOUT   = 15_000  // ms per request

if (!BASE) {
  console.error("❌  KILOMAIL_BASE_URL secret is not set.")
  process.exit(1)
}

// ── Test definitions ────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    id: "kilolabs",
    name: "KiloLabs (kilolabs.space)",
    tests: [
      {
        label: "inbox list",
        url: () => `${BASE}/api/inbox/${encodeURIComponent("healthcheck@kilolabs.space")}`,
        validate: expectJsonArray,
      },
    ],
  },
  {
    id: "hd",
    name: "HD / Hotmail9 (tenwmail.com)",
    tests: [
      {
        label: "inbox list — tenwmail.com",
        url: () => `${BASE}/api/providers/hd?action=inbox&email=${encodeURIComponent("healthcheck@tenwmail.com")}`,
        validate: expectJsonArray,
      },
      {
        label: "inbox list — clowtmail.com",
        url: () => `${BASE}/api/providers/hd?action=inbox&email=${encodeURIComponent("healthcheck@clowtmail.com")}`,
        validate: expectJsonArray,
      },
    ],
  },
  {
    id: "edu",
    name: "EDU / GetEduMail",
    tests: [
      {
        label: "inbox list — iunp.edu.rs",
        url: () => `${BASE}/api/providers/edu?action=inbox&email=${encodeURIComponent("health.check@iunp.edu.rs")}`,
        validate: expectJsonArray,
      },
      {
        label: "inbox list — warsawuni.edu.pl",
        url: () => `${BASE}/api/providers/edu?action=inbox&email=${encodeURIComponent("health.check@warsawuni.edu.pl")}`,
        validate: expectJsonArray,
      },
    ],
  },
]

// ── Validators ──────────────────────────────────────────────────────────────

function expectJsonArray(body, status) {
  if (status !== 200) return `Expected 200, got ${status}`
  if (!Array.isArray(body)) return `Expected JSON array, got ${typeof body}`
  return null  // null = pass
}

// ── Runner ──────────────────────────────────────────────────────────────────

async function runTest(test) {
  const url = test.url()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "kilomail-health-check/1.0" },
    })
    clearTimeout(timer)

    const ct   = res.headers.get("content-type") ?? ""
    const body = ct.includes("json") ? await res.json() : await res.text()

    if (VERBOSE) {
      console.log(`    ↳ ${url}`)
      console.log(`    ↳ status: ${res.status}`)
      console.log(`    ↳ body:   ${JSON.stringify(body).slice(0, 300)}`)
    }

    const err = test.validate(body, res.status)
    return err ? { ok: false, error: err } : { ok: true }

  } catch (e) {
    clearTimeout(timer)
    const msg = e.name === "AbortError" ? `Timed out after ${TIMEOUT}ms` : String(e.message)
    return { ok: false, error: msg }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

let totalPass = 0
let totalFail = 0
const failures = []

const selected = TARGET === "all"
  ? PROVIDERS
  : PROVIDERS.filter(p => p.id === TARGET)

if (selected.length === 0) {
  console.error(`❌  Unknown provider: "${TARGET}". Valid values: kilolabs, hd, edu, all`)
  process.exit(1)
}

console.log(`\n🔍  KiloMail provider health check`)
console.log(`    Base URL: ${BASE}`)
console.log(`    Target:   ${TARGET}\n`)

for (const provider of selected) {
  console.log(`▸ ${provider.name}`)

  for (const test of provider.tests) {
    const { ok, error } = await runTest(test)
    if (ok) {
      console.log(`  ✅  ${test.label}`)
      totalPass++
    } else {
      console.log(`  ❌  ${test.label}`)
      console.log(`      ${error}`)
      totalFail++
      failures.push({ provider: provider.name, label: test.label, error })
    }
  }

  console.log()
}

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`─────────────────────────────────────`)
console.log(`  Passed: ${totalPass}`)
console.log(`  Failed: ${totalFail}`)

if (totalFail > 0) {
  console.log(`\nFailing tests:`)
  for (const f of failures) {
    console.log(`  • [${f.provider}] ${f.label} — ${f.error}`)
  }
  console.log()
  process.exit(1)  // fails the GitHub Actions step
}

console.log(`\n✅  All providers healthy.\n`)
