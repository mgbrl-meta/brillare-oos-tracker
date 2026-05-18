"""
Monthly report generator for Brillare OOS Tracker.

Reads data/history.jsonl and produces, per product+platform for a given
month:
  - days_oos        : number of distinct days seen out_of_stock
  - longest_streak  : longest consecutive-day OOS run
  - max_discount    : highest discount % seen
  - avg_discount    : average discount % across days with a discount

Outputs:
  data/report_YYYY_MM.json   (consumed by the dashboard)
  data/report_YYYY_MM.csv    (downloadable / shareable)

Usage:
  python report.py            # current month
  python report.py 2026-04    # specific month
"""
import json, sys, csv
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone

DATA = Path("data")
HISTORY = DATA / "history.jsonl"


def load_history(month):
    rows = []
    if not HISTORY.exists():
        return rows
    for line in HISTORY.read_text().splitlines():
        if not line.strip():
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        if r.get("day", "").startswith(month):
            rows.append(r)
    return rows


def longest_oos_streak(days_sorted):
    """days_sorted: sorted list of date strings that were OOS."""
    if not days_sorted:
        return 0
    best = cur = 1
    prev = datetime.fromisoformat(days_sorted[0])
    for d in days_sorted[1:]:
        cur_d = datetime.fromisoformat(d)
        if (cur_d - prev).days == 1:
            cur += 1
            best = max(best, cur)
        else:
            cur = 1
        prev = cur_d
    return best


def build(month):
    rows = load_history(month)
    # key = (sku, platform)
    agg = defaultdict(lambda: {"oos_days": set(), "discounts": [],
                               "name": "", "status_days": set()})
    for r in rows:
        k = (r["sku"], r["platform"])
        a = agg[k]
        a["status_days"].add(r["day"])
        if r.get("status") == "out_of_stock":
            a["oos_days"].add(r["day"])
        d = r.get("discount_pct")
        if isinstance(d, (int, float)):
            a["discounts"].append(d)

    report = []
    for (sku, platform), a in sorted(agg.items()):
        oos_sorted = sorted(a["oos_days"])
        disc = a["discounts"]
        report.append({
            "sku": sku,
            "platform": platform,
            "days_tracked": len(a["status_days"]),
            "days_oos": len(a["oos_days"]),
            "longest_oos_streak": longest_oos_streak(oos_sorted),
            "max_discount": round(max(disc), 1) if disc else None,
            "avg_discount": round(sum(disc) / len(disc), 1) if disc else None,
        })
    return report


def main():
    month = sys.argv[1] if len(sys.argv) > 1 \
        else datetime.now(timezone.utc).strftime("%Y-%m")
    rep = build(month)
    tag = month.replace("-", "_")
    out_json = DATA / f"report_{tag}.json"
    out_csv = DATA / f"report_{tag}.csv"

    out_json.write_text(json.dumps(
        {"month": month, "generated": datetime.now(timezone.utc)
         .isoformat(timespec="seconds"), "rows": rep}, indent=2))

    with out_csv.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "sku", "platform", "days_tracked", "days_oos",
            "longest_oos_streak", "max_discount", "avg_discount"])
        w.writeheader()
        w.writerows(rep)

    tot_oos = sum(1 for r in rep if r["days_oos"] > 0)
    print(f"Report {month}: {len(rep)} product/platform rows, "
          f"{tot_oos} had >=1 OOS day. Wrote {out_json.name}, {out_csv.name}")


if __name__ == "__main__":
    main()
