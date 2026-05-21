"""Brillare OOS Tracker - local Mac scraper (visible Chromium, longer waits, text-based selectors)."""
import asyncio, json, os, re
from datetime import datetime, timezone
from pathlib import Path
from playwright.async_api import async_playwright

DATA = Path("data"); DATA.mkdir(exist_ok=True)
HISTORY = DATA / "history.jsonl"
LATEST = DATA / "latest.json"
DISCOUNT_AMBER, DISCOUNT_RED = 30, 50
CONCURRENCY = 3

_local_creds = Path.home() / ".brillare" / "creds.json"
_local_sheet = Path.home() / ".brillare" / "sheet_id"
if _local_creds.exists() and "GOOGLE_SHEETS_CREDS" not in os.environ:
    os.environ["GOOGLE_SHEETS_CREDS"] = _local_creds.read_text()
if _local_sheet.exists() and "GOOGLE_SHEET_ID" not in os.environ:
    os.environ["GOOGLE_SHEET_ID"] = _local_sheet.read_text().strip()

PLATFORM_COLS = {"amazon":3,"flipkart":4,"nykaa":5,"myntra":6,"smytten":7,"shopify":8}
SKIP = {"", "na", "n/a", "none"}

RULES = {
  "amazon":{"oos":["currently unavailable","out of stock"],"instock_sel":"#add-to-cart-button, #buy-now-button","mrp_sel":".basisPrice .a-text-price, span.a-price.a-text-price span.a-offscreen","sell_sel":".a-price-whole, span.a-price span.a-offscreen"},
  "flipkart":{"oos":["sold out","out of stock","coming soon","notify me"],"instock_sel":"button:has-text('ADD TO CART'), button:has-text('BUY NOW'), button:has-text('Add to cart')","mrp_sel":"div:has-text('₹') >> nth=2","sell_sel":"div:has-text('₹') >> nth=0"},
  "nykaa":{"oos":["out of stock","sold out","notify me"],"instock_sel":"button:has-text('Add to Bag'), button:has-text('ADD TO BAG')","mrp_sel":"span:has-text('\u20b9') >> nth=1","sell_sel":"span:has-text('\u20b9') >> nth=0"},
  "myntra":{"oos":["out of stock","sold out","notify me"],"instock_sel":".pdp-add-to-bag, button:has-text('ADD TO BAG')","mrp_sel":".pdp-mrp s, span.pdp-mrp s","sell_sel":".pdp-price strong, span.pdp-price"},
  "smytten":{"oos":["sold out","out of stock","notify me","currently unavailable"],"instock_sel":"button:has-text('Add to cart'), button:has-text('Add to Cart')","mrp_sel":"div:has-text('₹') >> nth=2","sell_sel":"div:has-text('₹') >> nth=1"},
  "shopify":{"oos":["sold out","out of stock","notify me when available"],"instock_sel":"button[name='add'], form[action*='/cart/add'] button:not([disabled])","mrp_sel":"s.price__sale, .price__regular del, [data-compare-price]","sell_sel":".price__current, .price-item--regular, [data-product-price]"},
}
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
_BLOCK = {"image","media","font"}


def read_sheet():
    import gspread
    from google.oauth2.service_account import Credentials
    creds = Credentials.from_service_account_info(
        json.loads(os.environ["GOOGLE_SHEETS_CREDS"]),
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
    gc = gspread.authorize(creds)
    ws = gc.open_by_key(os.environ["GOOGLE_SHEET_ID"]).worksheet("Tracker")
    out = []
    for r in ws.get_all_values()[1:]:
        if not r or not r[0].strip(): continue
        out.append({"sku":r[0].strip(),"type":r[1].strip() if len(r)>1 else "",
            "name":r[2].strip() if len(r)>2 else "",
            "urls":{p:(r[i].strip() if len(r)>i else "") for p,i in PLATFORM_COLS.items()}})
    return out


def parse_price(t):
    if not t: return None
    m = re.search(r"[\d,]+(?:\.\d+)?", t.replace("\u20b9",""))
    if not m: return None
    try: return float(m.group(0).replace(",",""))
    except ValueError: return None


async def _route(route):
    try:
        if route.request.resource_type in _BLOCK: await route.abort()
        else: await route.continue_()
    except Exception: pass


async def scrape_one(ctx, url, platform):
    rules = RULES[platform]
    rec = {"status":"unknown","mrp":None,"selling":None,"discount_pct":None}
    page = await ctx.new_page()
    try:
        await page.route("**/*", _route)
        try: await page.goto(url, timeout=45000, wait_until="domcontentloaded")
        except Exception: pass
        try:
            await page.wait_for_selector(rules["instock_sel"]+", "+rules["mrp_sel"],
                                         timeout=10000, state="attached")
        except Exception:
            await page.wait_for_timeout(6000)
        try: body = (await page.inner_text("body")).lower()
        except Exception: body = ""
        ins = None
        try: ins = await page.query_selector(rules["instock_sel"])
        except Exception: pass
        if body and any(s in body for s in rules["oos"]) and not ins:
            rec["status"] = "out_of_stock"
        elif ins:
            rec["status"] = "in_stock"
        async def grab(sel):
            try:
                el = await page.query_selector(sel)
                return parse_price(await el.inner_text()) if el else None
            except Exception: return None
        if platform == "flipkart":
            try:
                fk = await page.evaluate("""() => {
                    const html = document.documentElement.innerHTML;
                    const m = html.match(/"availabilityStatus"\s*:\s*"([^"]+)"/);
                    const fsp = html.match(/"finalPrice"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)/);
                    const mrp = html.match(/"mrp"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)/);
                    return {avail: m ? m[1] : null, sell: fsp ? fsp[1] : null, mrp: mrp ? mrp[1] : null};
                }""")
                if fk.get("avail"):
                    av = fk["avail"].upper()
                    if "AVAILABLE" in av or av == "IN_STOCK": rec["status"] = "in_stock"
                    elif "OUT" in av or "SOLD" in av: rec["status"] = "out_of_stock"
                if fk.get("sell"): rec["selling"] = float(fk["sell"])
                if fk.get("mrp"): rec["mrp"] = float(fk["mrp"])
                if rec["mrp"] and rec["selling"] and rec["mrp"] > rec["selling"]:
                    rec["discount_pct"] = round((rec["mrp"]-rec["selling"])/rec["mrp"]*100,1)
                if rec["selling"]:
                    rec["status"] = "in_stock"
                elif rec["mrp"]:
                    rec["status"] = "out_of_stock"
                return rec
                # Fallback: detect by button color (orange = in stock, grey/other = OOS)
                try:
                    btn_info = await page.evaluate("""() => {
                        const btns = [...document.querySelectorAll('button')];
                        for (const b of btns) {
                            const c = getComputedStyle(b).backgroundColor;
                            const t = (b.innerText||'').toLowerCase();
                            if (/cart|buy|notify|sold/.test(t)) return {color: c, text: t};
                        }
                        return null;
                    }""")
                    if btn_info:
                        c = btn_info.get("color","").lower()
                        t = btn_info.get("text","")
                        if "notify" in t or "sold" in t: rec["status"] = "out_of_stock"
                        elif "251" in c or "255, 224" in c or "fb" in c.replace(",",""): rec["status"] = "in_stock"
                        elif "cart" in t or "buy" in t: rec["status"] = "in_stock"
                except Exception: pass
            except Exception: pass
        if platform == "flipkart":
            await page.wait_for_timeout(3000)
        if platform == "flipkart":
            # Flipkart's selling price is the largest-font ₹ element; MRP is the
            # one closest to it that's struck through.
            try:
                prices = await page.evaluate("""() => {
                    const els = [...document.querySelectorAll('*')].filter(e =>
                        /^\\s*₹\\s*[\\d,]+\\s*$/.test((e.innerText||'').trim()) && e.children.length===0);
                    const data = els.map(e => {
                        const cs = getComputedStyle(e);
                        return {txt: e.innerText.trim(), size: parseInt(cs.fontSize), strike: cs.textDecorationLine.includes('line-through')};
                    });
                    const sell = data.filter(d => !d.strike).sort((a,b)=>b.size-a.size)[0];
                    const mrp = data.find(d => d.strike) || null;
                    return {sell: sell ? sell.txt : null, mrp: mrp ? mrp.txt : null};
                }""")
                sell = parse_price(prices.get("sell"))
                mrp = parse_price(prices.get("mrp"))
            except Exception:
                sell = mrp = None
        else:
            mrp = await grab(rules["mrp_sel"]); sell = await grab(rules["sell_sel"])
        if sell and not mrp: mrp = sell
        rec["mrp"], rec["selling"] = mrp, sell
        if mrp and sell and mrp > 0 and sell <= mrp:
            rec["discount_pct"] = round((mrp - sell) / mrp * 100, 1)
        return rec
    except Exception as e:
        rec["status"] = f"error:{type(e).__name__}"; return rec
    finally:
        try: await page.close()
        except Exception: pass


async def run():
    products = read_sheet()
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    day = ts[:10]
    bySku = {}
    snapshot = {"checked_at": ts, "products": []}
    jobs = []
    for prod in products:
        prow = {"sku":prod["sku"],"name":prod["name"],"type":prod["type"],"platforms":{}}
        for platform, url in prod["urls"].items():
            if url.lower() in SKIP or not url.startswith("http"):
                prow["platforms"][platform] = {"status":"no_link"}
            else:
                jobs.append((prod["sku"], platform, url))
        bySku[prod["sku"]] = prow
        snapshot["products"].append(prow)

    sem = asyncio.Semaphore(CONCURRENCY)
    hist = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=[
                "--window-position=10000,10000",  # off-screen
                "--window-size=1366,820",
                "--start-minimized",
                "--no-startup-window",
                "--disable-features=Translate,InfiniteSessionRestore",
                "--silent-launch",
            ])
        ctx = await browser.new_context(
            user_agent=UA, locale="en-IN", timezone_id="Asia/Kolkata",
            viewport={"width": 1366, "height": 820},
            extra_http_headers={"Accept-Language": "en-IN,en;q=0.9"})
        await ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")

        async def work(sku, platform, url):
            async with sem:
                try:
                    rec = await asyncio.wait_for(scrape_one(ctx, url, platform), timeout=90)
                except Exception as e:
                    rec = {"status":f"error:{type(e).__name__}","mrp":None,"selling":None,"discount_pct":None}
                bySku[sku]["platforms"][platform] = rec
                hist.append(json.dumps({"day":day,"ts":ts,"sku":sku,"platform":platform,**rec}))
        await asyncio.gather(*(work(s,p,u) for s,p,u in jobs))
        await browser.close()

    LATEST.write_text(json.dumps(snapshot, indent=2))
    with HISTORY.open("a") as f:
        for line in hist: f.write(line + "\n")
    oos = [(p["sku"],pl) for p in snapshot["products"] for pl,v in p["platforms"].items() if v.get("status")=="out_of_stock"]
    deep = [(p["sku"],pl,v["discount_pct"]) for p in snapshot["products"] for pl,v in p["platforms"].items() if v.get("discount_pct") and v["discount_pct"]>=DISCOUNT_RED]
    print(f"{day}: {len(jobs)} urls, {len(oos)} OOS, {len(deep)} deep-discount")
    notify(oos, deep, ts)


def notify(oos, deep, ts):
    hook = os.environ.get("SLACK_WEBHOOK")
    if not hook or (not oos and not deep): return
    import urllib.request
    parts = [f"*Brillare OOS Tracker* {ts}"]
    if oos: parts.append(f"OOS ({len(oos)}): " + ", ".join(f"{s}/{p}" for s,p in oos[:30]))
    if deep: parts.append("Deep: " + ", ".join(f"{s}/{p} {d}%" for s,p,d in deep[:20]))
    try:
        req = urllib.request.Request(hook, data=json.dumps({"text":"\n".join(parts)}).encode(),
            headers={"Content-Type":"application/json"})
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print("notify failed:", e)


if __name__ == "__main__":
    asyncio.run(run())
