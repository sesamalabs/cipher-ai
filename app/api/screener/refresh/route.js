import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { runScreener } from "@/lib/screener";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/screener/refresh — dipicu tombol "Scan ulang" di dashboard.
// Hanya boleh dipanggil oleh user yang sedang login (sesi Supabase).
export async function POST() {
  const cookieStore = cookies();
  const supabase = createServerClient(
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
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = await runScreener();
  return NextResponse.json({ ok: true, found: candidates.length });
}
