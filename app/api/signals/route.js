import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// POST /api/signals — dipanggil Claude Code untuk kirim DRAFT sinyal
// Header wajib: x-api-key: <CIPHER_API_KEY>
export async function POST(request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.CIPHER_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const required = ["symbol", "entry", "stop_loss", "tp1"];
  for (const f of required) {
    if (body[f] === undefined || body[f] === null) {
      return NextResponse.json(
        { error: "Field wajib hilang: " + f },
        { status: 400 }
      );
    }
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("signals")
    .insert({
      symbol: String(body.symbol).toUpperCase().replace("/", ""),
      timeframe: body.timeframe || "4H",
      direction: "long",
      entry: body.entry,
      stop_loss: body.stop_loss,
      tp1: body.tp1,
      tp2: body.tp2 || null,
      tp3: body.tp3 || null,
      risk_pct: body.risk_pct || 3,
      reasoning: body.reasoning || "",
      tags: Array.isArray(body.tags) ? body.tags : [],
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, signal: data }, { status: 201 });
}
