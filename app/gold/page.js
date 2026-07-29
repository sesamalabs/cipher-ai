"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import SetupChart from "@/components/SetupChart";
import Sidebar from "@/components/Sidebar";

const STATUS_LABEL = {
  active: { text: "Berjalan", cls: "pending" },
  tp1: { text: "TP1 hit", cls: "tp" },
  tp2: { text: "TP2 hit", cls: "tp" },
  tp3: { text: "TP3 hit", cls: "tp" },
  sl: { text: "SL hit", cls: "sl" },
};

function fmt(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toFixed(2);
}

function timeAgo(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return mins + " menit lalu";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + " jam lalu";
  return Math.floor(hrs / 24) + " hari lalu";
}

export default function GoldPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState([]);
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [genBusy, setGenBusy] = useState(false);
  const [priceBusy, setPriceBusy] = useState(false);
  const [timeframe, setTimeframe] = useState("4H");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [draftsRes, activeRes, historyRes] = await Promise.all([
      supabase
        .from("signals")
        .select("*")
        .eq("asset_class", "gold")
        .eq("status", "draft")
        .order("created_at", { ascending: false }),
      supabase
        .from("signals")
        .select("*")
        .eq("asset_class", "gold")
        .in("status", ["active", "tp1", "tp2"])
        .order("created_at", { ascending: false }),
      supabase
        .from("signals")
        .select("*")
        .eq("asset_class", "gold")
        .not("result", "is", null)
        .order("closed_at", { ascending: false })
        .limit(10),
    ]);
    if (draftsRes.data) setDrafts(draftsRes.data);
    if (activeRes.data) setActive(activeRes.data);
    if (historyRes.data) setHistory(historyRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }

  async function decide(signal, approve) {
    setBusy(signal.id);
    const supabase = createClient();
    const update = approve
      ? { status: "active", approved_at: new Date().toISOString() }
      : { status: "rejected", closed_at: new Date().toISOString() };
    const { error } = await supabase.from("signals").update(update).eq("id", signal.id);
    setBusy(null);
    if (error) {
      showToast("Gagal menyimpan: " + error.message);
      return;
    }
    showToast(approve ? "Sinyal XAUUSD disetujui — mulai dipantau" : "Draft XAUUSD ditolak");
    loadData();
  }

  async function refreshPrices() {
    setPriceBusy(true);
    try {
      const res = await fetch("/api/signals/refresh-prices", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal ambil harga");
      showToast("Harga diperbarui");
      loadData();
    } catch (e) {
      showToast("Gagal: " + e.message);
    }
    setPriceBusy(false);
  }

  async function generateGold() {
    setGenBusy(true);
    try {
      const res = await fetch("/api/gold/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframe }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat setup");
      if (json.setup) {
        showToast("Draft setup XAUUSD dibuat — cek panel konfirmasi");
      } else {
        showToast("AI: " + (json.note || "tidak ada setup layak saat ini"));
      }
      loadData();
    } catch (e) {
      showToast("Gagal: " + e.message);
    }
    setGenBusy(false);
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const closedCount = history.length;
  const winCount = history.filter((s) => s.result === "win").length;
  const winratePct = closedCount > 0 ? Math.round((winCount / closedCount) * 100) : null;
  const lastChecked = active.reduce((latest, s) => {
    if (!s.last_checked_at) return latest;
    if (!latest || new Date(s.last_checked_at) > new Date(latest)) return s.last_checked_at;
    return latest;
  }, null);

  return (
    <div className="app">
      <Sidebar active="gold" />

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Gold XAUUSD</h1>
            <div className="sub">Price action (rejection · CHOCH · S/R · trendline) · manual per aset</div>
          </div>
          <div className="top-right">
            <span className="live">Live</span>
            <button className="avatar" onClick={logout} title="Keluar">
              RD
            </button>
          </div>
        </header>

        <div className="content">
          {loading ? (
            <div className="loading">Memuat data…</div>
          ) : (
            <>
              <section className="stats">
                <div className="stat">
                  <div className="label">Winrate XAUUSD</div>
                  <div className="value mono">
                    {winratePct !== null ? winratePct + "%" : "—"}
                  </div>
                  <div className="delta flat">{closedCount} trade selesai</div>
                </div>
                <div className="stat">
                  <div className="label">Sinyal aktif</div>
                  <div className="value mono">{active.length}</div>
                  <div className="delta flat">{drafts.length} draft menunggu</div>
                </div>
                <div className="stat">
                  <div className="label">Total win</div>
                  <div className="value mono">{winCount}</div>
                  <div className="delta flat">dari {closedCount} closed</div>
                </div>
                <div className="stat">
                  <div className="label">Update harga</div>
                  <div className="value mono" style={{ fontSize: 15 }}>
                    {active.length > 0 ? timeAgo(lastChecked) || "—" : "—"}
                  </div>
                  <div className="delta flat">pasar forex tutup akhir pekan</div>
                </div>
              </section>

              <div className="grid">
                <div>
                  <div className="section-head">
                    <h2>Sinyal aktif</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="count">{active.length} posisi · ketuk untuk detail</span>
                      <button
                        className="btn"
                        style={{ flex: "none", padding: "5px 12px", fontSize: 12, whiteSpace: "nowrap" }}
                        disabled={priceBusy}
                        onClick={refreshPrices}
                      >
                        {priceBusy ? "Mengambil…" : "Refresh harga"}
                      </button>
                    </div>
                  </div>

                  {active.length === 0 ? (
                    <div className="card" style={{ marginBottom: 28 }}>
                      <div className="empty" style={{ border: "none" }}>
                        Belum ada sinyal XAUUSD aktif
                      </div>
                    </div>
                  ) : (
                    <div className="signal-list" style={{ marginBottom: 28 }}>
                      {active.map((s) => {
                        const st = STATUS_LABEL[s.status] || STATUS_LABEL.active;
                        const isOpen = expanded === s.id;
                        const risk = s.entry - s.stop_loss;
                        const rrTp3 =
                          s.tp3 && risk > 0
                            ? Math.round(((s.tp3 - s.entry) / risk) * 10) / 10
                            : null;
                        return (
                          <div className="sig-card" key={s.id}>
                            <div className="sig-head" onClick={() => setExpanded(isOpen ? null : s.id)}>
                              <div className="sig-title">
                                <span className="pair">XAUUSD</span>
                                <span className="tf">{s.timeframe}</span>
                              </div>
                              <div className="sig-right">
                                <span className="sig-nowprice mono">{fmt(s.current_price)}</span>
                                <span className={"badge " + st.cls}>{st.text}</span>
                              </div>
                            </div>
                            <div className="sig-levels">
                              <div className="sl-item">
                                <span className="l">Entry</span>
                                <span className="v mono">{fmt(s.entry)}</span>
                              </div>
                              <div className="sl-item">
                                <span className="l">SL</span>
                                <span className="v mono neg">{fmt(s.stop_loss)}</span>
                              </div>
                              <div className="sl-item">
                                <span className="l">TP1</span>
                                <span className="v mono pos">{fmt(s.tp1)}</span>
                              </div>
                              <div className="sl-item">
                                <span className="l">TP2</span>
                                <span className="v mono pos">{fmt(s.tp2)}</span>
                              </div>
                              <div className="sl-item">
                                <span className="l">TP3</span>
                                <span className="v mono pos">{fmt(s.tp3)}</span>
                              </div>
                            </div>
                            {isOpen && (
                              <div className="sig-detail">
                                <p className="detail-reason">{s.reasoning || "Tanpa reasoning"}</p>
                                <p className="detail-meta">
                                  {rrTp3 ? "RR ke TP3 = 1:" + rrTp3 + " · " : ""}
                                  risiko modal {s.risk_pct}%
                                  {Array.isArray(s.tags) && s.tags.length > 0
                                    ? " · " + s.tags.join(", ")
                                    : ""}
                                </p>
                                {s.ohlcv ? <SetupChart ohlcv={s.ohlcv} levels={s} /> : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="section-head">
                    <h2>Histori terakhir</h2>
                    <span className="count">{history.length} trade · ketuk untuk catatan</span>
                  </div>

                  {history.length === 0 ? (
                    <div className="card">
                      <div className="empty" style={{ border: "none" }}>
                        Belum ada trade XAUUSD selesai
                      </div>
                    </div>
                  ) : (
                    <div className="signal-list">
                      {history.map((s) => {
                        const isOpen = expanded === "h-" + s.id;
                        return (
                          <div className="sig-card" key={s.id}>
                            <div
                              className="sig-head"
                              onClick={() => setExpanded(isOpen ? null : "h-" + s.id)}
                            >
                              <div className="sig-title">
                                <span className="pair">XAUUSD</span>
                                <span className="tf">{s.timeframe}</span>
                              </div>
                              <div className="sig-right">
                                <span className={"result " + s.result}>
                                  {s.result === "win" ? "Win" : "Loss"}
                                </span>
                                <span className="tf mono">
                                  {s.result === "win" && s.rr_achieved ? "1:" + s.rr_achieved : "—"}
                                </span>
                              </div>
                            </div>
                            {isOpen && (
                              <div className="sig-detail">
                                <p className="detail-reason">{s.reasoning || "Tanpa reasoning"}</p>
                                <p className="detail-meta">
                                  Entry {fmt(s.entry)} · SL {fmt(s.stop_loss)} · TP1 {fmt(s.tp1)} · TP3{" "}
                                  {fmt(s.tp3)}
                                  {Array.isArray(s.tags) && s.tags.length > 0
                                    ? " · " + s.tags.join(", ")
                                    : ""}
                                </p>
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
                                {s.ohlcv ? <SetupChart ohlcv={s.ohlcv} levels={s} /> : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rail">
                  <div>
                    <div className="section-head">
                      <h2>Analisa baru</h2>
                    </div>
                    <div className="confirm-card" style={{ border: "1px solid var(--line)" }}>
                      <p className="detail-meta" style={{ marginBottom: 10 }}>
                        Timeframe
                      </p>
                      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                        {["15m", "1H", "4H", "1D"].map((tf) => (
                          <button
                            key={tf}
                            className="btn"
                            style={{
                              padding: "6px 10px",
                              fontSize: 12,
                              background: timeframe === tf ? "#111318" : "#fff",
                              color: timeframe === tf ? "#fff" : "#111318",
                            }}
                            onClick={() => setTimeframe(tf)}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                      <button
                        className="btn primary"
                        style={{ width: "100%" }}
                        disabled={genBusy}
                        onClick={generateGold}
                      >
                        {genBusy ? "Menganalisa…" : "Analisa XAUUSD sekarang"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="section-head">
                      <h2>Menunggu konfirmasi</h2>
                      <span className="count">{drafts.length} draft</span>
                    </div>
                    {drafts.length === 0 ? (
                      <div className="empty">Tidak ada draft menunggu konfirmasi</div>
                    ) : (
                      drafts.map((d) => {
                        const risk = d.entry - d.stop_loss;
                        const rrTp3 =
                          d.tp3 && risk > 0
                            ? Math.round(((d.tp3 - d.entry) / risk) * 10) / 10
                            : null;
                        return (
                          <div className="confirm-card" key={d.id}>
                            <div className="confirm-top">
                              <span className="confirm-pair">
                                XAUUSD <span className="tf">· {d.timeframe}</span>
                              </span>
                              <span className="badge draft">Draft · AI</span>
                            </div>
                            <p className="confirm-reason">{d.reasoning}</p>
                            <div className="levels">
                              <div className="level entry">
                                <div className="l">Entry</div>
                                <div className="v mono">{fmt(d.entry)}</div>
                              </div>
                              <div className="level sl">
                                <div className="l">SL</div>
                                <div className="v mono">{fmt(d.stop_loss)}</div>
                              </div>
                              <div className="level tp">
                                <div className="l">TP1</div>
                                <div className="v mono">{fmt(d.tp1)}</div>
                              </div>
                              <div className="level tp">
                                <div className="l">TP2</div>
                                <div className="v mono">{fmt(d.tp2)}</div>
                              </div>
                              <div className="level tp">
                                <div className="l">TP3</div>
                                <div className="v mono">{fmt(d.tp3)}</div>
                              </div>
                            </div>
                            {d.ohlcv ? (
                              <div style={{ marginBottom: 12 }}>
                                <SetupChart ohlcv={d.ohlcv} levels={d} />
                              </div>
                            ) : null}
                            <p className="rr-note">
                              {rrTp3 ? "RR ke TP3 = 1:" + rrTp3 + " · " : ""}
                              risiko modal {d.risk_pct}%
                            </p>
                            <div className="actions">
                              <button
                                className="btn primary"
                                disabled={busy === d.id}
                                onClick={() => decide(d, true)}
                              >
                                {busy === d.id ? "…" : "Setujui"}
                              </button>
                              <button
                                className="btn"
                                disabled={busy === d.id}
                                onClick={() => decide(d, false)}
                              >
                                Tolak
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </div>
  );
}
