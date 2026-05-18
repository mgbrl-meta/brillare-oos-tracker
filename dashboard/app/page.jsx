"use client";
import { useEffect, useState } from "react";

// ---- discount thresholds (keep in sync with scraper) ----
const D_AMBER = 30;
const D_RED = 50;

const PLATFORMS = ["shopify", "amazon", "flipkart", "nykaa", "myntra", "smytten"];
const PLAT_LABEL = {
  shopify: "Own Site", amazon: "Amazon", flipkart: "Flipkart",
  nykaa: "Nykaa", myntra: "Myntra", smytten: "Smytten",
};

function statusDot(s) {
  const base = { display: "inline-block", width: 11, height: 11, borderRadius: "50%" };
  if (s === "in_stock") return <span style={{ ...base, background: "#1f9d61" }} title="In stock" />;
  if (s === "out_of_stock") return <span style={{ ...base, background: "#d6453f" }} title="Out of stock" />;
  if (s === "no_link") return <span style={{ ...base, background: "#d9d4c7", border: "1px solid #b8b2a0" }} title="Not sold here" />;
  return <span style={{ ...base, background: "#b0aa9a" }} title={s} />;
}

function discountStyle(pct) {
  if (pct == null) return {};
  if (pct >= D_RED) return { background: "#fbe4e3", color: "#8a1f1b", fontWeight: 600 };
  if (pct >= D_AMBER) return { background: "#fbf0d9", color: "#7a4a08", fontWeight: 600 };
  return { color: "#3a3a36" };
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [tab, setTab] = useState("live");
  const [q, setQ] = useState("");
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch("/data/latest.json").then(r => r.json()).then(setData)
      .catch(e => setErr(String(e)));
    const m = new Date().toISOString().slice(0, 7).replace("-", "_");
    fetch(`/data/report_${m}.json`).then(r => r.ok ? r.json() : null)
      .then(setReport).catch(() => {});
  }, []);

  if (err) return <div className="wrap"><p>Could not load data. Run the scraper first. ({err})</p></div>;
  if (!data) return <div className="wrap"><p>Loading…</p></div>;

  const prods = data.products.filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.sku.toLowerCase().includes(q.toLowerCase()));

  let inS = 0, oos = 0, deep = 0;
  data.products.forEach(p => PLATFORMS.forEach(pl => {
    const v = p.platforms[pl] || {};
    if (v.status === "in_stock") inS++;
    else if (v.status === "out_of_stock") oos++;
    if (v.discount_pct != null && v.discount_pct >= D_RED) deep++;
  }));

  return (
    <div className="wrap">
      <style>{`
        :root{--bg:#f7f5ef;--card:#fffdf8;--ink:#23211c;--mut:#7c776b;--line:#e7e3d6;--accent:#1c4a3a}
        *{box-sizing:border-box}
        body{margin:0;background:var(--bg);color:var(--ink);
          font-family:'Georgia','Times New Roman',serif}
        .wrap{max-width:1180px;margin:0 auto;padding:32px 22px}
        h1{font-size:30px;letter-spacing:-.5px;margin:0 0 2px;font-weight:600}
        .sub{color:var(--mut);font-size:13px;margin-bottom:22px;
          font-family:ui-monospace,Menlo,monospace}
        .kpis{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
        .kpi{background:var(--card);border:1px solid var(--line);
          border-radius:10px;padding:14px 20px;min-width:130px}
        .kpi b{font-size:24px;display:block;margin-top:3px}
        .kpi span{font-size:11px;color:var(--mut);text-transform:uppercase;
          letter-spacing:.08em}
        .tabs{display:flex;gap:6px;margin-bottom:14px}
        .tabs button{font-family:inherit;font-size:13px;padding:8px 16px;
          border:1px solid var(--line);background:var(--card);
          border-radius:8px;cursor:pointer;color:var(--mut)}
        .tabs button.on{background:var(--accent);color:#fff;
          border-color:var(--accent)}
        input{font-family:inherit;padding:9px 12px;border:1px solid var(--line);
          border-radius:8px;width:300px;margin-bottom:14px;background:var(--card)}
        table{width:100%;border-collapse:collapse;background:var(--card);
          border:1px solid var(--line);border-radius:10px;overflow:hidden;
          font-size:13px}
        th{text-align:left;padding:11px 12px;background:#efece1;
          font-size:11px;letter-spacing:.07em;text-transform:uppercase;
          color:var(--mut);font-weight:600}
        td{padding:11px 12px;border-top:1px solid var(--line);
          vertical-align:top}
        th.c,td.c{text-align:center}
        .sku{font-family:ui-monospace,Menlo,monospace;font-size:11px;
          color:var(--mut)}
        .price{font-family:ui-monospace,Menlo,monospace;font-size:12px}
        .mrp{text-decoration:line-through;color:var(--mut);font-size:11px}
        .legend{display:flex;gap:18px;flex-wrap:wrap;margin-top:14px;
          font-size:12px;color:var(--mut)}
        .legend i{display:inline-block;width:10px;height:10px;
          border-radius:50%;margin-right:5px;vertical-align:middle}
      `}</style>

      <h1>Brillare OOS Tracker</h1>
      <div className="sub">Last checked: {new Date(data.checked_at).toLocaleString()}</div>

      <div className="kpis">
        <div className="kpi"><span>Products</span><b>{data.products.length}</b></div>
        <div className="kpi"><span>In stock</span><b style={{ color: "#1f9d61" }}>{inS}</b></div>
        <div className="kpi"><span>Out of stock</span><b style={{ color: "#d6453f" }}>{oos}</b></div>
        <div className="kpi"><span>Deep discounts</span><b style={{ color: "#b3791a" }}>{deep}</b></div>
      </div>

      <div className="tabs">
        <button className={tab === "live" ? "on" : ""} onClick={() => setTab("live")}>Live Status</button>
        <button className={tab === "report" ? "on" : ""} onClick={() => setTab("report")}>Monthly Report</button>
      </div>

      {tab === "live" && (
        <>
          <input placeholder="Search SKU or product…" value={q}
            onChange={e => setQ(e.target.value)} />
          <table>
            <thead><tr>
              <th>Product</th>
              {PLATFORMS.map(p => <th key={p} className="c">{PLAT_LABEL[p]}</th>)}
            </tr></thead>
            <tbody>
              {prods.map(p => (
                <tr key={p.sku}>
                  <td>{p.name}<div className="sku">{p.sku}</div></td>
                  {PLATFORMS.map(pl => {
                    const v = p.platforms[pl] || {};
                    return (
                      <td key={pl} className="c">
                        <div>{statusDot(v.status)}</div>
                        {v.selling != null && (
                          <div className="price" style={discountStyle(v.discount_pct)}>
                            ₹{v.selling}
                            {v.discount_pct != null && v.discount_pct > 0 &&
                              <> · {v.discount_pct}%</>}
                          </div>
                        )}
                        {v.mrp != null && v.mrp !== v.selling &&
                          <div className="mrp">₹{v.mrp}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="legend">
            <span><i style={{ background: "#1f9d61" }} />In stock</span>
            <span><i style={{ background: "#d6453f" }} />Out of stock</span>
            <span><i style={{ background: "#b0aa9a" }} />Unknown</span>
            <span><i style={{ background: "#d9d4c7" }} />Not sold here</span>
            <span><i style={{ background: "#fbf0d9" }} />Discount ≥{D_AMBER}%</span>
            <span><i style={{ background: "#fbe4e3" }} />Discount ≥{D_RED}%</span>
          </div>
        </>
      )}

      {tab === "report" && (
        <ReportView report={report} />
      )}
    </div>
  );
}

function ReportView({ report }) {
  if (!report) return <p style={{ color: "#7c776b" }}>
    No report yet for this month. It generates after the scraper has run
    on a few days (run <code>report.py</code>).</p>;
  return (
    <>
      <div className="sub">Month: {report.month} · generated {new Date(report.generated).toLocaleString()}</div>
      <table>
        <thead><tr>
          <th>SKU</th><th>Platform</th><th className="c">Days tracked</th>
          <th className="c">Days OOS</th><th className="c">Longest OOS streak</th>
          <th className="c">Max disc.</th><th className="c">Avg disc.</th>
        </tr></thead>
        <tbody>
          {report.rows.filter(r => r.days_oos > 0 || r.max_discount)
            .sort((a, b) => b.days_oos - a.days_oos).map((r, i) => (
              <tr key={i}>
                <td className="sku">{r.sku}</td>
                <td>{r.platform}</td>
                <td className="c">{r.days_tracked}</td>
                <td className="c" style={{ color: r.days_oos > 0 ? "#d6453f" : "inherit", fontWeight: r.days_oos > 0 ? 600 : 400 }}>{r.days_oos}</td>
                <td className="c">{r.longest_oos_streak}</td>
                <td className="c">{r.max_discount != null ? r.max_discount + "%" : "—"}</td>
                <td className="c">{r.avg_discount != null ? r.avg_discount + "%" : "—"}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </>
  );
}
