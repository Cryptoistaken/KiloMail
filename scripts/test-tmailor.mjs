// Test the tmailor.com API — create email, poll inbox, read message
// Usage: node scripts/test-tmailor.mjs [--poll]
//
// Curl (with full Chrome UA) works where Node.js fetch/axios hit Cloudflare.
// The script uses curl internally with a temp file for JSON body.

import { execSync } from "child_process"
import { writeFileSync, unlinkSync } from "fs"
import { randomUUID } from "crypto"

const API = "https://tmailor.com/api"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

let accesstoken = ""
let currentEmail = ""
let currentCode = ""
let messageTokens = new Map()

async function post(body) {
  const payload = JSON.stringify(body)
  const tmpFile = `${process.env.TEMP}/${randomUUID()}.json`
  writeFileSync(tmpFile, payload, "utf8")
  try {
    const stdout = execSync(
      `curl -s -X POST "${API}" -H "Content-Type: application/json" -H "Origin: https://tmailor.com" -H "Referer: https://tmailor.com/" -H "User-Agent: ${UA}" -d "@${tmpFile}"`,
      { encoding: "utf8", timeout: 15000 }
    )
    try { return JSON.parse(stdout) } catch {
      throw new Error("Cloudflare challenge — API blocked this request")
    }
  } finally {
    try { unlinkSync(tmpFile) } catch {}
  }
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts * 1000) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatTime(ts) {
  return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19)
}

async function newEmail() {
  console.log("\n=== 1. CREATE EMAIL ===")
  const d = await post({ action: "newemail", curentToken: "", fbToken: null })
  console.log("  Status :", d.msg)
  console.log("  Email  :", d.email)
  console.log("  Token  :", d.accesstoken?.slice(0, 50) + "...")
  console.log("  Created:", formatTime(d.create))

  if (d.msg !== "ok") throw new Error(`newemail failed: ${JSON.stringify(d)}`)

  accesstoken = d.accesstoken
  currentEmail = d.email
  return d
}

async function listInbox() {
  if (!accesstoken) throw new Error("No accesstoken. Call newEmail() first.")

  console.log("\n=== 2. LIST INBOX ===")
  const d = await post({
    action: "listinbox",
    accesstoken,
    fbToken: null,
    curentToken: "null",
  })

  console.log("  Status :", d.msg)
  console.log("  Email  :", d.email)
  console.log("  Code   :", d.code)
  console.log("  Data   :", d.data ? `${Object.keys(d.data).length} message(s)` : "empty")

  if (d.msg !== "ok") throw new Error(`listinbox failed: ${JSON.stringify(d)}`)

  currentCode = d.code ?? ""
  messageTokens.clear()

  if (!d.data) return []

  const msgs = Object.entries(d.data).map(([id, m]) => {
    messageTokens.set(id, m.email_id ?? "")
    return { id, ...m }
  })

  for (const m of msgs) {
    console.log(`  [${m.id.slice(0, 12)}…] ${m.subject}`)
    console.log(`         from: ${m.sender_name ?? m.sender_email}, ${timeAgo(m.receive_time)}`)
  }
  return msgs
}

async function readMessage(messageId) {
  if (!accesstoken) throw new Error("No accesstoken")
  if (!currentCode) throw new Error("No inbox code")

  let emailToken = messageTokens.get(messageId)
  if (!emailToken) {
    console.log(`  ⚠ No email_token for ${messageId.slice(0, 12)}…, using id as token`)
    emailToken = messageId
  }

  console.log(`\n=== 3. READ MESSAGE ${messageId.slice(0, 12)}… ===`)
  const d = await post({
    action: "read",
    accesstoken,
    email_code: currentCode,
    email_token: emailToken,
    fbToken: null,
    curentToken: "null",
  })

  console.log("  Status :", d.msg)
  if (d.msg !== "ok") {
    console.log("  Full   :", JSON.stringify(d).slice(0, 300))
    throw new Error("read failed")
  }

  const m = d.data
  console.log("  Subject:", m.subject)
  console.log("  From   :", `${m.sender_name ?? ""} <${m.sender_email ?? ""}>`)
  console.log("  Time   :", formatTime(m.receive_time))
  console.log("  Body   :", (m.body ?? "").slice(0, 200))
  return m
}

async function pollInbox(durationSec = 60) {
  console.log(`\n=== POLLING (${durationSec}s, every 5s) ===`)
  console.log(`  Email: ${currentEmail}\n`)

  const start = Date.now()
  let seen = new Set()

  while (Date.now() - start < durationSec * 1000) {
    try {
      const d = await post({
        action: "listinbox",
        accesstoken,
        fbToken: null,
        curentToken: "null",
      })
      if (d.msg === "ok" && d.data) {
        currentCode = d.code ?? ""
        for (const [id, m] of Object.entries(d.data)) {
          if (!seen.has(id)) {
            seen.add(id)
            messageTokens.set(id, m.email_id ?? "")
            console.log(`  [${new Date().toLocaleTimeString()}] ${m.subject} — ${m.sender_name ?? m.sender_email}`)
          }
        }
      }
    } catch {}
    const remaining = Math.round((durationSec * 1000 - (Date.now() - start)) / 1000)
    if (seen.size > 0) console.log(`  (${seen.size} msg(s), ${remaining}s left)`)
    await new Promise(r => setTimeout(r, 5000))
  }

  console.log(`\n  Done — ${seen.size} message(s)`)
  return Array.from(seen)
}

async function main() {
  try {
    await newEmail()
    console.log("\n──────────────────────────────────────")
    console.log(`  SEND TEST EMAIL TO: ${currentEmail}`)
    console.log("──────────────────────────────────────")

    let msgs = await listInbox()

    if (process.argv.includes("--poll")) {
      const ids = await pollInbox(60)
      if (ids.length > 0) await readMessage(ids[0])
    } else if (msgs.length > 0) {
      await readMessage(msgs[0].id)
    }

    console.log("\n===== SUMMARY =====")
    console.log(`  Email : ${currentEmail}`)
    console.log("===================\n")

  } catch (err) {
    console.error("\n  ERROR:", err.message)
    process.exit(1)
  }
}

main()
