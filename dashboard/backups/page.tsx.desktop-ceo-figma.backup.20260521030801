"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BarChart3,
  Download,
  Globe,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tags,
  TrendingDown,
  AlertTriangle
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
  mrp?: number | null;
  selling?: number | null;
  discount_pct?: number | null;
};

const DISCOUNT_ALERT = 10;

const platformLabels: Record<string, string> = {
  shopify: "Own site",
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

function money(value?: number | null) {
  if (!value) return "—";
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function isInStock(status?: string) {
  return status === "in_stock";
}

function isOOS(status?: string) {
  return status === "out_of_stock";
}

function statusColor(status?: string) {
  if (status === "in_stock") return "green";
  if (status === "out_of_stock") return "red";
  return "gray";
}

function statusLabel(status?: string) {
  if (status === "in_stock") return "In stock";
  if (status === "out_of_stock") return "OOS";
  if (status === "no_link") return "No link";
  if (!status) return "Unknown";
  if (status.startsWith("error")) return "Error";
  return status;
}

function productOosCount(product: Product, platforms: string[]) {
  return platforms.filter((pl) => isOOS(product.platforms?.[pl]?.status)).length;
}

function productInStockCount(product: Product, platforms: string[]) {
  return platforms.filter((pl) => isInStock(product.platforms?.[pl]?.status)).length;
}

function productMaxDiscount(product: Product, platforms: string[]) {
  const discounts = platforms.map((pl) => Number(product.platforms?.[pl]?.discount_pct || 0));
  return discounts.length ? Math.max(...discounts) : 0;
}

function bestPriceForProduct(product: Product, platforms: string[]) {
  const validPrices = platforms
    .map((pl) => ({
      platform: pl,
      selling: Number(product.platforms?.[pl]?.selling || 0),
      discount: Number(product.platforms?.[pl]?.discount_pct || 0)
    }))
    .filter((x) => x.selling > 0);

  const bestPrice = validPrices.length
    ? validPrices.reduce((a, b) => (b.selling < a.selling ? b : a))
    : null;

  const bestDiscount = validPrices.length
    ? validPrices.reduce((a, b) => (b.discount > a.discount ? b : a))
    : null;

  return { bestPrice, bestDiscount };
}

function downloadCSV(products: Product[], platforms: string[]) {
  const rows = [
    [
      "SKU",
      "Product",
      "Category",
      ...platforms.flatMap((p) => [
        `${platformLabels[p] || p} Status`,
        `${platformLabels[p] || p} MRP`,
        `${platformLabels[p] || p} Selling`,
        `${platformLabels[p] || p} Discount`
      ]),
      "OOS Count",
      "Best Price",
      "Highest Discount"
    ]
  ];

  products.forEach((product) => {
    const cells = platforms.flatMap((pl) => {
      const rec = product.platforms?.[pl] || {};
      return [
        String(rec.status || "unknown"),
        rec.mrp ? String(rec.mrp) : "",
        rec.selling ? String(rec.selling) : "",
        rec.discount_pct ? String(rec.discount_pct) : ""
      ];
    });

    const oosCount = productOosCount(product, platforms);
    const prices = platforms.map((pl) => Number(product.platforms?.[pl]?.selling || 0)).filter(Boolean);
    const discounts = platforms.map((pl) => Number(product.platforms?.[pl]?.discount_pct || 0));

    rows.push([
      product.sku,
      product.name,
      product.type || "",
      ...cells,
      String(oosCount),
      prices.length ? String(Math.min(...prices)) : "",
      discounts.length ? String(Math.max(...discounts)) : ""
    ]);
  });

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "brillare-oos-price-dashboard.csv";
  a.click();
  URL.revokeObjectURL(url);
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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"summary" | "prices" | "history">("summary");
  const [data, setData] = useState<LatestData>({ products: [] });
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetch("/data/latest.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch(() => setData({ products: [] }));

    fetch("/data/history.jsonl", { cache: "no-store" })
      .then((r) => r.text())
      .then((txt) => setHistory(parseHistoryText(txt)))
      .catch(() => setHistory([]));
  }, []);

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

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.sku?.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q);

      const matchesCategory = category === "all" || p.type === category;

      const oosCount = productOosCount(p, platforms);
      const inStockCount = productInStockCount(p, platforms);
      const maxDiscount = productMaxDiscount(p, platforms);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "oos" && oosCount > 0) ||
        (statusFilter === "critical" && oosCount >= 2) ||
        (statusFilter === "healthy" && oosCount === 0 && inStockCount > 0) ||
        (statusFilter === "discount" && maxDiscount > DISCOUNT_ALERT);

      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [products, query, category, statusFilter, platforms]);

  const stats = useMemo(() => {
    const cells = products.flatMap((p) =>
      platforms.map((pl) => ({
        product: p,
        platform: pl,
        rec: p.platforms?.[pl]
      }))
    );

    const inStock = cells.filter((x) => isInStock(x.rec?.status)).length;
    const oos = cells.filter((x) => isOOS(x.rec?.status)).length;
    const failures = cells.filter((x) => {
      const s = x.rec?.status;
      return !s || s === "unknown" || s.startsWith("error");
    }).length;

    const availability = cells.length ? Math.round((inStock / cells.length) * 1000) / 10 : 0;

    const platformBreakdown = platforms.map((pl) => {
      const records = products.map((p) => p.platforms?.[pl]);
      const ok = records.filter((r) => isInStock(r?.status)).length;
      const oosCount = records.filter((r) => isOOS(r?.status)).length;
      return {
        key: pl,
        label: platformLabels[pl] || pl,
        ok,
        oos: oosCount,
        total: records.length,
        pct: records.length ? Math.round((ok / records.length) * 100) : 0
      };
    });

    const critical = products
      .map((p) => ({
        ...p,
        oosCount: productOosCount(p, platforms)
      }))
      .filter((p) => p.oosCount > 0)
      .sort((a, b) => b.oosCount - a.oosCount);

    const priceRows = products.map((p) => {
      const { bestPrice, bestDiscount } = bestPriceForProduct(p, platforms);
      return { ...p, bestPrice, bestDiscount };
    });

    const discountAlerts = priceRows
      .filter((p) => p.bestDiscount && Number(p.bestDiscount.discount || 0) > DISCOUNT_ALERT)
      .sort((a, b) => Number(b.bestDiscount?.discount || 0) - Number(a.bestDiscount?.discount || 0));

    return {
      totalProducts: products.length,
      totalCells: cells.length,
      inStock,
      oos,
      failures,
      availability,
      platformBreakdown,
      critical,
      priceRows,
      discountAlerts
    };
  }, [products, platforms]);

  const historicalSummary = useMemo(() => {
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
        const failures = rows.filter((r) => !r.status || r.status === "unknown" || r.status.startsWith("error")).length;
        const discounts = rows.map((r) => Number(r.discount_pct || 0)).filter(Boolean);

        return {
          day,
          rows,
          total: rows.length,
          inStock,
          oos,
          failures,
          maxDiscount: discounts.length ? Math.max(...discounts) : 0
        };
      })
      .sort((a, b) => b.day.localeCompare(a.day));
  }, [history]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">Brillare multi-platform inventory intelligence</div>
          <h1>OOS Tracker Dashboard</h1>
          <p className="subtitle">
            A Notion-clean, Apple-style command center for stock visibility, price movement, discount risk, and historical scraper data across marketplaces.
          </p>
        </div>

        <div className="lastUpdated">
          <div className="lastUpdatedLabel">Last successful scrape</div>
          <div className="lastUpdatedValue">{formatDate(data.checked_at)}</div>
        </div>
      </section>

      <section className="tabShell">
        <div className="tabs">
          <button className={`tab ${activeTab === "summary" ? "active" : ""}`} onClick={() => setActiveTab("summary")}>
            <AlertTriangle size={16} /> OOS Summary
          </button>
          <button className={`tab ${activeTab === "prices" ? "active" : ""}`} onClick={() => setActiveTab("prices")}>
            <Tags size={16} /> Price Comparison
          </button>
          <button className={`tab ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>
            <Archive size={16} /> Historical Data
          </button>
        </div>
      </section>

      <section className="executiveStrip">
        <div>
          <span>Decision view</span>
          <strong>{stats.availability}% availability</strong>
        </div>
        <div>
          <span>Risk</span>
          <strong className={stats.oos > 0 ? "badText" : "goodText"}>{stats.oos} OOS</strong>
        </div>
        <div>
          <span>Discount leak</span>
          <strong className={stats.discountAlerts.length > 0 ? "badText" : "goodText"}>{stats.discountAlerts.length} alerts</strong>
        </div>
      </section>

      <section className="kpiGrid">
        <div className="card">
          <div className="kpiLabel">Products tracked</div>
          <div className="kpiValue">{stats.totalProducts}</div>
          <div className="kpiSub">across {platforms.length} active platforms</div>
        </div>
        <div className="card">
          <div className="kpiLabel">In stock</div>
          <div className="kpiValue green">{stats.inStock} / {stats.totalCells}</div>
          <div className="kpiSub">{stats.availability}% marketplace availability</div>
        </div>
        <div className="card">
          <div className="kpiLabel">Out of stock</div>
          <div className="kpiValue red">{stats.oos}</div>
          <div className="kpiSub">{stats.critical.length} products need attention</div>
        </div>
        <div className="card">
          <div className="kpiLabel">Discount alerts</div>
          <div className="kpiValue red">{stats.discountAlerts.length}</div>
          <div className="kpiSub">products above {DISCOUNT_ALERT}% discount</div>
        </div>
      </section>

      {activeTab === "summary" && (
        <>
          <section className="section">
            <div className="sectionTitle">
              <div>
                <h2>Platform availability</h2>
                <p>Live in-stock health by sales channel.</p>
              </div>
            </div>

            <div className="platformGrid">
              {stats.platformBreakdown.map((p, i) => {
                const Icon = i === 0 ? Globe : i === 1 ? Store : i === 2 ? ShoppingBag : i === 3 ? Sparkles : Package;
                return (
                  <div className="platformCard" key={p.key}>
                    <div className="platformName"><Icon size={14} /> {p.label}</div>
                    <div className="platformNum">{p.ok} <span>/ {p.total}</span></div>
                    <div className="kpiSub">{p.oos} OOS listings</div>
                    <div className="bar">
                      <div className="barFill" style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="section">
            <div className="sectionTitle">
              <div>
                <h2>Product status</h2>
                <p>Search, filter, and identify products with stock gaps or discount risk.</p>
              </div>
            </div>

            <div className="controls">
              <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by SKU or product name..." />
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="oos">Has OOS</option>
                <option value="critical">Critical: 2+ OOS</option>
                <option value="healthy">Healthy</option>
                <option value="discount">Discount &gt; {DISCOUNT_ALERT}%</option>
              </select>
              <button className="btn" onClick={() => downloadCSV(filtered, platforms)}><Download size={15} /> Export</button>
            </div>

            <div className="tableCard">
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
                      const oosCount = productOosCount(p, platforms);
                      const maxDiscount = productMaxDiscount(p, platforms);

                      return (
                        <tr key={p.sku}>
                          <td>
                            <div className="productName">{p.name || "Unnamed product"}</div>
                            <div className="sku">{p.sku}</div>
                          </td>
                          <td>{p.type || "—"}</td>
                          {platforms.map((pl) => {
                            const rec = p.platforms?.[pl];
                            const discount = Number(rec?.discount_pct || 0);
                            return (
                              <td key={pl} title={`${platformLabels[pl] || pl}: ${statusLabel(rec?.status)}`} className={discount > DISCOUNT_ALERT ? "priceRiskCell" : ""}>
                                <span className={`dot ${statusColor(rec?.status)}`} />
                                {discount > DISCOUNT_ALERT ? <div className="discountRed">{discount}% off</div> : null}
                              </td>
                            );
                          })}
                          <td>
                            <div className="alertStack">
                              {oosCount > 0 ? <span className="badge red">{oosCount} OOS</span> : <span className="badge green">OK</span>}
                              {maxDiscount > DISCOUNT_ALERT ? <span className="badge red">{maxDiscount}% off</span> : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filtered.length && <div className="empty">No matching products found.</div>}
              </div>
            </div>

            <div className="mobileProductList">
              {filtered.map((p) => {
                const oosCount = productOosCount(p, platforms);
                const inStockCount = productInStockCount(p, platforms);
                const maxDiscount = productMaxDiscount(p, platforms);

                return (
                  <article className="mobileProductCard" key={p.sku}>
                    <div className="mobileProductTop">
                      <div className="mobileProductInfo">
                        <div className="mobileProductName">{p.name || "Unnamed product"}</div>
                        <div className="mobileProductMeta">
                          <span>{p.sku}</span>
                          <span>{p.type || "Uncategorised"}</span>
                        </div>
                      </div>

                      {maxDiscount > DISCOUNT_ALERT ? (
                        <span className="mobileStatusPill critical">{maxDiscount}% off</span>
                      ) : oosCount > 0 ? (
                        <span className={`mobileStatusPill ${oosCount >= 2 ? "critical" : "warning"}`}>{oosCount} OOS</span>
                      ) : (
                        <span className="mobileStatusPill healthy">OK</span>
                      )}
                    </div>

                    <div className="mobileHealthRow">
                      <div>
                        <span className="mobileHealthValue green">{inStockCount}</span>
                        <span className="mobileHealthLabel"> In stock</span>
                      </div>
                      <div>
                        <span className="mobileHealthValue red">{oosCount}</span>
                        <span className="mobileHealthLabel"> OOS</span>
                      </div>
                    </div>

                    <div className="mobilePlatformGrid">
                      {platforms.map((pl) => {
                        const rec = p.platforms?.[pl];
                        const discount = Number(rec?.discount_pct || 0);

                        return (
                          <div className={discount > DISCOUNT_ALERT ? "mobilePlatformCell discountRisk" : "mobilePlatformCell"} key={pl}>
                            <div className="mobilePlatformLabel">
                              <span className={`dot ${statusColor(rec?.status)}`} />
                              {platformLabels[pl] || pl}
                            </div>
                            <div className="mobilePlatformStatus">
                              {discount > DISCOUNT_ALERT ? <strong>{discount}% off</strong> : statusLabel(rec?.status)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}

              {!filtered.length && <div className="empty">No matching products found.</div>}
            </div>

            <div className="legend">
              <span><span className="dot green" /> In stock</span>
              <span><span className="dot red" /> Out of stock</span>
              <span><span className="dot gray" /> Failed / unknown / no link</span>
              <span><span className="badge red">10%+ off</span> Discount alert</span>
            </div>
          </section>

          <section className="insightGrid">
            <div className="card">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Priority OOS list</div>
                  <div className="cardHint">Products with the most unavailable platforms.</div>
                </div>
                <AlertTriangle size={18} className="red" />
              </div>
              {stats.critical.length ? (
                <ol className="insightList">
                  {stats.critical.slice(0, 8).map((p) => (
                    <li key={p.sku}>
                      <strong>{p.name}</strong> — {p.oosCount} OOS platform{p.oosCount > 1 ? "s" : ""}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="empty">No OOS alerts right now.</div>
              )}
            </div>

            <div className="card">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Discount risk summary</div>
                  <div className="cardHint">Products discounted more than {DISCOUNT_ALERT}%.</div>
                </div>
                <TrendingDown size={18} className="red" />
              </div>
              {stats.discountAlerts.length ? (
                <ol className="insightList">
                  {stats.discountAlerts.slice(0, 10).map((p) => (
                    <li key={p.sku}>
                      <strong>{p.name}</strong> — <span className="red">{p.bestDiscount?.discount}% off</span> on {platformLabels[p.bestDiscount?.platform || ""] || p.bestDiscount?.platform}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="empty">No discount alerts above {DISCOUNT_ALERT}%.</div>
              )}
            </div>
          </section>
        </>
      )}

      {activeTab === "prices" && (
        <>
          <section className="section">
            <div className="sectionTitle">
              <div>
                <h2>Price comparison across platforms</h2>
                <p>Compare MRP, selling price, best price, and discount pressure by product.</p>
              </div>
              <button className="btn" onClick={() => downloadCSV(filtered, platforms)}><Download size={15} /> Export</button>
            </div>

            <div className="controls">
              <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product or SKU..." />
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All products</option>
                <option value="oos">Has OOS</option>
                <option value="critical">Critical OOS</option>
                <option value="healthy">Healthy</option>
                <option value="discount">Discount &gt; {DISCOUNT_ALERT}%</option>
              </select>
              <button className="btn"><Search size={15} /> Filter</button>
            </div>

            <div className="tableCard">
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Best price</th>
                      <th>Highest discount</th>
                      {platforms.map((pl) => <th key={pl}>{platformLabels[pl] || pl}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const { bestPrice, bestDiscount } = bestPriceForProduct(p, platforms);

                      return (
                        <tr key={p.sku}>
                          <td>
                            <div className="productName">{p.name || "Unnamed product"}</div>
                            <div className="sku">{p.sku}</div>
                          </td>
                          <td>
                            {bestPrice ? (
                              <>
                                <div className="price">{money(bestPrice.selling)}</div>
                                <div className="sku">{platformLabels[bestPrice.platform] || bestPrice.platform}</div>
                              </>
                            ) : "—"}
                          </td>
                          <td>
                            {bestDiscount && bestDiscount.discount > 0 ? (
                              <span className={`badge ${bestDiscount.discount > DISCOUNT_ALERT ? "red" : "amber"}`}>
                                {bestDiscount.discount}% off
                              </span>
                            ) : "—"}
                          </td>
                          {platforms.map((pl) => {
                            const rec = p.platforms?.[pl];
                            const discount = Number(rec?.discount_pct || 0);

                            return (
                              <td key={pl} className={discount > DISCOUNT_ALERT ? "priceRiskCell" : ""}>
                                {rec?.selling ? (
                                  <>
                                    <div className="price">{money(rec.selling)}</div>
                                    {rec.mrp && rec.mrp !== rec.selling ? <div className="mrp">{money(rec.mrp)}</div> : null}
                                    {rec.discount_pct ? <div className={discount > DISCOUNT_ALERT ? "discount discountRed" : "discount"}>{rec.discount_pct}% off</div> : null}
                                  </>
                                ) : (
                                  <span className={`badge ${statusColor(rec?.status)}`}>{statusLabel(rec?.status)}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filtered.length && <div className="empty">No price rows available.</div>}
              </div>
            </div>

            <div className="mobileProductList">
              {filtered.map((p) => {
                const { bestPrice, bestDiscount } = bestPriceForProduct(p, platforms);

                return (
                  <article className="mobileProductCard" key={p.sku}>
                    <div className="mobileProductTop">
                      <div className="mobileProductInfo">
                        <div className="mobileProductName">{p.name || "Unnamed product"}</div>
                        <div className="mobileProductMeta">
                          <span>{p.sku}</span>
                          <span>{p.type || "Uncategorised"}</span>
                        </div>
                      </div>

                      {bestDiscount && bestDiscount.discount > 0 ? (
                        <span className={`mobileStatusPill ${bestDiscount.discount > DISCOUNT_ALERT ? "critical" : "warning"}`}>
                          {bestDiscount.discount}% off
                        </span>
                      ) : (
                        <span className="mobileStatusPill neutral">No deal</span>
                      )}
                    </div>

                    <div className="mobilePriceHero">
                      <div>
                        <div className="mobilePriceLabel">Best price</div>
                        <div className="mobilePriceValue">{bestPrice ? money(bestPrice.selling) : "—"}</div>
                        <div className="mobilePriceSource">
                          {bestPrice ? platformLabels[bestPrice.platform] || bestPrice.platform : "No live price"}
                        </div>
                      </div>

                      <div className={bestDiscount && bestDiscount.discount > DISCOUNT_ALERT ? "mobilePriceRisk" : ""}>
                        <div className="mobilePriceLabel">Highest discount</div>
                        <div className="mobilePriceValue">
                          {bestDiscount && bestDiscount.discount > 0 ? `${bestDiscount.discount}%` : "—"}
                        </div>
                        <div className="mobilePriceSource">
                          {bestDiscount && bestDiscount.discount > 0
                            ? platformLabels[bestDiscount.platform] || bestDiscount.platform
                            : "No discount"}
                        </div>
                      </div>
                    </div>

                    <div className="mobilePlatformGrid price">
                      {platforms.map((pl) => {
                        const rec = p.platforms?.[pl];
                        const discount = Number(rec?.discount_pct || 0);

                        return (
                          <div className={discount > DISCOUNT_ALERT ? "mobilePlatformCell discountRisk" : "mobilePlatformCell"} key={pl}>
                            <div className="mobilePlatformLabel">
                              <span className={`dot ${statusColor(rec?.status)}`} />
                              {platformLabels[pl] || pl}
                            </div>

                            {rec?.selling ? (
                              <div>
                                <div className="mobilePlatformPrice">{money(rec.selling)}</div>
                                {rec.mrp && rec.mrp !== rec.selling ? <div className="mobilePlatformMrp">{money(rec.mrp)}</div> : null}
                                {rec.discount_pct ? <div className={discount > DISCOUNT_ALERT ? "mobilePlatformDiscount discountRed" : "mobilePlatformDiscount"}>{rec.discount_pct}% off</div> : null}
                              </div>
                            ) : (
                              <div className="mobilePlatformStatus">{statusLabel(rec?.status)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}

              {!filtered.length && <div className="empty">No price rows available.</div>}
            </div>
          </section>

          <section className="insightGrid">
            <div className="card">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Discount alert watchlist</div>
                  <div className="cardHint">Products discounted more than {DISCOUNT_ALERT}% on any platform.</div>
                </div>
                <TrendingDown size={18} className="red" />
              </div>
              {stats.discountAlerts.length ? (
                <ol className="insightList">
                  {stats.discountAlerts.slice(0, 10).map((p) => (
                    <li key={p.sku}>
                      <strong>{p.name}</strong> — <span className="red">{p.bestDiscount?.discount}% off</span> on {platformLabels[p.bestDiscount?.platform || ""] || p.bestDiscount?.platform}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="empty">No discount alerts above {DISCOUNT_ALERT}%.</div>
              )}
            </div>

            <div className="card">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Pricing UX notes</div>
                  <div className="cardHint">How to interpret this view.</div>
                </div>
                <Tags size={18} className="green" />
              </div>
              <ul className="insightList">
                <li>Best price shows the lowest currently scraped selling price.</li>
                <li>Discounts above {DISCOUNT_ALERT}% are treated as red risk alerts.</li>
                <li>Unavailable prices are shown as status badges instead of blank cells.</li>
              </ul>
            </div>
          </section>
        </>
      )}

      {activeTab === "history" && (
        <>
          <section className="section">
            <div className="sectionTitle">
              <div>
                <h2>Historical scraper data</h2>
                <p>Review older OOS, price, and scrape status snapshots from history.jsonl.</p>
              </div>
              <div className="badge gray">{history.length} history rows</div>
            </div>

            <div className="tableCard">
              <div className="timeline">
                {historicalSummary.slice(0, 30).map((day) => (
                  <div className="timelineItem" key={day.day}>
                    <div>
                      <div className="timelineDate">{day.day}</div>
                      <div className="timelineMeta">{day.total} checks</div>
                    </div>
                    <div className="timelineMeta">
                      In stock: <strong className="green">{day.inStock}</strong> · OOS: <strong className="red">{day.oos}</strong> · Failures: <strong className="amber">{day.failures}</strong>
                    </div>
                    <div>
                      {day.maxDiscount > DISCOUNT_ALERT ? <span className="badge red">Max {day.maxDiscount}% off</span> : day.maxDiscount ? <span className="badge amber">Max {day.maxDiscount}% off</span> : <span className="badge gray">No discount</span>}
                    </div>
                  </div>
                ))}
                {!historicalSummary.length && (
                  <div className="empty">
                    No history found yet. Make sure GitHub Actions copies <code>scraper/data/history.jsonl</code> into <code>dashboard/public/data/history.jsonl</code>.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="sectionTitle">
              <div>
                <h2>Recent history rows</h2>
                <p>Latest raw platform checks for audit and debugging.</p>
              </div>
            </div>

            <div className="tableCard">
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>SKU</th>
                      <th>Platform</th>
                      <th>Status</th>
                      <th>MRP</th>
                      <th>Selling</th>
                      <th>Discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(-120).reverse().map((row, index) => {
                      const discount = Number(row.discount_pct || 0);
                      return (
                        <tr key={`${row.ts}-${row.sku}-${row.platform}-${index}`}>
                          <td>
                            <div className="productName">{row.day || row.ts?.slice(0, 10) || "—"}</div>
                            <div className="sku">{row.ts ? formatDate(row.ts) : ""}</div>
                          </td>
                          <td>{row.sku || "—"}</td>
                          <td>{platformLabels[row.platform || ""] || row.platform || "—"}</td>
                          <td><span className={`badge ${statusColor(row.status)}`}>{statusLabel(row.status)}</span></td>
                          <td>{money(row.mrp)}</td>
                          <td>{money(row.selling)}</td>
                          <td>{discount ? <span className={discount > DISCOUNT_ALERT ? "discountRed" : ""}>{discount}%</span> : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!history.length && <div className="empty">No historical rows available.</div>}
              </div>
            </div>

            <div className="mobileProductList">
              {history.slice(-80).reverse().map((row, index) => {
                const discount = Number(row.discount_pct || 0);

                return (
                  <article className="mobileHistoryCard" key={`${row.ts}-${row.sku}-${row.platform}-${index}`}>
                    <div className="mobileProductTop">
                      <div>
                        <div className="mobileProductName">{row.sku || "Unknown SKU"}</div>
                        <div className="mobileProductMeta">
                          <span>{row.day || row.ts?.slice(0, 10) || "—"}</span>
                          <span>{platformLabels[row.platform || ""] || row.platform || "—"}</span>
                        </div>
                      </div>

                      <span className={`mobileStatusPill ${discount > DISCOUNT_ALERT ? "critical" : statusColor(row.status)}`}>
                        {discount > DISCOUNT_ALERT ? `${discount}% off` : statusLabel(row.status)}
                      </span>
                    </div>

                    <div className="mobilePriceHero three">
                      <div>
                        <div className="mobilePriceLabel">Selling</div>
                        <div className="mobilePriceValue">{money(row.selling)}</div>
                      </div>

                      <div>
                        <div className="mobilePriceLabel">MRP</div>
                        <div className="mobilePriceValue">{money(row.mrp)}</div>
                      </div>

                      <div className={discount > DISCOUNT_ALERT ? "mobilePriceRisk" : ""}>
                        <div className="mobilePriceLabel">Discount</div>
                        <div className="mobilePriceValue">{discount ? `${discount}%` : "—"}</div>
                      </div>
                    </div>

                    {row.ts ? <div className="mobileTimestamp">{formatDate(row.ts)}</div> : null}
                  </article>
                );
              })}

              {!history.length && <div className="empty">No historical rows available.</div>}
            </div>
          </section>
        </>
      )}

      <div className="footer">
        Data sources: <code>/data/latest.json</code> and <code>/data/history.jsonl</code>. Updated automatically by GitHub Actions.
      </div>
    </main>
  );
}
