import { NextResponse } from "next/server";
import { runScreener } from "@/lib/screener";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/screener — dipanggil cron-job.org secara berkala
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (auth !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = await runScreener();
  return NextResponse.json({ ok: true, found: candidates.length, candidates });
}
