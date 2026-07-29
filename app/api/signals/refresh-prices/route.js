import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkPrices } from "@/lib/priceCheck";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/signals/refresh-prices — dipicu tombol "Refresh harga" di dashboard.
// Sama seperti cron, tapi dipicu manual oleh user yang login (bukan header CRON_SECRET).
export async function POST() {
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

  const admin = createAdminClient();
  try {
    const { checked, results } = await checkPrices(admin);
    return NextResponse.json({ ok: true, checked, results });
  } catch (e) {
    return NextResponse.json(
      { error: "Gagal ambil harga: " + String(e.message || e).slice(0, 200) },
      { status: 500 }
    );
  }
}
