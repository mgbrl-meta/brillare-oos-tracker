# Brillare OOS Tracker

Automated out-of-stock + price/discount tracker across Own Site, Amazon,
Flipkart, Nykaa, Myntra. Reads product URLs from a Google Sheet, runs
daily for free on GitHub Actions, stores full history, generates monthly
reports, and serves a dashboard on Vercel.

## How it works

```
Google Sheet (you edit)  ->  GitHub Actions (daily scrape)  ->  Vercel (dashboard)
                                      |
                                      v
                          data/history.jsonl  (full daily history, in repo)
                          data/report_YYYY_MM.json/csv  (monthly aggregate)
```

- You maintain URLs in one Google Sheet tab. Add a product = add a row.
  No code changes ever.
- The scraper captures **stock status** and **MRP + selling price**,
  computes **discount %**, and appends one record per product/platform/day.
- History lives in `data/history.jsonl` (version-controlled, free,
  unlimited granularity). The monthly report is computed from it.
- The dashboard reads JSON files - no database, no server cost.

## Part 1 - Google Sheet

1. Create a Google Sheet. Name the first tab exactly **`Tracker`**.
2. Row 1 headers, in this order (9 columns, A–I):
   `ERP SKU | Type | Product Name | Amazon URL | Flipkart URL | Nykaa URL | Myntra URL | Smytten URL | Shopify URL`
3. Paste your master-file rows. `NA` or blank = not sold on that platform
   (the scraper skips it - no false out-of-stock).
4. When new products launch, just add a row and fill the URLs. Done.

### Give the scraper read access (service account)

1. In Google Cloud Console: create a project -> enable **Google Sheets API**.
2. Create a **Service Account** -> create a JSON key -> download it.
3. Open the Sheet -> Share -> add the service account email
   (`...@...iam.gserviceaccount.com`) as **Viewer**.
4. You'll paste the JSON and the Sheet ID into GitHub secrets (Part 2).
   The Sheet ID is the long string in the sheet URL between `/d/` and `/edit`.

## Part 2 - GitHub (the engine)

1. Create a repo, push this whole folder to it.
2. Repo Settings -> Secrets and variables -> Actions -> add:
   - `GOOGLE_SHEET_ID` - the sheet id from its URL
   - `GOOGLE_SHEETS_CREDS` - paste the entire service-account JSON
   - `SLACK_WEBHOOK` - (optional) for daily OOS / deep-discount alerts
3. Actions tab -> run **Brillare OOS Tracker** manually once to test.
   It scrapes, writes `data/history.jsonl`, builds the report, commits.
4. After that it runs itself daily at 06:00 IST.

## Part 3 - Vercel (the dashboard)

1. vercel.com -> New Project -> import the repo.
2. Set **Root Directory** to `dashboard`.
3. Framework preset: Next.js (auto-detected). Deploy.
4. Your dashboard is live at `https://<project>.vercel.app`.

The dashboard has two tabs:
- **Live Status** - current stock + selling price + discount % per
  platform. Discounts >=30% are amber, >=50% red.
- **Monthly Report** - per product/platform: days tracked, days OOS,
  longest consecutive OOS streak, max & average discount.

Each daily Actions run commits fresh JSON; Vercel auto-redeploys, so the
dashboard is always current. (Re-deploy triggers on push by default.)

## Tuning

- **Discount thresholds**: edit `D_AMBER` / `D_RED` in
  `dashboard/app/page.jsx` AND `DISCOUNT_AMBER` / `DISCOUNT_RED` in
  `scraper/main.py` (keep them in sync).
- **Run time**: change the cron in `.github/workflows/tracker.yml`.
- **Price selectors**: each platform's MRP/selling-price CSS selectors
  live in the `RULES` dict in `scraper/main.py`. Sites change their
  markup occasionally - if a price stops being captured, update the
  selector there. The scraper degrades gracefully (records null, never
  crashes the run).

## Cost

GitHub Actions (daily, ~30 min) and Vercel (static) are both free tier.
Total: ₹0/month.

## Honest caveats

- Daily snapshot, not real-time.
- Marketplace scraping can hit CAPTCHAs from shared CI IPs. If a platform
  starts returning `unknown`/`error`, raise the delay in `main.py` or use
  that platform's official API where available. Shopify (own site) is the
  most reliable signal since it's your own store.
- Price selectors are best-effort and need occasional maintenance when a
  marketplace redesigns. History keeps null entries so the report stays
  honest about coverage.
