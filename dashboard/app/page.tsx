"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Download,
  Moon,
  Search,
  Sun,
  TriangleAlert,
  XCircle
} from "lucide-react";

type PlatformRecord = {
  status?: string;
  mrp?: number | null;
  selling?: number | null;
  discount_pct?: number | null;
};

type Product = {
  sku: string;
  name: string;
  type?: string;
  platforms: Record<string, PlatformRecord>;
};

type LatestData = {
  checked_at?: string;
  products: Product[];
};

type HistoryRow = {
  day?: string;
  ts?: string;
  sku?: string;
  platform?: string;
  status?: string;
  discount_pct?: number | null;
};

const DISCOUNT_ALERT = 10;

const platformLabels: Record<string, string> = {
  shopify: "Own",
  amazon: "Amazon",
  flipkart: "Flipkart",
  nykaa: "Nykaa",
  myntra: "Myntra",
  smytten: "Smytten"
};

const preferredPlatforms = ["shopify", "amazon", "flipkart", "nykaa", "myntra", "smytten"];

function formatDate(value?: string) {
  if (!value) return "Not available";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function isInStock(status?: string) {
  return status === "in_stock";
}

function isOOS(status?: string) {
  return status === "out_of_stock";
}

function statusLabel(status?: string) {
  if (status === "in_stock") return "In stock";
  if (status === "out_of_stock") return "OOS";
  if (status === "no_link") return "No link";
  if (!status) return "Unknown";
  if (status.startsWith("error")) return "Error";
  return status;
}

function dotClass(status?: string) {
  if (status === "in_stock") return "good";
  if (status === "out_of_stock") return "bad";
  return "muted";
}

function productOosCount(product: Product, platforms: string[]) {
  return platforms.filter((pl) => isOOS(product.platforms?.[pl]?.status)).length;
}

function productInStockCount(product: Product, platforms: string[]) {
  return platforms.filter((pl) => isInStock(product.platforms?.[pl]?.status)).length;
}

function productMaxDiscount(product: Product, platforms: string[]) {
  return Math.max(0, ...platforms.map((pl) => Number(product.platforms?.[pl]?.discount_pct || 0)));
}

function productWorstDiscountPlatform(product: Product, platforms: string[]) {
  let result = { platform: "", discount: 0 };
  platforms.forEach((pl) => {
    const d = Number(product.platforms?.[pl]?.discount_pct || 0);
    if (d > result.discount) result = { platform: pl, discount: d };
  });
  return result;
}

function parseHistoryText(text: string): HistoryRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function downloadCSV(products: Product[], platforms: string[]) {
  const rows = [
    [
      "SKU",
      "Product",
      "Category",
      ...platforms.map((p) => `${platformLabels[p] || p} Status`),
      "In Stock Count",
      "OOS Count",
      "Highest Discount"
    ]
  ];

  products.forEach((p) => {
    rows.push([
      p.sku,
      p.name,
      p.type || "",
      ...platforms.map((pl) => statusLabel(p.platforms?.[pl]?.status)),
      String(productInStockCount(p, platforms)),
      String(productOosCount(p, platforms)),
      productMaxDiscount(p, platforms) ? `${productMaxDiscount(p, platforms)}%` : ""
    ]);
  });

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "brillare-oos-dashboard.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [tab, setTab] = useState<"oos" | "price" | "history">("oos");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [data, setData] = useState<LatestData>({ products: [] });
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [risk, setRisk] = useState("all");

  useEffect(() => {
    const saved = localStorage.getItem("brillare-theme");
    const initial = saved === "light" || saved === "dark"
      ? saved
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    setTheme(initial);
    document.documentElement.dataset.theme = initial;

    fetch("/data/latest.json", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ products: [] }));

    fetch("/data/history.jsonl", { cache: "no-store" })
      .then((r) => r.text())
      .then((txt) => setHistory(parseHistoryText(txt)))
      .catch(() => setHistory([]));
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("brillare-theme", next);
    document.documentElement.dataset.theme = next;
  }

  const products = data.products || [];

  const platforms = useMemo(() => {
    const found = new Set<string>();
    products.forEach((p) => Object.keys(p.platforms || {}).forEach((pl) => found.add(pl)));
    const ordered = preferredPlatforms.filter((p) => found.has(p));
    const extra = Array.from(found).filter((p) => !ordered.includes(p));
    return [...ordered, ...extra].slice(0, 6);
  }, [products]);

  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.type).filter(Boolean))).sort();
  }, [products]);

  const stats = useMemo(() => {
    const cells = products.flatMap((p) => platforms.map((pl) => p.platforms?.[pl]));
    const inStock = cells.filter((r) => isInStock(r?.status)).length;
    const oos = cells.filter((r) => isOOS(r?.status)).length;
    const unknown = cells.filter((r) => !r?.status || r.status === "no_link" || r.status === "unknown" || r.status.startsWith("error")).length;
    const availability = cells.length ? Math.round((inStock / cells.length) * 1000) / 10 : 0;

    const criticalProducts = products
      .map((p) => ({
        ...p,
        oosCount: productOosCount(p, platforms),
        inStockCount: productInStockCount(p, platforms),
        maxDiscount: productMaxDiscount(p, platforms),
        discountInfo: productWorstDiscountPlatform(p, platforms)
      }))
      .sort((a, b) => {
        if (b.oosCount !== a.oosCount) return b.oosCount - a.oosCount;
        return b.maxDiscount - a.maxDiscount;
      });

    const oosProducts = criticalProducts.filter((p) => p.oosCount > 0);
    const discountProducts = criticalProducts.filter((p) => p.maxDiscount > DISCOUNT_ALERT);

    const platformBreakdown = platforms.map((pl) => {
      const records = products.map((p) => p.platforms?.[pl]);
      const ok = records.filter((r) => isInStock(r?.status)).length;
      const bad = records.filter((r) => isOOS(r?.status)).length;
      const total = records.length;
      return {
        key: pl,
        label: platformLabels[pl] || pl,
        ok,
        bad,
        total,
        pct: total ? Math.round((ok / total) * 100) : 0
      };
    });

    return {
      totalProducts: products.length,
      totalCells: cells.length,
      inStock,
      oos,
      unknown,
      availability,
      criticalProducts,
      oosProducts,
      discountProducts,
      platformBreakdown
    };
  }, [products, platforms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products.filter((p) => {
      const oosCount = productOosCount(p, platforms);
      const inStockCount = productInStockCount(p, platforms);
      const maxDiscount = productMaxDiscount(p, platforms);

      const matchesQuery =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q);

      const matchesCategory = category === "all" || p.type === category;

      const matchesRisk =
        risk === "all" ||
        (risk === "oos" && oosCount > 0) ||
        (risk === "critical" && oosCount >= 2) ||
        (risk === "discount" && maxDiscount > DISCOUNT_ALERT) ||
        (risk === "healthy" && oosCount === 0 && inStockCount > 0);

      return matchesQuery && matchesCategory && matchesRisk;
    });
  }, [products, query, category, risk, platforms]);

  const historyDays = useMemo(() => {
    const byDay = new Map<string, HistoryRow[]>();

    history.forEach((row) => {
      const day = row.day || row.ts?.slice(0, 10) || "Unknown";
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)?.push(row);
    });

    return Array.from(byDay.entries())
      .map(([day, rows]) => {
        const inStock = rows.filter((r) => isInStock(r.status)).length;
        const oos = rows.filter((r) => isOOS(r.status)).length;
        const maxDiscount = Math.max(0, ...rows.map((r) => Number(r.discount_pct || 0)));
        return { day, total: rows.length, inStock, oos, maxDiscount };
      })
      .sort((a, b) => b.day.localeCompare(a.day));
  }, [history]);

  const filteredOos = filtered.filter((p) => productOosCount(p, platforms) > 0).length;
  const filteredDiscount = filtered.filter((p) => productMaxDiscount(p, platforms) > DISCOUNT_ALERT).length;

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <div className="eyebrow">Brillare Inventory Intelligence</div>
          <h1>OOS Tracker</h1>
          <p className="subtitle">
            Minimal executive view for stock availability, OOS exposure, channel health, and discount leakage.
          </p>
        </div>

        <div className="topActions">
          <button className="themeButton" onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <div className="updatedBox">
            <span>Last scrape</span>
            <strong>{formatDate(data.checked_at)}</strong>
          </div>
        </div>
      </header>

      <nav className="tabs tabs3">
        <button className={tab === "oos" ? "active" : ""} onClick={() => setTab("oos")}>
          Dashboard
        </button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
          History
        </button>
      </nav>

      {tab === "oos" && (
        <>
          <section className="ceoGrid">
            <div className="scoreCard">
              <span>Marketplace availability</span>
              <strong>{stats.availability}%</strong>
              <p>{stats.inStock} live listings from {stats.totalCells} checks</p>
            </div>

            <div className="miniCard">
              <CheckCircle2 size={18} />
              <span>Products</span>
              <strong>{stats.totalProducts}</strong>
            </div>

            <div className="miniCard danger">
              <XCircle size={18} />
              <span>OOS</span>
              <strong>{stats.oos}</strong>
            </div>

            <div className="miniCard danger">
              <TriangleAlert size={18} />
              <span>Discount alerts</span>
              <strong>{stats.discountProducts.length}</strong>
            </div>
          </section>

          <section className="platformStrip">
            {stats.platformBreakdown.map((p) => (
              <div className="platformPill" key={p.key}>
                <span>{p.label}</span>
                <strong>{p.pct}%</strong>
                <small>{p.bad} OOS</small>
              </div>
            ))}
          </section>

          <section className="decisionGrid">
            <div className="decisionPanel">
              <div className="panelHead">
                <div>
                  <h2>Priority OOS</h2>
                  <p>Fix these first.</p>
                </div>
                <span className="countBadge danger">{stats.oosProducts.length}</span>
              </div>

              <div className="compactList">
                {stats.oosProducts.slice(0, 6).map((p) => (
                  <div key={p.sku}>
                    <strong>{p.name}</strong>
                    <span>{p.sku}</span>
                    <b>{p.oosCount} OOS</b>
                  </div>
                ))}
                {!stats.oosProducts.length && <p className="empty">No OOS products.</p>}
              </div>
            </div>

            <div className="decisionPanel">
              <div className="panelHead">
                <div>
                  <h2>Discount leakage</h2>
                  <p>Above {DISCOUNT_ALERT}% threshold.</p>
                </div>
                <span className="countBadge danger">{stats.discountProducts.length}</span>
              </div>

              <div className="compactList">
                {stats.discountProducts.slice(0, 6).map((p) => (
                  <div key={p.sku}>
                    <strong>{p.name}</strong>
                    <span>{platformLabels[p.discountInfo.platform] || p.discountInfo.platform}</span>
                    <b>{p.discountInfo.discount}%</b>
                  </div>
                ))}
                {!stats.discountProducts.length && <p className="empty">No discount leakage.</p>}
              </div>
            </div>
          </section>

          <section className="tableSection">
            <div className="sectionHead">
              <div>
                <h2>Product command table</h2>
                <p>Compact SKU-level operating view. No prices, only decisions.</p>
              </div>
              <button className="exportButton" onClick={() => downloadCSV(filtered, platforms)}>
                <Download size={15} /> Export
              </button>
            </div>

            <div className="filters">
              <label className="searchBox">
                <Search size={15} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search SKU or product" />
              </label>

              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              <select value={risk} onChange={(e) => setRisk(e.target.value)}>
                <option value="all">All risks</option>
                <option value="oos">Has OOS</option>
                <option value="critical">2+ OOS</option>
                <option value="discount">Discount &gt; {DISCOUNT_ALERT}%</option>
                <option value="healthy">Healthy</option>
              </select>
            </div>

            <div className="tableSummary">
              <div><span>Showing</span><strong>{filtered.length}</strong></div>
              <div><span>OOS products</span><strong className={filteredOos ? "dangerText" : ""}>{filteredOos}</strong></div>
              <div><span>Discount risks</span><strong className={filteredDiscount ? "dangerText" : ""}>{filteredDiscount}</strong></div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Health</th>
                    {platforms.map((pl) => <th key={pl}>{platformLabels[pl] || pl}</th>)}
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const oos = productOosCount(p, platforms);
                    const stock = productInStockCount(p, platforms);
                    const discount = productMaxDiscount(p, platforms);

                    return (
                      <tr key={p.sku}>
                        <td className="productCell">
                          <strong>{p.name || "Unnamed product"}</strong>
                          <span>{p.sku}</span>
                        </td>
                        <td className="categoryCell">{p.type || "—"}</td>
                        <td>
                          <span className={oos ? "health danger" : "health good"}>
                            {stock}/{platforms.length}
                          </span>
                        </td>
                        {platforms.map((pl) => {
                          const rec = p.platforms?.[pl];
                          const d = Number(rec?.discount_pct || 0);
                          return (
                            <td key={pl} className={d > DISCOUNT_ALERT ? "discountCell" : ""}>
                              <span title={`${platformLabels[pl] || pl}: ${statusLabel(rec?.status)}`} className={`dot ${dotClass(rec?.status)}`} />
                              {d > DISCOUNT_ALERT ? <em>{d}%</em> : null}
                            </td>
                          );
                        })}
                        <td>
                          <div className="riskStack">
                            {oos ? <span className="chip danger">{oos} OOS</span> : <span className="chip good">OK</span>}
                            {discount > DISCOUNT_ALERT ? <span className="chip danger">{discount}%</span> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!filtered.length && <div className="empty">No matching products found.</div>}
            </div>

            <div className="legend">
              <span><i className="dot good" /> In stock</span>
              <span><i className="dot bad" /> OOS</span>
              <span><i className="dot muted" /> No link / unknown</span>
              <span><b className="chip danger">10%+</b> Discount alert</span>
            </div>
          </section>
        </>
      )}

      {tab === "history" && (
        <section className="tableSection">
          <div className="sectionHead">
            <div>
              <h2>History</h2>
              <p>Daily scraper summary.</p>
            </div>
            <span className="chip">{history.length} rows</span>
          </div>

          <div className="historyGrid">
            {historyDays.slice(0, 40).map((day) => (
              <div className="historyRow" key={day.day}>
                <strong>{day.day}</strong>
                <span>{day.total} checks</span>
                <span className="successText">{day.inStock} in stock</span>
                <span className={day.oos ? "dangerText" : ""}>{day.oos} OOS</span>
                {day.maxDiscount > DISCOUNT_ALERT ? <span className="dangerText">{day.maxDiscount}% max discount</span> : <span>—</span>}
              </div>
            ))}
            {!historyDays.length && <div className="empty">No history found yet.</div>}
          </div>
        </section>
      )}
    </main>
  );
}
