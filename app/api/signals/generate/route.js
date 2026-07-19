import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { analyzeSymbol } from "@/lib/analyze";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/signals/generate — dipicu tombol "Buat setup" di dashboard.
// Body: { symbol: "SOLUSDT", timeframe?: "4H" }
// Hanya untuk user yang sedang login.
export async function POST(request) {
  const cookieStore = cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY belum diisi di environment Vercel" },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  let symbol = String(body.symbol || "").toUpperCase().replace("/", "").trim();
  if (!symbol) {
    return NextResponse.json({ error: "Symbol wajib diisi" }, { status: 400 });
  }
  if (!symbol.endsWith("USDT")) symbol = symbol + "USDT";
  const timeframe = ["15m", "1H", "4H", "1D"].includes(body.timeframe)
    ? body.timeframe
    : "4H";

  let result;
  try {
    result = await analyzeSymbol(symbol, timeframe);
  } catch (e) {
    return NextResponse.json(
      { error: "Gagal analisa: " + String(e.message || e).slice(0, 200) },
      { status: 500 }
    );
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.note }, { status: 422 });
  }
  if (!result.setup) {
    return NextResponse.json({ ok: true, setup: false, note: result.note });
  }

  const d = result.data;
  const admin = createAdminClient();
  const { data: signal, error } = await admin
    .from("signals")
    .insert({
      symbol,
      timeframe,
      direction: "long",
      entry: d.entry,
      stop_loss: d.stop_loss,
      tp1: d.tp1,
      tp2: d.tp2,
      tp3: d.tp3,
      risk_pct: 3,
      reasoning: d.reasoning,
      tags: d.tags,
      status: "draft",
      source: "web",
      ohlcv: d.ohlcv,
      current_price: d.last_price,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, setup: true, signal }, { status: 201 });
}
