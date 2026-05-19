"use client";
import { useEffect, useState, useMemo } from "react";

const D_AMBER = 30, D_RED = 50;
const PLATFORMS = ["shopify", "amazon", "flipkart", "nykaa", "myntra", "smytten"];
const PL = { shopify: "Own", amazon: "Amzn", flipkart: "Flpk", nykaa: "Nyka", myntra: "Mynt", smytten: "Smyt" };
const PLF = { shopify: "Own Site", amazon: "Amazon", flipkart: "Flipkart", nykaa: "Nykaa", myntra: "Myntra", smytten: "Smytten" };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [tab, setTab] = useState("oos");
  const [q, setQ] = useState("");
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch("/data/latest.json").then(r => r.json()).then(setData).catch(e => setErr(String(e)));
    const m = new Date().toISOString().slice(0, 7).replace("-", "_");
    fetch(`/data/report_${m}.json`).then(r => r.ok ? r.json() : null).then(setReport).catch(() => {});
  }, []);

  const k = useMemo(() => {
    if (!data) return { n: 0, inS: 0, oos: 0, deep: 0, perPlat: {} };
    let inS = 0, oos = 0, deep = 0; const perPlat = {};
    PLATFORMS.forEach(p => perPlat[p] = { in: 0, tot: 0 });
    data.products.forEach(pr => PLATFORMS.forEach(pl => {
      const v = pr.platforms[pl] || {};
      if (v.status === "in_stock") { inS++; perPlat[pl].in++; perPlat[pl].tot++; }
      else if (v.status === "out_of_stock") { oos++; perPlat[pl].tot++; }
      if (v.discount_pct != null && v.discount_pct >= D_RED) deep++;
    }));
    return { n: data.products.length, inS, oos, deep, perPlat };
  }, [data]);

  if (err) return <Wrap ts="">
    <p style={{ color: "#9b9689" }}>Couldn't load data — the scraper needs one successful run first. ({err})</p></Wrap>;
  if (!data) return <Wrap ts=""><p className="pulse" style={{ color: "#9b9689" }}>Loading…</p></Wrap>;

  const prods = data.products.filter(p => !q ||
    p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()));

  return (
    <Wrap ts={new Date(data.checked_at).toLocaleString()}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 22 }}>
        <Kpi label="Products tracked" big={k.n} sub="across 6 platforms" />
        <Kpi label="In stock" big={k.inS} sub="live" tone="#43c98b" />
        <Kpi label="Out of stock" big={k.oos} sub="across all platforms" tone="#f06c66" />
        <Kpi label="Deep discounts" big={k.deep} sub={`\u2265${D_RED}% off`} tone="#e0a23a" />
      </div>

      <div style={{ fontSize: 12, color: "#8b8678", marginBottom: 9, fontWeight: 600, letterSpacing: ".06em" }}>PLATFORM BREAKDOWN</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 26 }}>
        {PLATFORMS.map(pl => {
          const s = k.perPlat[pl] || { in: 0, tot: 0 };
          const pct = s.tot ? Math.round(s.in / s.tot * 100) : 0;
          return (
            <div key={pl} style={{ background: "#1f1e25", border: "1px solid #2e2c36", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 12, color: "#8b8678" }}>{PLF[pl]}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 3 }}>
                <span style={{ fontSize: 19, fontWeight: 680, color: "#ece9e2" }}>{s.in}</span>
                <span style={{ fontSize: 12, color: "#6f6b60" }}>/ {s.tot || k.n}</span>
              </div>
              <div style={{ height: 3, background: "#2e2c36", borderRadius: 2, marginTop: 7, overflow: "hidden" }}>
                <div style={{ height: "100%", width: pct + "%", background: pct >= 80 ? "#43c98b" : pct >= 60 ? "#e0a23a" : "#f06c66" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["oos", "Out of Stock"], ["price", "Price"], ["summary", "Summary"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            fontFamily: "inherit", fontSize: 13.5, fontWeight: 560, padding: "9px 18px",
            borderRadius: 9, cursor: "pointer", border: "1px solid " + (tab === id ? "transparent" : "#2e2c36"),
            background: tab === id ? "#1f6f52" : "#1f1e25", color: tab === id ? "#fff" : "#9b9689",
          }}>{lbl}</button>
        ))}
      </div>

      {tab !== "summary" && (
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by SKU or product name\u2026"
          style={{ fontFamily: "inherit", fontSize: 14, padding: "11px 15px", borderRadius: 10,
            border: "1px solid #2e2c36", background: "#1f1e25", color: "#ece9e2",
            width: "100%", marginBottom: 16, outline: "none" }} />
      )}

      {tab === "oos" && <OOSTable prods={prods} />}
      {tab === "price" && <PriceTable prods={prods} />}
      {tab === "summary" && <Summary report={report} />}
    </Wrap>
  );
}

function Wrap({ children, ts }) {
  return (
    <div style={{ minHeight: "100vh", background: "#161519", fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif" }}>
      <style>{`*{box-sizing:border-box}body{margin:0}
        .pulse{animation:pl 1.4s ease-in-out infinite}@keyframes pl{0%,100%{opacity:.4}50%{opacity:1}}
        table{width:100%;border-collapse:collapse}
        th{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#7d7a6e;font-weight:650;padding:11px 12px;text-align:left;background:#1c1b22}
        td{padding:12px 12px;border-top:1px solid #262530;font-size:13px;color:#d8d5cc}
        th.c,td.c{text-align:center}`}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "34px 24px 60px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#f1efe8", margin: "0 0 4px", letterSpacing: "-.02em" }}>Brillare OOS Tracker</h1>
        <div style={{ fontSize: 12.5, color: "#7d7a6e", fontFamily: "ui-monospace,Menlo,monospace", marginBottom: 26 }}>
          {ts ? "Last checked: " + ts : ""}</div>
        {children}
      </div>
    </div>
  );
}

function Kpi({ label, big, sub, tone }) {
  return (
    <div style={{ background: "#1f1e25", border: "1px solid #2e2c36", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: "#8b8678" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, margin: "5px 0 2px", color: tone || "#f1efe8" }}>{big}</div>
      <div style={{ fontSize: 11, color: "#6f6b60" }}>{sub}</div>
    </div>
  );
}

function dot(s) {
  const c = s === "in_stock" ? "#43c98b" : s === "out_of_stock" ? "#f06c66"
    : s === "no_link" ? null : "#807c70";
  return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%",
    background: c || "transparent", border: c ? "none" : "1.5px solid #3a3845" }} />;
}

function Card({ children }) {
  return <div style={{ background: "#1b1a21", border: "1px solid #2a2933", borderRadius: 14, overflow: "hidden" }}>{children}</div>;
}

function OOSTable({ prods }) {
  return <Card><table>
    <thead><tr><th>Product</th>{PLATFORMS.map(p => <th key={p} className="c">{PL[p]}</th>)}<th className="c">Alert</th></tr></thead>
    <tbody>
      {prods.map(p => {
        const oosN = PLATFORMS.filter(pl => (p.platforms[pl] || {}).status === "out_of_stock").length;
        return (
          <tr key={p.sku}>
            <td><div style={{ fontWeight: 600, color: "#ece9e2" }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "#6f6b60", fontFamily: "ui-monospace,Menlo,monospace" }}>{p.sku}</div></td>
            {PLATFORMS.map(pl => <td key={pl} className="c">{dot((p.platforms[pl] || {}).status)}</td>)}
            <td className="c">
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 9,
                background: oosN >= 3 ? "#3a1f1e" : oosN ? "#3a2f17" : "#1d3327",
                color: oosN >= 3 ? "#f0908a" : oosN ? "#e0b15a" : "#5fc795" }}>
                {oosN ? oosN + " OOS" : "OK"}</span></td>
          </tr>
        );
      })}
    </tbody>
  </table></Card>;
}

function PriceTable({ prods }) {
  return <Card><table>
    <thead><tr><th>Product</th>{PLATFORMS.map(p => <th key={p} className="c">{PL[p]}</th>)}</tr></thead>
    <tbody>
      {prods.map(p => (
        <tr key={p.sku}>
          <td><div style={{ fontWeight: 600, color: "#ece9e2" }}>{p.name}</div>
            <div style={{ fontSize: 11, color: "#6f6b60", fontFamily: "ui-monospace,Menlo,monospace" }}>{p.sku}</div></td>
          {PLATFORMS.map(pl => {
            const v = p.platforms[pl] || {}; const d = v.discount_pct;
            const bg = d == null ? "transparent" : d >= D_RED ? "#3a1f1e" : d >= D_AMBER ? "#3a2f17" : "transparent";
            return (
              <td key={pl} className="c" style={{ background: bg }}>
                {v.selling != null ? (<>
                  <div style={{ fontFamily: "ui-monospace,Menlo,monospace", color: "#ece9e2", fontWeight: 600 }}>{"\u20b9"}{v.selling}</div>
                  {d != null && d > 0 && <div style={{ fontSize: 11, color: d >= D_RED ? "#f0908a" : d >= D_AMBER ? "#e0b15a" : "#7d7a6e" }}>{"\u2212"}{d}%</div>}
                  {v.mrp != null && v.mrp !== v.selling && <div style={{ fontSize: 10, color: "#6f6b60", textDecoration: "line-through" }}>{"\u20b9"}{v.mrp}</div>}
                </>) : <span style={{ fontSize: 11, color: "#6f6b60" }}>{"\u2014"}</span>}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  </table></Card>;
}

function Summary({ report }) {
  if (!report) return <p style={{ color: "#9b9689", fontSize: 14 }}>
    No monthly summary yet — it builds automatically once the scraper has run on a few days. Day one shows "1 day tracked".</p>;
  const rows = [...report.rows].filter(r => r.days_oos > 0 || r.max_discount).sort((a, b) => b.days_oos - a.days_oos);
  return (<>
    <div style={{ fontSize: 12.5, color: "#7d7a6e", fontFamily: "ui-monospace,Menlo,monospace", marginBottom: 12 }}>
      {report.month} {"\u00b7"} generated {new Date(report.generated).toLocaleString()}</div>
    <Card><table>
      <thead><tr><th>SKU</th><th>Platform</th><th className="c">Days tracked</th>
        <th className="c">Days OOS</th><th className="c">Longest streak</th>
        <th className="c">Max disc</th><th className="c">Avg disc</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, color: "#9b9689" }}>{r.sku}</td>
            <td>{r.platform}</td>
            <td className="c">{r.days_tracked}</td>
            <td className="c"><span style={{ fontWeight: r.days_oos > 0 ? 700 : 400,
              color: r.days_oos >= 5 ? "#f0908a" : r.days_oos > 0 ? "#e0b15a" : "#d8d5cc",
              background: r.days_oos >= 5 ? "#3a1f1e" : "transparent",
              padding: r.days_oos >= 5 ? "2px 8px" : 0, borderRadius: 8 }}>{r.days_oos}</span></td>
            <td className="c">{r.longest_oos_streak}</td>
            <td className="c" style={{ color: r.max_discount >= D_RED ? "#f0908a" : "#d8d5cc" }}>
              {r.max_discount != null ? r.max_discount + "%" : "\u2014"}</td>
            <td className="c">{r.avg_discount != null ? r.avg_discount + "%" : "\u2014"}</td>
          </tr>
        ))}
      </tbody>
    </table></Card>
  </>);
}