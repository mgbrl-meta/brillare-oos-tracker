"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Globe, Package, ShoppingBag, Sparkles, Store } from "lucide-react";

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

const platformLabels: Record<string, string> = {
  shopify: "Own site",
  amazon: "Amazon",
  flipkart: "Flipkart",
  nykaa: "Nykaa",
  myntra: "Myntra",
  smytten: "Smytten"
};

const preferredPlatforms = ["shopify", "amazon", "flipkart", "nykaa", "myntra"];

function statusColor(status?: string) {
  if (status === "in_stock") return "green";
  if (status === "out_of_stock") return "red";
  return "gray";
}

function isOOS(status?: string) {
  return status === "out_of_stock";
}

function isInStock(status?: string) {
  return status === "in_stock";
}

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

function downloadCSV(products: Product[]) {
  const platforms = preferredPlatforms;
  const rows = [
    ["SKU", "Product", "Category", ...platforms.map((p) => platformLabels[p] || p), "OOS Count", "Best Discount"]
  ];

  products.forEach((p) => {
    const oosCount = platforms.filter((pl) => isOOS(p.platforms?.[pl]?.status)).length;
    const bestDiscount = Math.max(
      0,
      ...platforms.map((pl) => Number(p.platforms?.[pl]?.discount_pct || 0))
    );

    rows.push([
      p.sku,
      p.name,
      p.type || "",
      ...platforms.map((pl) => p.platforms?.[pl]?.status || "no_link"),
      String(oosCount),
      bestDiscount ? `${bestDiscount}%` : ""
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
  const [data, setData] = useState<LatestData>({ products: [] });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    fetch("/data/latest.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch(() => setData({ products: [] }));
  }, []);

  const products = data.products || [];

  const platforms = useMemo(() => {
    const found = new Set<string>();
    products.forEach((p) => Object.keys(p.platforms || {}).forEach((pl) => found.add(pl)));
    const ordered = preferredPlatforms.filter((p) => found.has(p));
    const extra = Array.from(found).filter((p) => !ordered.includes(p));
    return [...ordered, ...extra].slice(0, 5);
  }, [products]);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const platformCells = products.flatMap((p) =>
      platforms.map((pl) => ({
        platform: pl,
        product: p,
        rec: p.platforms?.[pl]
      }))
    );

    const inStock = platformCells.filter((x) => isInStock(x.rec?.status)).length;
    const oos = platformCells.filter((x) => isOOS(x.rec?.status)).length;
    const failures = platformCells.filter((x) => {
      const s = x.rec?.status;
      return !s || s === "unknown" || s?.startsWith("error");
    }).length;

    const availability = platformCells.length ? Math.round((inStock / platformCells.length) * 1000) / 10 : 0;

    const platformBreakdown = platforms.map((pl) => {
      const cells = products.map((p) => p.platforms?.[pl]);
      const ok = cells.filter((r) => isInStock(r?.status)).length;
      return {
        key: pl,
        label: platformLabels[pl] || pl,
        ok,
        total: cells.length || totalProducts,
        pct: cells.length ? Math.round((ok / cells.length) * 100) : 0
      };
    });

    const critical = products
      .map((p) => ({
        ...p,
        oosCount: platforms.filter((pl) => isOOS(p.platforms?.[pl]?.status)).length
      }))
      .filter((p) => p.oosCount >= 2)
      .sort((a, b) => b.oosCount - a.oosCount);

    const deepDiscounts = products
      .flatMap((p) =>
        platforms.map((pl) => ({
          sku: p.sku,
          name: p.name,
          platform: pl,
          discount: Number(p.platforms?.[pl]?.discount_pct || 0)
        }))
      )
      .filter((x) => x.discount >= 30)
      .sort((a, b) => b.discount - a.discount);

    return {
      totalProducts,
      totalCells: platformCells.length,
      inStock,
      oos,
      failures,
      availability,
      platformBreakdown,
      critical,
      deepDiscounts
    };
  }, [products, platforms]);

  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.type).filter(Boolean))).sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || p.sku?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q);
      const matchesCategory = category === "all" || p.type === category;

      const oosCount = platforms.filter((pl) => isOOS(p.platforms?.[pl]?.status)).length;
      const inStockCount = platforms.filter((pl) => isInStock(p.platforms?.[pl]?.status)).length;
      const matchesStatus =
        status === "all" ||
        (status === "oos" && oosCount > 0) ||
        (status === "critical" && oosCount >= 2) ||
        (status === "healthy" && oosCount === 0 && inStockCount > 0);

      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [products, query, category, status, platforms]);

  return (
    <main className="page">
      <section className="header">
        <div>
          <div className="eyebrow">Brillare multi-platform inventory intelligence</div>
          <h1>OOS Tracker Dashboard</h1>
          <p className="subtitle">
            Live availability, platform health, scrape failures, and discount risk across your marketplace and owned-channel listings.
          </p>
        </div>
        <div className="updated">
          Last scraped
          <strong>{formatDate(data.checked_at)}</strong>
        </div>
      </section>

      <section className="kpiGrid">
        <div className="card">
          <div className="kpiLabel">Products tracked</div>
          <div className="kpiValue">{stats.totalProducts}</div>
          <div className="kpiSub">across {platforms.length} platforms</div>
        </div>
        <div className="card">
          <div className="kpiLabel">In stock</div>
          <div className="kpiValue green">{stats.inStock} / {stats.totalCells}</div>
          <div className="kpiSub">{stats.availability}% availability</div>
        </div>
        <div className="card">
          <div className="kpiLabel">Out of stock</div>
          <div className="kpiValue red">{stats.oos}</div>
          <div className="kpiSub">{stats.critical.length} critical products</div>
        </div>
        <div className="card">
          <div className="kpiLabel">Scrape failures</div>
          <div className="kpiValue amber">{stats.failures}</div>
          <div className="kpiSub">unknown, failed, or blocked pages</div>
        </div>
      </section>

      <section>
        <div className="sectionTitle">
          <h2>Platform breakdown</h2>
          <a href="#insights">View insights <ExternalLink size={13} /></a>
        </div>
        <div className="platformGrid">
          {stats.platformBreakdown.map((p, i) => {
            const Icon = i === 0 ? Globe : i === 1 ? Store : i === 2 ? ShoppingBag : i === 3 ? Sparkles : Package;
            return (
              <div className="platformCard" key={p.key}>
                <div className="platformName"><Icon size={14} /> {p.label}</div>
                <div className="platformNum">{p.ok} <span>/ {p.total}</span></div>
                <div className="bar"><div className="barFill" style={{ width: `${p.pct}%` }} /></div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="sectionTitle">
          <h2>Product status</h2>
        </div>

        <div className="controls">
          <input
            className="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by SKU or product name..."
          />

          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="oos">Has OOS</option>
            <option value="critical">Critical: 2+ OOS</option>
            <option value="healthy">Healthy</option>
          </select>
        </div>

        <div className="actions">
          <button className="exportBtn" onClick={() => downloadCSV(filtered)}>
            <Download size={14} /> Export
          </button>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                {platforms.map((pl) => <th key={pl}>{platformLabels[pl] || pl}</th>)}
                <th>Alert</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const oosCount = platforms.filter((pl) => isOOS(p.platforms?.[pl]?.status)).length;
                return (
                  <tr key={p.sku}>
                    <td>
                      <div className="productName">{p.name || "Unnamed product"}</div>
                      <div className="sku">{p.sku}</div>
                    </td>
                    <td>{p.type || "—"}</td>
                    {platforms.map((pl) => {
                      const rec = p.platforms?.[pl];
                      return (
                        <td key={pl} title={`${pl}: ${rec?.status || "unknown"}`}>
                          <span className={`dot ${statusColor(rec?.status)}`} />
                        </td>
                      );
                    })}
                    <td>
                      {oosCount > 0 ? (
                        <span className="badge">{oosCount} OOS</span>
                      ) : (
                        <span className="badge ok">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!filtered.length && <div className="empty">No products match your filters.</div>}
        </div>

        <div className="legend">
          <span><span className="dot green" /> In stock</span>
          <span><span className="dot red" /> Out of stock</span>
          <span><span className="dot gray" /> Scrape failed / unknown</span>
        </div>
      </section>

      <section id="insights" className="insightGrid">
        <div className="card">
          <div className="sectionTitle">
            <h2>Critical OOS products</h2>
          </div>
          {stats.critical.length ? (
            <ol className="insightList">
              {stats.critical.slice(0, 8).map((p) => (
                <li key={p.sku}>
                  <strong>{p.name}</strong> — {p.oosCount} platforms out of stock
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty">No critical OOS products right now.</p>
          )}
        </div>

        <div className="card">
          <div className="sectionTitle">
            <h2>Deep discount alerts</h2>
          </div>
          {stats.deepDiscounts.length ? (
            <ol className="insightList">
              {stats.deepDiscounts.slice(0, 8).map((x) => (
                <li key={`${x.sku}-${x.platform}`}>
                  <strong>{x.name}</strong> — {platformLabels[x.platform] || x.platform} at {x.discount}%
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty">No discount alerts above 30%.</p>
          )}
        </div>
      </section>

      <div className="footer">
        Data source: <code>/data/latest.json</code>. Dashboard updates automatically when GitHub Actions commits new scraper output.
      </div>
    </main>
  );
}
