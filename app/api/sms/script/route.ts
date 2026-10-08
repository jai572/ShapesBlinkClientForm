import { GATEWAY_SCRIPT } from "@/lib/smsGatewayScript";

export const dynamic = "force-dynamic";

// The phone downloads this script once. It contains no secrets.
export async function GET(request: Request) {
  const base = new URL(request.url).origin;
  return new Response(GATEWAY_SCRIPT.replace("__BASE_URL__", base), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
