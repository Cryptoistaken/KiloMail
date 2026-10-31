/**
 * Cloudflare Pages router for the KiloMail API.
 *
 * The handlers in /api are written as plain `export default (req: Request) => Response` functions
 * that parse the request URL themselves (that is also what Vercel's edge runtime expects), so this
 * file only has to pick the right one — no rewriting of the handlers.
 *
 * Bindings: the handlers read their config from `process.env.*`. With the `nodejs_compat`
 * compatibility flag Cloudflare populates `process.env` from the project's variables, and the two
 * lines below also copy them in by hand so this works with or without the flag.
 *
 * Adding a provider? Add its file to api/providers/ AND one line to PROVIDERS below.
 */

type Handler = (req: Request) => Promise<Response>

interface Ctx {
  request: Request
  env: Record<string, unknown>
}

const PROVIDERS: Record<string, () => Promise<{ default: Handler }>> = {
  guerrillamail: () => import("../../api/providers/guerrillamail"),
  maildrop:      () => import("../../api/providers/maildrop"),
  mailtm:        () => import("../../api/providers/mailtm"),
  tempmailio:    () => import("../../api/providers/tempmailio"),
  tempmailplus:  () => import("../../api/providers/tempmailplus"),
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })

export const onRequest = async ({ request, env }: Ctx): Promise<Response> => {
  // Bindings must be on process.env before a handler module is imported: the Redis client is
  // constructed at module scope.
  const g = globalThis as { process?: { env?: Record<string, unknown> } }
  if (g.process?.env) Object.assign(g.process.env, env)
  else g.process = { env: { ...env } }

  // ["inbox", "me@factoryai.tech", "stream"] etc.
  const seg = new URL(request.url).pathname.split("/").filter(Boolean).slice(1)
  const [section, first, second] = seg

  let load: (() => Promise<{ default: Handler }>) | undefined

  if (section === "inbox" && first) {
    // "stream" is a literal segment and wins over the [id] one, exactly like on Vercel
    load = second === "stream"
      ? () => import("../../api/inbox/[email]/stream")
      : second
        ? () => import("../../api/inbox/[email]/[id]")
        : () => import("../../api/inbox/[email]")
  } else if (section === "providers" && first) {
    load = PROVIDERS[first]
  } else if (section === "webhook") {
    load = () => import("../../api/webhook")
  } else if (section === "test") {
    load = () => import("../../api/test")
  }

  if (!load) return json({ error: "Unknown endpoint" }, 404)

  try {
    const handler = (await load()).default
    return await handler(request)
  } catch (e) {
    console.error("api error", new URL(request.url).pathname, e)
    return json({ error: "Internal error" }, 500)
  }
}
