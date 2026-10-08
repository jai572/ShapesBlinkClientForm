import { createAnonClient } from "@/lib/relocationViewer";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The phone reports: "I sent it" or "it failed".
export async function POST(request: Request) {
  const key = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { id?: unknown; ok?: unknown; error?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.id !== "string" || !UUID.test(body.id) || typeof body.ok !== "boolean") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const { error } = await createAnonClient().rpc("relocation_sms_gateway_result", {
    p_key: key,
    p_id: body.id,
    p_ok: body.ok,
    p_error: typeof body.error === "string" && body.error ? body.error : null,
  });
  if (error) {
    return Response.json({ error: error.code === "28000" ? "unauthorized" : "unavailable" }, { status: error.code === "28000" ? 401 : 503 });
  }
  return Response.json({ ok: true });
}
