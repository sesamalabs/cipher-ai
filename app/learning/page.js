"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import SetupChart from "@/components/SetupChart";
import Sidebar from "@/components/Sidebar";

function fmt(n) {
  if (n === null || n === undefined) return "—";
  const num = parseFloat(n);
  if (num >= 1000) return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(2);
  return num.toPrecision(3);
}

function prettySymbol(s) {
  return s.replace("USDT", "/USDT");
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return mins + " menit lalu";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + " jam lalu";
  return Math.floor(hrs / 24) + " hari lalu";
}

export default function LearningPage() {
  const router = useRouter();
  const [closed, setClosed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("all"); // all | win | loss
  const [asset, setAsset] = useState("crypto"); // crypto | gold

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("signals")
      .select("*")
      .eq("asset_class", asset)
      .not("result", "is", null)
      .order("closed_at", { ascending: false })
      .limit(100);
    if (data) setClosed(data);
    setLoading(false);
  }, [asset]);

  useEffect(() => {
    setLoading(true);
    loadData();
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const wins = closed.filter((s) => s.result === "win").length;
  const losses = closed.filter((s) => s.result === "loss").length;
  const total = closed.length;
  const winratePct = total > 0 ? Math.round((wins / total) * 100) : null;
  const reviewedCount = closed.filter((s) => s.review).length;

  // Performa per pola/tag
  const tagMap = {};
  for (const s of closed) {
    if (!Array.isArray(s.tags)) continue;
    for (const tag of s.tags) {
      if (!tagMap[tag]) tagMap[tag] = { n: 0, win: 0 };
      tagMap[tag].n += 1;
      if (s.result === "win") tagMap[tag].win += 1;
    }
  }
  const tagRows = Object.entries(tagMap)
    .map(([tag, s]) => ({ tag, ...s, pct: Math.round((s.win / s.n) * 100) }))
    .sort((a, b) => b.n - a.n);

  const filtered = closed.filter((s) => (filter === "all" ? true : s.result === filter));

  function filterBtnStyle(isActive) {
    return {
      flex: "none",
      padding: "5px 12px",
      fontSize: 12,
      background: isActive ? "#111318" : "#fff",
      color: isActive ? "#fff" : "#111318",
    };
  }

  return (
    <div className="app">
      <Sidebar active="learning" />

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Pembelajaran</h1>
            <div className="sub">Bagaimana CIPHER belajar dari tiap trade yang selesai</div>
          </div>
          <div className="top-right">
            <span className="live">Live</span>
            <button className="avatar" onClick={logout} title="Keluar">
              RD
            </button>
          </div>
        </header>

        <div className="content">
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            <button className="btn" style={filterBtnStyle(asset === "crypto")} onClick={() => setAsset("crypto")}>
              Crypto
            </button>
            <button className="btn" style={filterBtnStyle(asset === "gold")} onClick={() => setAsset("gold")}>
              Gold XAUUSD
            </button>
          </div>

          {loading ? (
            <div className="loading">Memuat data…</div>
          ) : total === 0 ? (
            <div className="card">
              <div className="empty" style={{ border: "none" }}>
                Belum ada trade {asset === "gold" ? "XAUUSD" : "crypto"} selesai — belum ada yang
                bisa dipelajari CIPHER di sini. Begitu sinyal pertama hit TP atau SL, evaluasinya
                akan muncul.
              </div>
            </div>
          ) : (
            <>
              <section className="stats">
                <div className="stat">
                  <div className="label">Winrate</div>
                  <div className="value mono">{winratePct !== null ? winratePct + "%" : "—"}</div>
                  <div className="delta flat">{total} trade selesai</div>
                </div>
                <div className="stat">
                  <div className="label">Menang : Kalah</div>
                  <div
                    className="value mono"
                    style={{ color: wins > losses ? "#16A34A" : wins < losses ? "#DC2626" : "#111318" }}
                  >
                    {wins} : {losses}
                  </div>
                  <div className="delta flat">target: menang jauh lebih banyak</div>
                </div>
                <div className="stat">
                  <div className="label">Pola teridentifikasi</div>
                  <div className="value mono">{tagRows.length}</div>
                  <div className="delta flat">dari tag reasoning tiap sinyal</div>
                </div>
                <div className="stat">
                  <div className="label">Sudah dievaluasi</div>
                  <div className="value mono">{reviewedCount}</div>
                  <div className="delta flat">dari {total} trade selesai</div>
                </div>
              </section>

              <div className="grid">
                <div>
                  <div className="section-head">
                    <h2>Riwayat pembelajaran</h2>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn" style={filterBtnStyle(filter === "all")} onClick={() => setFilter("all")}>
                        Semua
                      </button>
                      <button className="btn" style={filterBtnStyle(filter === "win")} onClick={() => setFilter("win")}>
                        Menang
                      </button>
                      <button className="btn" style={filterBtnStyle(filter === "loss")} onClick={() => setFilter("loss")}>
                        Kalah
                      </button>
                    </div>
                  </div>

                  <div className="signal-list">
                    {filtered.map((s) => {
                      const isOpen = expanded === s.id;
                      return (
                        <div className="sig-card" key={s.id}>
                          <div className="sig-head" onClick={() => setExpanded(isOpen ? null : s.id)}>
                            <div className="sig-title">
                              <span className="pair">
                                {asset === "gold" ? "XAUUSD" : prettySymbol(s.symbol)}
                              </span>
                              <span className="tf">{s.timeframe}</span>
                            </div>
                            <div className="sig-right">
                              <span className="tf">{timeAgo(s.closed_at)}</span>
                              <span className={"result " + s.result}>
                                {s.result === "win" ? "Win" : "Loss"}
                              </span>
                            </div>
                          </div>
                          <div className="sig-detail" style={{ borderTop: "1px solid var(--line-soft)" }}>
                            {s.review ? (
                              <p
                                className="detail-reason"
                                style={{
                                  borderLeftColor: s.result === "win" ? "#16A34A" : "#DC2626",
                                  fontWeight: 500,
                                }}
                              >
                                Catatan CIPHER: {s.review}
                              </p>
                            ) : (
                              <p className="detail-meta">
                                Catatan CIPHER sedang disusun (otomatis beberapa menit setelah
                                trade selesai)
                              </p>
                            )}
                            {isOpen && (
                              <>
                                <p className="detail-meta">
                                  Alasan entry: {s.reasoning || "tanpa reasoning"}
                                </p>
                                <p className="detail-meta">
                                  Entry {fmt(s.entry)} · SL {fmt(s.stop_loss)} · TP1 {fmt(s.tp1)} ·
                                  TP2 {fmt(s.tp2)} · TP3 {fmt(s.tp3)}
                                  {s.result === "win" && s.rr_achieved
                                    ? " · RR tercapai 1:" + s.rr_achieved
                                    : ""}
                                  {Array.isArray(s.tags) && s.tags.length > 0
                                    ? " · " + s.tags.join(", ")
                                    : ""}
                                </p>
                                {s.ohlcv ? <SetupChart ohlcv={s.ohlcv} levels={s} /> : null}
                              </>
                            )}
                            <button
                              className="btn"
                              style={{ marginTop: 10, padding: "5px 10px", fontSize: 11.5 }}
                              onClick={() => setExpanded(isOpen ? null : s.id)}
                            >
                              {isOpen ? "Sembunyikan detail" : "Lihat detail & chart"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rail">
                  <div>
                    <div className="section-head">
                      <h2>Performa per pola</h2>
                      <span className="count">min. 1 trade</span>
                    </div>
                    <div className="card">
                      {tagRows.length === 0 ? (
                        <div className="empty" style={{ border: "none" }}>
                          Belum ada pola tercatat
                        </div>
                      ) : (
                        tagRows.map((t) => (
                          <div className="screener-item" key={t.tag}>
                            <div className="screener-info">
                              <div className="pair">{t.tag}</div>
                              <div className="detail-meta" style={{ marginBottom: 0 }}>
                                {t.win} menang dari {t.n} trade
                                {t.n < 3 ? " · data masih sedikit" : ""}
                              </div>
                            </div>
                            <div
                              className="price mono"
                              style={{
                                color: t.pct >= 50 ? "#16A34A" : "#DC2626",
                                fontWeight: 600,
                              }}
                            >
                              {t.pct}%
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="confirm-card" style={{ border: "1px solid var(--line)" }}>
                    <p className="detail-meta" style={{ margin: 0 }}>
                      Statistik di atas khusus {asset === "gold" ? "XAUUSD" : "crypto"} — tidak
                      tercampur dengan aset lain, karena pola dan perilaku pasarnya berbeda. Setiap
                      kali kamu buat setup baru untuk aset ini, CIPHER membaca winrate, performa
                      per pola, dan pelajaran dari trade-trade terakhir di atas sebelum menyusun
                      sinyal baru. Dengan data yang masih sedikit, angka-angka ini masih bisa
                      berubah banyak; makin banyak trade selesai, makin bisa dipercaya.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
