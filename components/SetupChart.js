"use client";

// Chart candlestick SVG yang digambar dashboard sendiri (tanpa TradingView)
// props: ohlcv = [[t,o,h,l,c],...], levels = { entry, stop_loss, tp1, tp2, tp3 }
export default function SetupChart({ ohlcv, levels }) {
  if (!Array.isArray(ohlcv) || ohlcv.length < 10) return null;

  const W = 640;
  const H = 300;
  const PAD_R = 64;
  const PAD_Y = 14;

  const candles = ohlcv.slice(-100);
  const lows = candles.map((c) => c[3]);
  const highs = candles.map((c) => c[2]);
  const levelVals = [
    levels?.entry,
    levels?.stop_loss,
    levels?.tp1,
    levels?.tp2,
    levels?.tp3,
  ]
    .map(Number)
    .filter((n) => isFinite(n) && n > 0);

  let min = Math.min(...lows, ...levelVals);
  let max = Math.max(...highs, ...levelVals);
  const span = max - min || 1;
  min -= span * 0.04;
  max += span * 0.04;

  const y = (p) => PAD_Y + ((max - p) / (max - min)) * (H - PAD_Y * 2);
  const cw = (W - PAD_R) / candles.length;
  const bw = Math.max(1.5, cw * 0.6);

  const lines = [
    { key: "sl", label: "SL", val: levels?.stop_loss, color: "#DC2626" },
    { key: "entry", label: "Entry", val: levels?.entry, color: "#111318" },
    { key: "tp1", label: "TP1", val: levels?.tp1, color: "#16A34A" },
    { key: "tp2", label: "TP2", val: levels?.tp2, color: "#16A34A" },
    { key: "tp3", label: "TP3", val: levels?.tp3, color: "#16A34A" },
  ].filter((l) => isFinite(Number(l.val)) && Number(l.val) > 0);

  const fmtP = (n) => {
    const v = Number(n);
    if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
    if (v >= 1) return v.toFixed(2);
    return v.toPrecision(3);
  };

  return (
    <svg
      viewBox={"0 0 " + W + " " + H}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        marginTop: 4,
      }}
      role="img"
      aria-label="Chart setup trading"
    >
      {candles.map((c, i) => {
        const [, o, h, l, cl] = c;
        const x = i * cw + cw / 2;
        const up = cl >= o;
        const color = up ? "#16A34A" : "#DC2626";
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(h)} y2={y(l)} stroke={color} strokeWidth="1" />
            <rect
              x={x - bw / 2}
              y={y(Math.max(o, cl))}
              width={bw}
              height={Math.max(1, Math.abs(y(o) - y(cl)))}
              fill={color}
            />
          </g>
        );
      })}
      {lines.map((l) => (
        <g key={l.key}>
          <line
            x1={0}
            x2={W - PAD_R}
            y1={y(Number(l.val))}
            y2={y(Number(l.val))}
            stroke={l.color}
            strokeWidth="1.2"
            strokeDasharray={l.key === "entry" ? "6 3" : "3 3"}
          />
          <text
            x={W - PAD_R + 6}
            y={y(Number(l.val)) + 3.5}
            fontSize="10.5"
            fontFamily="IBM Plex Mono, monospace"
            fill={l.color}
          >
            {l.label + " " + fmtP(l.val)}
          </text>
        </g>
      ))}
    </svg>
  );
}
