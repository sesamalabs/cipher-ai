"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import SetupChart from "@/components/SetupChart";

const STATUS_LABEL = {
  active: { text: "Berjalan", cls: "pending" },
  tp1: { text: "TP1 hit", cls: "tp" },
  tp2: { text: "TP2 hit", cls: "tp" },
  tp3: { text: "TP3 hit", cls: "tp" },
  sl: { text: "SL hit", cls: "sl" },
};

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

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [screener, setScreener] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(null);
  const [symInput, setSymInput] = useState("");

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const [statsRes, draftsRes, activeRes, historyRes, screenerRes] =
      await Promise.all([
        supabase.from("signal_stats").select("*").single(),
        supabase
          .from("signals")
          .select("*")
          .eq("status", "draft")
          .order("created_at", { ascending: false }),
        supabase
          .from("signals")
          .select("*")
          .in("status", ["active", "tp1", "tp2"])
          .order("created_at", { ascending: false }),
        supabase
          .from("signals")
          .select("*")
          .not("result", "is", null)
          .order("closed_at", { ascending: false })
          .limit(10),
        supabase
          .from("screener_results")
          .select("*")
          .order("quote_volume", { ascending: false })
          .limit(8),
      ]);

    if (statsRes.data) setStats(statsRes.data);
    if (draftsRes.data) setDrafts(draftsRes.data);
    if (activeRes.data) setActive(activeRes.data);
    if (historyRes.data) setHistory(historyRes.data);
    if (screenerRes.data) setScreener(screenerRes.data);
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
    showToast(
      approve
        ? "Sinyal " + prettySymbol(signal.symbol) + " disetujui — mulai dipantau"
        : "Draft " + prettySymbol(signal.symbol) + " ditolak"
    );
    loadData();
  }

  async function refreshScreener() {
    setScanBusy(true);
    try {
      const res = await fetch("/api/screener/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal scan");
      showToast("Screener diperbarui — " + json.found + " kandidat ditemukan");
      loadData();
    } catch (e) {
      showToast("Scan gagal: " + e.message);
    }
    setScanBusy(false);
  }

  async function generateSetup(symbol) {
    const sym = String(symbol || "").trim();
    if (!sym) return;
    setGenBusy(sym.toUpperCase());
    try {
      const res = await fetch("/api/signals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym, timeframe: "4H" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat setup");
      if (json.setup) {
        showToast("Draft setup dibuat — cek panel konfirmasi");
        setSymInput("");
      } else {
        showToast("AI: " + (json.note || "tidak ada setup layak saat ini"));
      }
      loadData();
    } catch (e) {
      showToast("Gagal: " + e.message);
    }
    setGenBusy(null);
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          CIPHER<span>.</span>
        </div>
        <a className="nav-item active" href="#">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
          <span>Dashboard</span>
        </a>
        <div className="nav-footer">Sesama Labs · v0.4</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <div className="sub">Bitget spot · pemantauan otomatis tiap 5 menit</div>
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
                  <div className="label">Winrate</div>
                  <div className="value mono">
                    {stats?.winrate_pct !== null && stats?.winrate_pct !== undefined
                      ? stats.winrate_pct + "%"
                      : "—"}
                  </div>
                  <div className="delta flat">
                    {stats?.closed_count || 0} trade selesai
                  </div>
                </div>
                <div className="stat">
                  <div className="label">Sinyal aktif</div>
                  <div className="value mono">{stats?.active_count || 0}</div>
                  <div className="delta flat">{stats?.draft_count || 0} draft menunggu</div>
                </div>
                <div className="stat">
                  <div className="label">Total win</div>
                  <div className="value mono">{stats?.win_count || 0}</div>
                  <div className="delta flat">dari {stats?.closed_count || 0} closed</div>
                </div>
                <div className="stat">
                  <div className="label">Avg RR tercapai</div>
                  <div className="value mono">
                    {stats?.avg_rr ? "1:" + stats.avg_rr : "—"}
                  </div>
                  <div className="delta flat">rata-rata trade win</div>
                </div>
              </section>

              <div className="grid">
                <div>
                  <div className="section-head">
                    <h2>Sinyal aktif</h2>
                    <span className="count">{active.length} posisi · klik baris untuk detail</span>
                  </div>
                  <div className="card table-scroll" style={{ marginBottom: 28 }}>
                    {active.length === 0 ? (
                      <div className="empty" style={{ border: "none" }}>
                        Belum ada sinyal aktif
                      </div>
                    ) : (
                      <table className="wide">
                        <thead>
                          <tr>
                            <td>Pair</td>
                            <td>TF</td>
                            <td>Entry</td>
                            <td>SL</td>
                            <td>TP1</td>
                            <td>TP2</td>
                            <td>TP3</td>
                            <td>Harga kini</td>
                            <td>Status</td>
                          </tr>
                        </thead>
                        <tbody>
                          {active.map((s) => {
                            const st = STATUS_LABEL[s.status] || STATUS_LABEL.active;
                            const isOpen = expanded === s.id;
                            const risk = s.entry - s.stop_loss;
                            const rrTp3 =
                              s.tp3 && risk > 0
                                ? Math.round(((s.tp3 - s.entry) / risk) * 10) / 10
                                : null;
                            return (
                              <Fragment key={s.id}>
                                <tr
                                  className="clickable"
                                  onClick={() => setExpanded(isOpen ? null : s.id)}
                                >
                                  <td className="pair">{prettySymbol(s.symbol)}</td>
                                  <td className="tf">{s.timeframe}</td>
                                  <td className="mono">{fmt(s.entry)}</td>
                                  <td className="mono neg">{fmt(s.stop_loss)}</td>
                                  <td className="mono pos">{fmt(s.tp1)}</td>
                                  <td className="mono pos">{fmt(s.tp2)}</td>
                                  <td className="mono pos">{fmt(s.tp3)}</td>
                                  <td className="mono">{fmt(s.current_price)}</td>
                                  <td>
                                    <span className={"badge " + st.cls}>{st.text}</span>
                                  </td>
                                </tr>
                                {isOpen && (
                                  <tr className="detail-row">
                                    <td colSpan={9}>
                                      <div className="detail-box">
                                        <p className="detail-reason">
                                          {s.reasoning || "Tanpa reasoning"}
                                        </p>
                                        <p className="detail-meta">
                                          {rrTp3 ? "RR ke TP3 = 1:" + rrTp3 + " · " : ""}
                                          risiko modal {s.risk_pct}%
                                          {Array.isArray(s.tags) && s.tags.length > 0
                                            ? " · " + s.tags.join(", ")
                                            : ""}
                                          {s.source === "web" ? " · setup dari web (AI)" : ""}
                                        </p>
                                        {s.ohlcv ? (
                                          <SetupChart ohlcv={s.ohlcv} levels={s} />
                                        ) : s.chart_url ? (
                                          <a
                                            href={s.chart_url}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            <img
                                              className="chart-img"
                                              src={s.chart_url}
                                              alt={"Setup " + prettySymbol(s.symbol)}
                                            />
                                          </a>
                                        ) : (
                                          <p className="detail-meta">
                                            Belum ada chart setup untuk sinyal ini
                                          </p>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="section-head">
                    <h2>Histori terakhir</h2>
                    <span className="count">{history.length} trade · klik baris untuk catatan</span>
                  </div>
                  <div className="card">
                    {history.length === 0 ? (
                      <div className="empty" style={{ border: "none" }}>
                        Belum ada trade selesai
                      </div>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <td>Pair</td>
                            <td>TF</td>
                            <td>Hasil</td>
                            <td>RR</td>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((s) => {
                            const isOpen = expanded === "h-" + s.id;
                            return (
                              <Fragment key={s.id}>
                                <tr
                                  className="clickable"
                                  onClick={() =>
                                    setExpanded(isOpen ? null : "h-" + s.id)
                                  }
                                >
                                  <td className="pair">{prettySymbol(s.symbol)}</td>
                                  <td className="tf">{s.timeframe}</td>
                                  <td>
                                    <span className={"result " + s.result}>
                                      {s.result === "win" ? "Win" : "Loss"}
                                    </span>
                                  </td>
                                  <td className="mono">
                                    {s.result === "win" && s.rr_achieved
                                      ? "1:" + s.rr_achieved
                                      : "—"}
                                  </td>
                                </tr>
                                {isOpen && (
                                  <tr className="detail-row">
                                    <td colSpan={4}>
                                      <div className="detail-box">
                                        <p className="detail-reason">
                                          {s.reasoning || "Tanpa reasoning"}
                                        </p>
                                        <p className="detail-meta">
                                          Entry {fmt(s.entry)} · SL {fmt(s.stop_loss)} · TP1{" "}
                                          {fmt(s.tp1)} · TP3 {fmt(s.tp3)}
                                          {Array.isArray(s.tags) && s.tags.length > 0
                                            ? " · " + s.tags.join(", ")
                                            : ""}
                                        </p>
                                        {s.review ? (
                                          <p
                                            className="detail-reason"
                                            style={{
                                              borderLeftColor:
                                                s.result === "win"
                                                  ? "#16A34A"
                                                  : "#DC2626",
                                              fontWeight: 500,
                                            }}
                                          >
                                            Catatan CIPHER: {s.review}
                                          </p>
                                        ) : (
                                          <p className="detail-meta">
                                            Catatan CIPHER sedang disusun (otomatis dalam
                                            beberapa menit setelah trade selesai)
                                          </p>
                                        )}
                                        {s.ohlcv ? (
                                          <SetupChart ohlcv={s.ohlcv} levels={s} />
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="rail">
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
                                {prettySymbol(d.symbol)}{" "}
                                <span className="tf">· {d.timeframe}</span>
                              </span>
                              <span className="badge draft">
                                {d.source === "web" ? "Draft · AI web" : "Draft"}
                              </span>
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
                            ) : d.chart_url ? (
                              <a href={d.chart_url} target="_blank" rel="noreferrer">
                                <img
                                  className="chart-img"
                                  src={d.chart_url}
                                  alt={"Setup " + prettySymbol(d.symbol)}
                                  style={{ marginBottom: 12 }}
                                />
                              </a>
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

                  <div>
                    <div className="section-head">
                      <h2>Screener Bitget</h2>
                      <button
                        className="btn"
                        style={{ flex: "none", padding: "5px 12px", fontSize: 12 }}
                        disabled={scanBusy}
                        onClick={refreshScreener}
                      >
                        {scanBusy ? "Memindai…" : "Scan ulang"}
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <input
                        value={symInput}
                        onChange={(e) => setSymInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") generateSetup(symInput);
                        }}
                        placeholder="Symbol bebas, mis. SOL atau SOLUSDT"
                        style={{
                          flex: 1,
                          fontFamily: "Inter, sans-serif",
                          fontSize: 13,
                          padding: "8px 12px",
                          border: "1px solid #E5E7EB",
                          borderRadius: 8,
                          outline: "none",
                        }}
                      />
                      <button
                        className="btn primary"
                        style={{ flex: "none", padding: "8px 14px", fontSize: 12 }}
                        disabled={!!genBusy || !symInput.trim()}
                        onClick={() => generateSetup(symInput)}
                      >
                        {genBusy ? "Menganalisa…" : "Buat setup"}
                      </button>
                    </div>

                    <div className="card">
                      {screener.length === 0 ? (
                        <div className="empty" style={{ border: "none" }}>
                          Screener belum berjalan
                        </div>
                      ) : (
                        screener.map((c) => (
                          <div className="screener-item" key={c.id}>
                            <div>
                              <div className="pair">{prettySymbol(c.symbol)}</div>
                              <div
                                className={
                                  "reason" + (c.change_24h < 0 ? " negative" : "")
                                }
                              >
                                {c.reason}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div className="price mono">{fmt(c.last_price)}</div>
                              <button
                                className="btn"
                                style={{ flex: "none", padding: "4px 10px", fontSize: 11.5 }}
                                disabled={!!genBusy}
                                onClick={() => generateSetup(c.symbol)}
                              >
                                {genBusy === c.symbol ? "…" : "Buat setup"}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
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
