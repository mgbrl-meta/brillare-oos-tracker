"""
Brillare OOS Tracker - daily scraper (stable optimized-serial).
One page at a time (no concurrency race), but assets blocked and
short timeouts so it's still fast. Reads Google Sheet, scrapes
stock + price, writes data/latest.json + history.jsonl.
"""
import asyncio, json, os, re
from datetime import datetime, timezone
from pathlib import Path
from playwright.async_api import async_playwright

DATA = Path("data"); DATA.mkdir(exist_ok=True)
HISTORY = DATA / "history.jsonl"
LATEST = DATA / "latest.json"

DISCOUNT_AMBER = 30
DISCOUNT_RED = 50

PLATFORM_COLS = {  # 0-based col index in Tracker tab
    "amazon": 3, "flipkart": 4, "nykaa": 5, "myntra": 6,
    "smytten": 7, "shopify": 8,
}
SKIP = {"", "na", "n/a", "none"}

RULES = {
    "amazon": {
        "oos": ["currently unavailable", "out of stock"],
        "instock_sel": "#add-to-cart-button, #buy-now-button",
        "mrp_sel": ".basisPrice .a-text-price, span.a-price.a-text-price span.a-offscreen",
        "sell_sel": ".a-price-whole, span.a-price span.a-offscreen",
    },
    "flipkart": {
        "oos": ["sold out", "out of stock", "coming soon", "notify me"],
        "instock_sel": "button:has-text('ADD TO CART'), button:has-text('BUY NOW')",
        "mrp_sel": "div._3I9_wc, div.yRaY8j",
        "sell_sel": "div._30jeq3, div.Nx9bqj",
    },
    "nykaa": {
        "oos": ["out of stock", "sold out", "notify me"],
        "instock_sel": "button:has-text('Add to Bag')",
        "mrp_sel": "span.css-1jczs19, span[class*='strike']",
        "sell_sel": "span.css-1d0jf8e, span[class*='post-card__content-price']",
    },
    "myntra": {
        "oos": ["out of stock", "sold out", "notify me"],
        "instock_sel": ".pdp-add-to-bag",
        "mrp_sel": ".pdp-mrp s, span.pdp-mrp s",
        "sell_sel": ".pdp-price strong, span.pdp-price",
    },
    "smytten": {
        "oos": ["sold out", "out of stock", "notify me", "currently unavailable"],
        "instock_sel": "button[name='add'], form[action*='/cart/add'] button:not([disabled])",
        "mrp_sel": "s.price__sale, .price__regular del, [data-compare-price], .compare-at-price",
        "sell_sel": ".price__current, .price-item--regular, [data-product-price], .price--sale",
    },
    "shopify": {
        "oos": ["sold out", "out of stock", "notify me when available"],
        "instock_sel": "button[name='add'], form[action*='/cart/add'] button:not([disabled])",
        "mrp_sel": "s.price__sale, .price__regular del, [data-compare-price]",
        "sell_sel": ".price__current, .price-item--regular, [data-product-price]",
    },
}

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def read_sheet():
    import gspread
    from google.oauth2.service_account import Credentials
    creds = Credentials.from_service_account_info(
        json.loads(os.environ["GOOGLE_SHEETS_CREDS"]),
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
    gc = gspread.authorize(creds)
    ws = gc.open_by_key(os.environ["GOOGLE_SHEET_ID"]).worksheet("Tracker")
    rows = ws.get_all_values()[1:]
    products = []
    for r in rows:
        if not r or not r[0].strip():
            continue
        products.append({
            "sku": r[0].strip(),
            "type": r[1].strip() if len(r) > 1 else "",
            "name": r[2].strip() if len(r) > 2 else "",
            "urls": {p: (r[i].strip() if len(r) > i else "")
                     for p, i in PLATFORM_COLS.items()},
        })
    return products


def parse_price(text):
    if not text:
        return None
    m = re.search(r"[\d,]+(?:\.\d+)?", text.replace("\u20b9", ""))
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


_BLOCK = {"image", "media", "font", "stylesheet"}


async def _route(route):
    try:
        if route.request.resource_type in _BLOCK:
            await route.abort()
        else:
            await route.continue_()
    except Exception:
        pass


async def scrape_one(page, url, platform):
    rules = RULES[platform]
    rec = {"status": "unknown", "mrp": None, "selling": None,
           "discount_pct": None}
    try:
        try:
            await page.goto(url, timeout=20000,
                            wait_until="domcontentloaded")
        except Exception:
            pass
        await page.wait_for_timeout(800)
        try:
            body = (await page.inner_text("body")).lower()
        except Exception:
            body = ""

        instock_el = None
        try:
            instock_el = await page.query_selector(rules["instock_sel"])
        except Exception:
            pass
        if body and any(s in body for s in rules["oos"]) and not instock_el:
            rec["status"] = "out_of_stock"
        elif instock_el:
            rec["status"] = "in_stock"

        async def grab(sel):
            try:
                el = await page.query_selector(sel)
                return parse_price(await el.inner_text()) if el else None
            except Exception:
                return None
        mrp = await grab(rules["mrp_sel"])
        sell = await grab(rules["sell_sel"])
        if sell and not mrp:
            mrp = sell
        rec["mrp"], rec["selling"] = mrp, sell
        if mrp and sell and mrp > 0 and sell <= mrp:
            rec["discount_pct"] = round((mrp - sell) / mrp * 100, 1)
        return rec
    except Exception as e:
        rec["status"] = f"error:{type(e).__name__}"
        return rec


async def run():
    products = read_sheet()
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    day = ts[:10]
    snapshot = {"checked_at": ts, "products": []}
    history_lines = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(user_agent=UA, locale="en-IN")
        await ctx.route("**/*", _route)

        for prod in products:
            prow = {"sku": prod["sku"], "name": prod["name"],
                    "type": prod["type"], "platforms": {}}
            for platform, url in prod["urls"].items():
                if url.lower() in SKIP or not url.startswith("http"):
                    prow["platforms"][platform] = {"status": "no_link"}
                    continue
                page = await ctx.new_page()
                try:
                    rec = await asyncio.wait_for(
                        scrape_one(page, url, platform), timeout=30)
                except Exception as e:
                    rec = {"status": f"error:{type(e).__name__}",
                           "mrp": None, "selling": None,
                           "discount_pct": None}
                finally:
                    try:
                        await page.close()
                    except Exception:
                        pass
                prow["platforms"][platform] = rec
                history_lines.append(json.dumps({
                    "day": day, "ts": ts, "sku": prod["sku"],
                    "platform": platform, **rec}))
            snapshot["products"].append(prow)
        await browser.close()

    LATEST.write_text(json.dumps(snapshot, indent=2))
    with HISTORY.open("a") as f:
        for line in history_lines:
            f.write(line + "\n")

    oos = [(p["sku"], pl) for p in snapshot["products"]
           for pl, v in p["platforms"].items()
           if v.get("status") == "out_of_stock"]
    deep = [(p["sku"], pl, v["discount_pct"])
            for p in snapshot["products"]
            for pl, v in p["platforms"].items()
            if v.get("discount_pct") and v["discount_pct"] >= DISCOUNT_RED]
    print(f"{day}: scraped done, {len(oos)} OOS, "
          f"{len(deep)} deep-discount (>= {DISCOUNT_RED}%)")
    notify(oos, deep, ts)


def notify(oos, deep, ts):
    hook = os.environ.get("SLACK_WEBHOOK")
    if not hook or (not oos and not deep):
        return
    import urllib.request
    parts = [f"*Brillare OOS Tracker* {ts}"]
    if oos:
        parts.append(f"OOS ({len(oos)}): " +
                      ", ".join(f"{s}/{p}" for s, p in oos[:30]))
    if deep:
        parts.append("Deep discounts: " +
                      ", ".join(f"{s}/{p} {d}%" for s, p, d in deep[:20]))
    try:
        req = urllib.request.Request(
            hook, data=json.dumps({"text": "\n".join(parts)}).encode(),
            headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print("notify failed:", e)


if __name__ == "__main__":
    asyncio.run(run())