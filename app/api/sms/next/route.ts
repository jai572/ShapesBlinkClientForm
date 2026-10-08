import { createAnonClient } from "@/lib/relocationViewer";

export const dynamic = "force-dynamic";

const bearer = (request: Request) => (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

// The phone asks: "what is the next text I should send?"
export async function GET(request: Request) {
  const key = bearer(request);
  if (!key) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await createAnonClient().rpc("relocation_sms_gateway_next", { p_key: key });
  if (error) {
    return Response.json({ error: error.code === "28000" ? "unauthorized" : "unavailable" }, { status: error.code === "28000" ? 401 : 503 });
  }
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
