"use client";
import { useEffect, useState, useMemo } from "react";

const D_AMBER = 30;
const D_RED = 50;
const PLATFORMS = ["shopify", "amazon", "flipkart", "nykaa", "myntra", "smytten"];
const PLAT_LABEL = {
  shopify: "Own Site", amazon: "Amazon", flipkart: "Flipkart",
  nykaa: "Nykaa", myntra: "Myntra", smytten: "Smytten",
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [tab, setTab] = useState("live");
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState("light");
  const [err, setErr] = useState(null);

  useEffect(() => {
    const sysDark = window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(sysDark ? "dark" : "light");
    fetch("/data/latest.json").then(r => r.json()).then(setData)
      .catch(e => setErr(String(e)));
    const m = new Date().toISOString().slice(0, 7).replace("-", "_");
    fetch(`/data/report_${m}.json`).then(r => r.ok ? r.json() : null)
      .then(setReport).catch(() => {});
  }, []);

  const T = theme === "dark" ? DARK : LIGHT;

  const stats = useMemo(() => {
    if (!data) return { inS: 0, oos: 0, deep: 0 };
    let inS = 0, oos = 0, deep = 0;
    data.products.forEach(p => PLATFORMS.forEach(pl => {
      const v = p.platforms[pl] || {};
      if (v.status === "in_stock") inS++;
      else if (v.status === "out_of_stock") oos++;
      if (v.discount_pct != null && v.discount_pct >= D_RED) deep++;
    }));
    return { inS, oos, deep };
  }, [data]);

  if (err) return <Shell T={T}><p style={{ color: T.mut }}>
    Couldn't load data. The scraper needs one successful run first. ({err})</p></Shell>;
  if (!data) return <Shell T={T}><div className="pulse" style={{ color: T.mut }}>Loading…</div></Shell>;

  const prods = data.products.filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.sku.toLowerCase().includes(q.toLowerCase()));

  return (
    <Shell T={T} theme={theme} setTheme={setTheme}>
      <header style={{ marginBottom: 30 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 30, fontWeight: 680, letterSpacing: "-0.03em", margin: 0, color: T.ink }}>
            Brillare OOS Tracker
          </h1>
          <span style={{ fontSize: 13, color: T.mut, fontFamily: "var(--mono)" }}>
            updated {new Date(data.checked_at).toLocaleString()}
          </span>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: 26 }}>
        <Kpi T={T} label="Products" value={data.products.length} tone={T.ink} />
        <Kpi T={T} label="In stock" value={stats.inS} tone="#1f9d61" />
        <Kpi T={T} label="Out of stock" value={stats.oos} tone="#e0564f" />
        <Kpi T={T} label={`Deep disc \u2265${D_RED}%`} value={stats.deep} tone="#d08a1e" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {["live", "report"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            fontFamily: "inherit", fontSize: 13.5, fontWeight: 560,
            padding: "9px 18px", borderRadius: 10, cursor: "pointer",
            border: `1px solid ${tab === t ? "transparent" : T.line}`,
            background: tab === t ? T.accent : T.card,
            color: tab === t ? "#fff" : T.mut,
            transition: "all .18s ease",
          }}>
            {t === "live" ? "Live Status" : "Monthly Report"}
          </button>
        ))}
      </div>

      {tab === "live" && (
        <>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search product or SKU\u2026" style={{
              fontFamily: "inherit", fontSize: 14, padding: "11px 15px",
              borderRadius: 12, border: `1px solid ${T.line}`,
              background: T.card, color: T.ink, width: "min(340px,100%)",
              marginBottom: 20, outline: "none",
            }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))", gap: 16 }}>
            {prods.map((p, i) => <ProductCard key={p.sku} p={p} T={T} delay={i} />)}
          </div>
        </>
      )}

      {tab === "report" && <ReportView report={report} T={T} />}

      <footer style={{ marginTop: 40, fontSize: 12, color: T.mut, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Legend c="#1f9d61" t="In stock" T={T} />
        <Legend c="#e0564f" t="Out of stock" T={T} />
        <Legend c="#9b9689" t="Unknown" T={T} />
        <Legend c={T.line} t="Not sold here" T={T} ring />
        <Legend c="#f0d9a8" t={`Discount \u2265${D_AMBER}%`} T={T} />
        <Legend c="#f4c0bd" t={`Discount \u2265${D_RED}%`} T={T} />
      </footer>
    </Shell>
  );
}

function Shell({ children, T, theme, setTheme }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, transition: "background .3s" }}>
      <style>{`
        :root{--mono:ui-monospace,'SF Mono',Menlo,monospace;
          --sans:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}
        *{box-sizing:border-box}
        body{margin:0;font-family:var(--sans);-webkit-font-smoothing:antialiased}
        @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .pulse{animation:pulse 1.4s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
      `}</style>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "38px 26px 60px" }}>
        {setTheme && (
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{
              position: "fixed", top: 22, right: 22, zIndex: 10,
              width: 38, height: 38, borderRadius: 11, cursor: "pointer",
              border: `1px solid ${T.line}`, background: T.card, color: T.ink,
              fontSize: 16, display: "grid", placeItems: "center",
              boxShadow: T.shadow,
            }} title="Toggle theme">
            {theme === "dark" ? "\u2600" : "\u263e"}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function Kpi({ T, label, value, tone }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 16,
      padding: "18px 20px", boxShadow: T.shadow,
    }}>
      <div style={{ fontSize: 11.5, color: T.mut, textTransform: "uppercase", letterSpacing: ".09em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 680, marginTop: 6, color: tone, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function dotColor(s) {
  if (s === "in_stock") return "#1f9d61";
  if (s === "out_of_stock") return "#e0564f";
  if (s === "no_link") return null;
  return "#9b9689";
}

function ProductCard({ p, T, delay }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 18,
      padding: 20, boxShadow: T.shadow, animation: "rise .5s ease both",
      animationDelay: `${Math.min(delay * 28, 600)}ms`,
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 620, color: T.ink, lineHeight: 1.35 }}>{p.name}</div>
        <div style={{ fontSize: 11.5, color: T.mut, fontFamily: "var(--mono)", marginTop: 3 }}>{p.sku} \u00b7 {p.type}</div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {PLATFORMS.map(pl => {
          const v = p.platforms[pl] || {};
          const dc = dotColor(v.status);
          const disc = v.discount_pct;
          const discBg = disc == null ? "transparent"
            : disc >= D_RED ? (T.dark ? "#4a2422" : "#fbe9e8")
            : disc >= D_AMBER ? (T.dark ? "#463818" : "#fbf2dd") : "transparent";
          return (
            <div key={pl} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 11px", borderRadius: 10,
              background: discBg !== "transparent" ? discBg : T.row,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{
                  width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                  background: dc || "transparent",
                  border: dc ? "none" : `1.5px solid ${T.line}`,
                }} />
                <span style={{ fontSize: 13, color: T.ink, fontWeight: 520 }}>{PLAT_LABEL[pl]}</span>
              </div>
              <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                {v.selling != null ? (
                  <span style={{ color: T.ink, fontWeight: 600 }}>
                    \u20b9{v.selling}
                    {disc != null && disc > 0 &&
                      <span style={{ marginLeft: 6, color: disc >= D_RED ? "#e0564f" : disc >= D_AMBER ? "#d08a1e" : T.mut }}>\u2212{disc}%</span>}
                  </span>
                ) : (
                  <span style={{ color: T.mut, fontSize: 11.5 }}>
                    {v.status === "no_link" ? "\u2014" : v.status === "out_of_stock" ? "OOS" :
                     v.status === "in_stock" ? "in stock" : (v.status || "\u2014")}
                  </span>
                )}
                {v.mrp != null && v.mrp !== v.selling &&
                  <div style={{ color: T.mut, textDecoration: "line-through", fontSize: 10.5 }}>\u20b9{v.mrp}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportView({ report, T }) {
  if (!report) return <p style={{ color: T.mut, fontSize: 14 }}>
    No monthly report yet. It generates once the scraper has run on several days.</p>;
  const rows = report.rows.filter(r => r.days_oos > 0 || r.max_discount)
    .sort((a, b) => b.days_oos - a.days_oos);
  return (
    <div>
      <div style={{ fontSize: 13, color: T.mut, fontFamily: "var(--mono)", marginBottom: 14 }}>
        {report.month} \u00b7 generated {new Date(report.generated).toLocaleString()}
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>
            {["SKU", "Platform", "Days tracked", "Days OOS", "Longest streak", "Max disc", "Avg disc"].map(h => (
              <th key={h} style={{ textAlign: h === "SKU" || h === "Platform" ? "left" : "center",
                padding: "13px 14px", fontSize: 11, textTransform: "uppercase",
                letterSpacing: ".07em", color: T.mut, fontWeight: 650,
                background: T.row }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 12, color: T.mut }}>{r.sku}</td>
                <td style={{ padding: "12px 14px", color: T.ink }}>{r.platform}</td>
                <td style={{ padding: "12px 14px", textAlign: "center", color: T.ink }}>{r.days_tracked}</td>
                <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: r.days_oos > 0 ? 680 : 400, color: r.days_oos > 0 ? "#e0564f" : T.ink }}>{r.days_oos}</td>
                <td style={{ padding: "12px 14px", textAlign: "center", color: T.ink }}>{r.longest_oos_streak}</td>
                <td style={{ padding: "12px 14px", textAlign: "center", color: T.ink }}>{r.max_discount != null ? r.max_discount + "%" : "\u2014"}</td>
                <td style={{ padding: "12px 14px", textAlign: "center", color: T.ink }}>{r.avg_discount != null ? r.avg_discount + "%" : "\u2014"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Legend({ c, t, T, ring }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: ring ? "transparent" : c, border: ring ? `1.5px solid ${c}` : "none" }} />
      {t}
    </span>
  );
}

const LIGHT = {
  dark: false, bg: "#f6f5f1", card: "#fffefb", row: "#f4f2ec",
  ink: "#1d1b16", mut: "#827c6e", line: "#e6e2d6", accent: "#1f4a3a",
  shadow: "0 1px 2px rgba(40,35,20,.04), 0 6px 18px rgba(40,35,20,.05)",
};
const DARK = {
  dark: true, bg: "#16151b", card: "#1f1e26", row: "#26252e",
  ink: "#ecebe6", mut: "#8f8b82", line: "#322f3a", accent: "#2f7d5f",
  shadow: "0 1px 2px rgba(0,0,0,.3), 0 8px 22px rgba(0,0,0,.35)",
};