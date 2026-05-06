// API key endpoints removed — authorization is not used
export default async function handler(): Promise<Response> {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
}

export const config = { runtime: "edge" }
