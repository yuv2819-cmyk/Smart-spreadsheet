from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

import pandas as pd

DATE_HINTS = ("date", "time", "month", "year")
REVENUE_HINTS = ("revenue", "sales", "gmv", "amount", "turnover")
COST_HINTS = ("cost", "cogs", "expense", "spend")
PROFIT_HINTS = ("profit", "margin", "income")
LOCATION_HINTS = ("state", "region", "location", "city", "district", "zone")
GST_OUTPUT_HINTS = ("output_gst", "gst_output", "tax_collected", "igst", "cgst", "sgst")
GST_INPUT_HINTS = ("input_gst", "gst_input", "itc", "tax_paid")

FESTIVAL_CALENDAR = [
    {"name": "Makar Sankranti", "date": "2025-01-14"},
    {"name": "Holi", "date": "2025-03-14"},
    {"name": "Eid", "date": "2025-03-31"},
    {"name": "Akshaya Tritiya", "date": "2025-04-30"},
    {"name": "Independence Day Sale", "date": "2025-08-15"},
    {"name": "Navratri", "date": "2025-09-22"},
    {"name": "Diwali", "date": "2025-10-20"},
    {"name": "Wedding Season", "date": "2025-11-18"},
    {"name": "Pongal", "date": "2026-01-15"},
    {"name": "Holi", "date": "2026-03-04"},
]

INDIA_MACRO_SERIES = [
    {"period": "2025-01", "cpi_inflation_pct": 5.1, "wpi_inflation_pct": 2.4, "repo_rate_pct": 6.5, "diesel_price_index": 99.2, "inr_usd": 83.1, "monsoon_phase": "winter"},
    {"period": "2025-02", "cpi_inflation_pct": 5.0, "wpi_inflation_pct": 2.2, "repo_rate_pct": 6.5, "diesel_price_index": 99.0, "inr_usd": 82.9, "monsoon_phase": "winter"},
    {"period": "2025-03", "cpi_inflation_pct": 4.9, "wpi_inflation_pct": 2.1, "repo_rate_pct": 6.5, "diesel_price_index": 98.6, "inr_usd": 83.0, "monsoon_phase": "summer"},
    {"period": "2025-04", "cpi_inflation_pct": 4.8, "wpi_inflation_pct": 1.9, "repo_rate_pct": 6.5, "diesel_price_index": 98.3, "inr_usd": 83.3, "monsoon_phase": "summer"},
    {"period": "2025-05", "cpi_inflation_pct": 4.7, "wpi_inflation_pct": 1.8, "repo_rate_pct": 6.5, "diesel_price_index": 98.0, "inr_usd": 83.5, "monsoon_phase": "pre-monsoon"},
    {"period": "2025-06", "cpi_inflation_pct": 4.9, "wpi_inflation_pct": 2.0, "repo_rate_pct": 6.5, "diesel_price_index": 98.7, "inr_usd": 83.7, "monsoon_phase": "southwest-monsoon"},
    {"period": "2025-07", "cpi_inflation_pct": 5.2, "wpi_inflation_pct": 2.3, "repo_rate_pct": 6.5, "diesel_price_index": 99.4, "inr_usd": 83.8, "monsoon_phase": "southwest-monsoon"},
    {"period": "2025-08", "cpi_inflation_pct": 5.3, "wpi_inflation_pct": 2.5, "repo_rate_pct": 6.5, "diesel_price_index": 100.1, "inr_usd": 84.0, "monsoon_phase": "southwest-monsoon"},
    {"period": "2025-09", "cpi_inflation_pct": 5.1, "wpi_inflation_pct": 2.4, "repo_rate_pct": 6.5, "diesel_price_index": 99.8, "inr_usd": 83.9, "monsoon_phase": "retreating-monsoon"},
    {"period": "2025-10", "cpi_inflation_pct": 4.8, "wpi_inflation_pct": 2.2, "repo_rate_pct": 6.25, "diesel_price_index": 99.1, "inr_usd": 83.6, "monsoon_phase": "retreating-monsoon"},
    {"period": "2025-11", "cpi_inflation_pct": 4.6, "wpi_inflation_pct": 2.0, "repo_rate_pct": 6.25, "diesel_price_index": 98.8, "inr_usd": 83.4, "monsoon_phase": "post-monsoon"},
    {"period": "2025-12", "cpi_inflation_pct": 4.5, "wpi_inflation_pct": 1.9, "repo_rate_pct": 6.25, "diesel_price_index": 98.5, "inr_usd": 83.2, "monsoon_phase": "winter"},
    {"period": "2026-01", "cpi_inflation_pct": 4.7, "wpi_inflation_pct": 2.0, "repo_rate_pct": 6.0, "diesel_price_index": 98.9, "inr_usd": 83.5, "monsoon_phase": "winter"},
    {"period": "2026-02", "cpi_inflation_pct": 4.8, "wpi_inflation_pct": 2.1, "repo_rate_pct": 6.0, "diesel_price_index": 99.2, "inr_usd": 83.7, "monsoon_phase": "winter"},
    {"period": "2026-03", "cpi_inflation_pct": 4.9, "wpi_inflation_pct": 2.2, "repo_rate_pct": 6.0, "diesel_price_index": 99.5, "inr_usd": 83.9, "monsoon_phase": "summer"},
]

SECTOR_BENCHMARKS = {
    "retail": {"profit_margin_pct": (8.0, 22.0), "monthly_growth_pct": (2.0, 8.0), "repeat_customer_pct": (20.0, 45.0)},
    "saas": {"profit_margin_pct": (15.0, 35.0), "monthly_growth_pct": (4.0, 12.0), "repeat_customer_pct": (55.0, 90.0)},
    "manufacturing": {"profit_margin_pct": (6.0, 18.0), "monthly_growth_pct": (1.0, 6.0), "repeat_customer_pct": (35.0, 70.0)},
    "services": {"profit_margin_pct": (10.0, 28.0), "monthly_growth_pct": (2.0, 9.0), "repeat_customer_pct": (30.0, 65.0)},
    "general": {"profit_margin_pct": (8.0, 24.0), "monthly_growth_pct": (2.0, 8.0), "repeat_customer_pct": (25.0, 60.0)},
}

METRO_CITY_KEYWORDS = {"mumbai", "delhi", "new delhi", "bengaluru", "bangalore", "chennai", "hyderabad", "kolkata", "pune", "ahmedabad"}
TIER2_CITY_KEYWORDS = {"jaipur", "lucknow", "kochi", "indore", "bhopal", "coimbatore", "nagpur", "surat", "vizag", "chandigarh", "patna"}
STATE_ALIASES = {"ncr": "Delhi NCR", "tn": "Tamil Nadu", "mh": "Maharashtra", "ka": "Karnataka", "up": "Uttar Pradesh", "gj": "Gujarat", "dl": "Delhi"}


@dataclass
class ColumnSignals:
    date_column: str | None
    revenue_column: str | None
    cost_column: str | None
    profit_column: str | None
    location_column: str | None


def _safe_float(value: Any) -> float | None:
    try:
        result = float(value)
        if pd.isna(result):
            return None
        return result
    except Exception:
        return None


def _clean_text(value: Any) -> str:
    text = str(value).strip() if value is not None else ""
    if not text or text.lower() in {"nan", "none", "null", "<na>"}:
        return "Unknown"
    return text[:120]


def _find_column_by_tokens(columns: list[str], tokens: tuple[str, ...], exclude: set[str] | None = None) -> str | None:
    exclusions = exclude or set()
    for token in tokens:
        for column in columns:
            if column in exclusions:
                continue
            if token in column.lower():
                return column
    return None


def _detect_date_column(df: pd.DataFrame) -> str | None:
    for column in df.columns:
        series = df[column]
        if pd.api.types.is_datetime64_any_dtype(series):
            return str(column)
        if not pd.api.types.is_object_dtype(series) and not pd.api.types.is_string_dtype(series):
            continue
        sample = series.dropna().astype(str).head(300)
        if sample.empty:
            continue
        parsed = pd.to_datetime(sample, errors="coerce")
        ratio = float(parsed.notna().mean())
        hinted = any(token in str(column).lower() for token in DATE_HINTS)
        if ratio >= 0.75 or (hinted and ratio >= 0.55):
            return str(column)
    return None


def _detect_signals(df: pd.DataFrame) -> ColumnSignals:
    columns = [str(column) for column in df.columns]
    revenue_column = _find_column_by_tokens(columns, REVENUE_HINTS)
    cost_column = _find_column_by_tokens(columns, COST_HINTS, exclude={revenue_column} if revenue_column else None)
    profit_column = _find_column_by_tokens(columns, PROFIT_HINTS, exclude={value for value in [revenue_column, cost_column] if value})
    location_column = _find_column_by_tokens(columns, LOCATION_HINTS)
    date_column = _detect_date_column(df)
    return ColumnSignals(date_column, revenue_column, cost_column, profit_column, location_column)


def _to_numeric(series: pd.Series | None) -> pd.Series | None:
    return pd.to_numeric(series, errors="coerce") if series is not None else None


def _build_monthly_frame(df: pd.DataFrame, signals: ColumnSignals) -> pd.DataFrame:
    if not signals.date_column:
        return pd.DataFrame()
    dates = pd.to_datetime(df[signals.date_column], errors="coerce")
    base = pd.DataFrame({"date": dates})
    revenue = _to_numeric(df[signals.revenue_column]) if signals.revenue_column and signals.revenue_column in df.columns else None
    cost = _to_numeric(df[signals.cost_column]) if signals.cost_column and signals.cost_column in df.columns else None
    profit = _to_numeric(df[signals.profit_column]) if signals.profit_column and signals.profit_column in df.columns else None
    if revenue is not None:
        base["revenue"] = revenue
    if cost is not None:
        base["cost"] = cost
    if profit is not None:
        base["profit"] = profit
    elif revenue is not None and cost is not None:
        base["profit"] = revenue - cost
    value_cols = [col for col in ["revenue", "cost", "profit"] if col in base.columns]
    if not value_cols:
        return pd.DataFrame()
    base = base.dropna(subset=["date"])
    if base.empty:
        return pd.DataFrame()
    base["period"] = base["date"].dt.to_period("M").astype(str)
    return base.groupby("period")[value_cols].sum().sort_index().reset_index()

def _fy_label(period: str, fiscal_year_start_month: int) -> str:
    dt = datetime.strptime(f"{period}-01", "%Y-%m-%d")
    start = dt.year if dt.month >= fiscal_year_start_month else dt.year - 1
    return f"FY{start}-{(start + 1) % 100:02d}"


def _build_fiscal_year_summary(monthly: pd.DataFrame, fiscal_year_start_month: int) -> list[dict[str, Any]]:
    if monthly.empty:
        return []
    work = monthly.copy()
    work["fiscal_year"] = work["period"].map(lambda value: _fy_label(value, fiscal_year_start_month))
    agg_cols = [col for col in ["revenue", "cost", "profit"] if col in work.columns]
    grouped = work.groupby("fiscal_year")[agg_cols].sum().reset_index().sort_values("fiscal_year")
    rows: list[dict[str, Any]] = []
    for _, row in grouped.iterrows():
        revenue = _safe_float(row.get("revenue"))
        cost = _safe_float(row.get("cost"))
        profit = _safe_float(row.get("profit"))
        margin = round((profit / revenue) * 100, 2) if revenue not in (None, 0) and profit is not None else None
        rows.append({"fiscal_year": str(row["fiscal_year"]), "revenue": revenue, "cost": cost, "profit": profit, "profit_margin_pct": margin})
    return rows


def _build_macro_overlay(monthly: pd.DataFrame) -> list[dict[str, Any]]:
    macro_map = {row["period"]: row for row in INDIA_MACRO_SERIES}
    monthly_map = {row["period"]: row for row in monthly.to_dict(orient="records")} if not monthly.empty else {}
    festival_map: dict[str, list[str]] = {}
    for festival in FESTIVAL_CALENDAR:
        festival_map.setdefault(str(festival["date"])[:7], []).append(str(festival["name"]))

    periods = list(monthly_map.keys())[-18:] if monthly_map else [row["period"] for row in INDIA_MACRO_SERIES[-12:]]
    rows: list[dict[str, Any]] = []
    for period in periods:
        macro = macro_map.get(period, {})
        business = monthly_map.get(period, {})
        rows.append({
            "period": period,
            "revenue": _safe_float(business.get("revenue")),
            "cost": _safe_float(business.get("cost")),
            "profit": _safe_float(business.get("profit")),
            "cpi_inflation_pct": _safe_float(macro.get("cpi_inflation_pct")),
            "wpi_inflation_pct": _safe_float(macro.get("wpi_inflation_pct")),
            "repo_rate_pct": _safe_float(macro.get("repo_rate_pct")),
            "diesel_price_index": _safe_float(macro.get("diesel_price_index")),
            "inr_usd": _safe_float(macro.get("inr_usd")),
            "monsoon_phase": macro.get("monsoon_phase"),
            "festivals": festival_map.get(period, []),
        })
    return rows


def _build_festival_impact(monthly: pd.DataFrame) -> list[dict[str, Any]]:
    if monthly.empty or "revenue" not in monthly.columns:
        return []
    revenue_map = {str(row["period"]): _safe_float(row["revenue"]) for row in monthly.to_dict(orient="records")}
    rows: list[dict[str, Any]] = []
    for festival in FESTIVAL_CALENDAR:
        period = str(festival["date"])[:7]
        revenue = revenue_map.get(period)
        if revenue is None:
            continue
        prev_period = (datetime.strptime(f"{period}-01", "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m")
        prev_revenue = revenue_map.get(prev_period)
        mom_change_pct = round(((revenue - prev_revenue) / abs(prev_revenue)) * 100, 2) if prev_revenue not in (None, 0) else None
        rows.append({
            "festival": festival["name"],
            "period": period,
            "revenue": revenue,
            "previous_period": prev_period,
            "previous_revenue": prev_revenue,
            "mom_change_pct": mom_change_pct,
        })
    return sorted(rows, key=lambda item: item["period"], reverse=True)[:12]


def _normalize_location(value: Any) -> str:
    cleaned = _clean_text(value)
    alias = STATE_ALIASES.get(cleaned.lower())
    return alias or cleaned


def _classify_tier(location: str) -> str:
    lower = location.lower()
    if any(token in lower for token in METRO_CITY_KEYWORDS):
        return "Metro"
    if any(token in lower for token in TIER2_CITY_KEYWORDS):
        return "Tier 2"
    if lower in {"north", "south", "east", "west", "central", "northeast", "north-east"}:
        return "Regional"
    return "Tier 3+"


def _build_location_views(df: pd.DataFrame, signals: ColumnSignals) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not signals.location_column or signals.location_column not in df.columns:
        return [], []
    revenue = _to_numeric(df[signals.revenue_column]) if signals.revenue_column and signals.revenue_column in df.columns else None
    cost = _to_numeric(df[signals.cost_column]) if signals.cost_column and signals.cost_column in df.columns else None
    profit = _to_numeric(df[signals.profit_column]) if signals.profit_column and signals.profit_column in df.columns else None
    if profit is None and revenue is not None and cost is not None:
        profit = revenue - cost

    frame = pd.DataFrame({"location": df[signals.location_column].map(_normalize_location)})
    if revenue is not None:
        frame["revenue"] = revenue
    if profit is not None:
        frame["profit"] = profit
    if "revenue" not in frame.columns and "profit" not in frame.columns:
        return [], []

    agg_cols = [col for col in ["revenue", "profit"] if col in frame.columns]
    grouped = frame.groupby("location")[agg_cols].sum().reset_index()
    counts = frame.groupby("location").size().reset_index(name="rows")
    grouped = grouped.merge(counts, on="location", how="left")
    grouped = grouped.sort_values("revenue" if "revenue" in grouped.columns else "rows", ascending=False)

    state_rows: list[dict[str, Any]] = []
    for _, row in grouped.head(20).iterrows():
        revenue_value = _safe_float(row.get("revenue"))
        profit_value = _safe_float(row.get("profit"))
        margin = round((profit_value / revenue_value) * 100, 2) if revenue_value not in (None, 0) and profit_value is not None else None
        state_rows.append({"location": str(row["location"]), "tier": _classify_tier(str(row["location"])), "rows": int(row.get("rows", 0)), "revenue": revenue_value, "profit": profit_value, "profit_margin_pct": margin})

    tier_frame = pd.DataFrame(state_rows)
    if tier_frame.empty:
        return state_rows, []
    tier_grouped = tier_frame.groupby("tier")[["rows", "revenue", "profit"]].sum(numeric_only=True).reset_index().sort_values("revenue", ascending=False)
    tier_rows = []
    for _, row in tier_grouped.iterrows():
        revenue_value = _safe_float(row.get("revenue"))
        profit_value = _safe_float(row.get("profit"))
        margin = round((profit_value / revenue_value) * 100, 2) if revenue_value not in (None, 0) and profit_value is not None else None
        tier_rows.append({"tier": str(row["tier"]), "rows": int(row.get("rows", 0)), "revenue": revenue_value, "profit": profit_value, "profit_margin_pct": margin})
    return state_rows, tier_rows

def _detect_sector(df: pd.DataFrame) -> str:
    signal_text = " ".join([str(col).lower() for col in df.columns])
    if any(token in signal_text for token in ["sku", "inventory", "store", "mrp", "retail"]):
        return "retail"
    if any(token in signal_text for token in ["subscription", "plan", "mrr", "arr", "churn", "saas"]):
        return "saas"
    if any(token in signal_text for token in ["factory", "plant", "batch", "manufacturing"]):
        return "manufacturing"
    if any(token in signal_text for token in ["service", "project", "billable", "consulting"]):
        return "services"
    return "general"


def _find_customer_column(columns: list[str]) -> str | None:
    for hint in ("customer_id", "customer", "client", "email", "phone"):
        for column in columns:
            if hint in column.lower():
                return column
    return None


def _compare_to_range(value: float | None, bounds: tuple[float, float]) -> dict[str, Any]:
    low, high = bounds
    if value is None:
        return {"value": None, "status": "unknown", "benchmark_range": {"min": low, "max": high}}
    status = "below" if value < low else "above" if value > high else "within"
    return {"value": round(value, 2), "status": status, "benchmark_range": {"min": low, "max": high}}


def _build_sector_benchmarks(df: pd.DataFrame, monthly: pd.DataFrame) -> dict[str, Any]:
    sector = _detect_sector(df)
    ranges = SECTOR_BENCHMARKS.get(sector, SECTOR_BENCHMARKS["general"])
    margin = None
    growth = None
    repeat_rate = None

    if not monthly.empty and "revenue" in monthly.columns and "profit" in monthly.columns:
        total_revenue = float(monthly["revenue"].sum())
        total_profit = float(monthly["profit"].sum())
        if total_revenue != 0:
            margin = (total_profit / total_revenue) * 100
    if not monthly.empty and "revenue" in monthly.columns and len(monthly) > 1:
        current = _safe_float(monthly.iloc[-1].get("revenue"))
        previous = _safe_float(monthly.iloc[-2].get("revenue"))
        if current is not None and previous not in (None, 0):
            growth = ((current - previous) / abs(previous)) * 100

    customer_col = _find_customer_column([str(col) for col in df.columns])
    if customer_col and customer_col in df.columns:
        counts = df[customer_col].dropna().astype(str).value_counts()
        if not counts.empty:
            repeat_rate = float((counts[counts > 1].sum() / max(1, counts.sum())) * 100)

    return {
        "sector": sector,
        "metrics": {
            "profit_margin_pct": _compare_to_range(margin, ranges["profit_margin_pct"]),
            "monthly_growth_pct": _compare_to_range(growth, ranges["monthly_growth_pct"]),
            "repeat_customer_pct": _compare_to_range(repeat_rate, ranges["repeat_customer_pct"]),
        },
        "note": "Benchmarks are India SME directional ranges and should be used for trend guidance.",
    }


def _build_gst_summary(df: pd.DataFrame, signals: ColumnSignals) -> dict[str, Any]:
    columns = [str(col) for col in df.columns]
    output_col = _find_column_by_tokens(columns, GST_OUTPUT_HINTS)
    input_col = _find_column_by_tokens(columns, GST_INPUT_HINTS, exclude={output_col} if output_col else None)

    output_series = _to_numeric(df[output_col]) if output_col and output_col in df.columns else None
    input_series = _to_numeric(df[input_col]) if input_col and input_col in df.columns else None
    revenue = _to_numeric(df[signals.revenue_column]) if signals.revenue_column and signals.revenue_column in df.columns else None
    cost = _to_numeric(df[signals.cost_column]) if signals.cost_column and signals.cost_column in df.columns else None

    estimation_method = "from_columns"
    if output_series is None and revenue is not None:
        output_series = revenue * 0.18
        estimation_method = "estimated_18pct_on_revenue"
    if input_series is None and cost is not None:
        input_series = cost * 0.12
        if estimation_method == "from_columns":
            estimation_method = "estimated_12pct_on_cost"
        else:
            estimation_method = "estimated_from_revenue_and_cost"

    total_output = float(output_series.dropna().sum()) if output_series is not None else None
    total_input = float(input_series.dropna().sum()) if input_series is not None else None
    net_payable = total_output - total_input if total_output is not None and total_input is not None else None

    required_fields = ["invoice", "gstin", "date", "place_of_supply"]
    present = [field for field in required_fields if any(field in col.lower() for col in columns)]
    readiness = round((len(present) / len(required_fields)) * 100, 2)

    return {
        "output_gst_column": output_col,
        "input_gst_column": input_col,
        "estimation_method": estimation_method,
        "total_output_gst": total_output,
        "total_input_gst": total_input,
        "net_gst_payable": net_payable,
        "return_readiness_pct": readiness,
        "missing_compliance_fields": [field for field in required_fields if field not in present],
    }


def _next_month_day(from_date: date, day: int) -> date:
    year = from_date.year
    month = from_date.month + 1
    if month == 13:
        month = 1
        year += 1
    while True:
        try:
            return date(year, month, day)
        except ValueError:
            day -= 1


def _next_quarter_advance_tax(from_date: date) -> date:
    milestones = [date(from_date.year, 6, 15), date(from_date.year, 9, 15), date(from_date.year, 12, 15), date(from_date.year + 1, 3, 15)]
    for item in milestones:
        if item >= from_date:
            return item
    return date(from_date.year + 1, 6, 15)


def _severity_for_days(days: int) -> str:
    if days <= 3:
        return "critical"
    if days <= 10:
        return "warning"
    return "info"


def _build_compliance_alerts(now: datetime | None = None) -> list[dict[str, Any]]:
    current = (now or datetime.now(timezone.utc)).date()
    items = [
        {"name": "GSTR-1 filing", "due_date": _next_month_day(current, 11), "context": "Monthly outward supply return"},
        {"name": "GSTR-3B filing", "due_date": _next_month_day(current, 20), "context": "Monthly summary return and tax payment"},
        {"name": "TDS deposit", "due_date": _next_month_day(current, 7), "context": "Monthly TDS deposit"},
        {"name": "PF/ESI payment", "due_date": _next_month_day(current, 15), "context": "Monthly payroll compliance"},
        {"name": "Advance tax installment", "due_date": _next_quarter_advance_tax(current), "context": "Quarterly advance tax milestone"},
    ]
    rows = []
    for item in items:
        due = item["due_date"]
        due_in_days = (due - current).days
        rows.append({"name": item["name"], "context": item["context"], "due_date": due.isoformat(), "due_in_days": due_in_days, "severity": _severity_for_days(due_in_days)})
    return sorted(rows, key=lambda row: row["due_in_days"])


def _localized_block(language: str, sector: str) -> dict[str, Any]:
    lang = language.lower()
    if lang == "hindi":
        return {
            "language": lang,
            "title": "Bharat Trend Report",
            "summary": "Yeh report India business trends, GST readiness, festival demand aur state performance ko ek saath dikhati hai.",
            "key_points": [
                f"Primary benchmark sector detected: {sector}.",
                "Includes CPI/WPI, repo rate, INR, fuel, monsoon and festival overlays.",
                "Includes GST return-readiness checks.",
            ],
        }
    if lang == "hinglish":
        return {
            "language": lang,
            "title": "India Trend Report (Hinglish)",
            "summary": "Is report mein India market trend + business data combine hai for faster decisions.",
            "key_points": [
                f"Primary benchmark sector detected: {sector}.",
                "Includes CPI/WPI, repo rate, INR, fuel, monsoon and festival overlays.",
                "Includes GST return-readiness checks.",
            ],
        }
    return {
        "language": lang,
        "title": "India Trend Report",
        "summary": "This report combines India macro trends, fiscal-year performance, GST readiness, and state/tier analytics.",
        "key_points": [
            f"Primary benchmark sector detected: {sector}.",
            "Includes CPI/WPI, repo rate, INR, fuel, monsoon and festival overlays.",
            "Includes GST return-readiness checks.",
        ],
    }


def build_india_insights(df: pd.DataFrame, *, fiscal_year_start_month: int = 4, language: str = "english") -> dict[str, Any]:
    if df.empty:
        localization = _localized_block(language, "general")
        return {
            "locale": "india",
            "currency": "INR",
            "number_format": "indian",
            "fiscal_year_start_month": fiscal_year_start_month,
            "signals": {},
            "macro_overlay": _build_macro_overlay(pd.DataFrame()),
            "fiscal_year_summary": [],
            "festival_impact": [],
            "state_performance": [],
            "tier_performance": [],
            "gst_summary": {"output_gst_column": None, "input_gst_column": None, "estimation_method": "unavailable", "total_output_gst": None, "total_input_gst": None, "net_gst_payable": None, "return_readiness_pct": 0.0, "missing_compliance_fields": ["invoice", "gstin", "date", "place_of_supply"]},
            "sector_benchmarks": {"sector": "general", "metrics": {}, "note": "Upload data to compare against India SME ranges."},
            "compliance_alerts": _build_compliance_alerts(),
            "localization": localization,
            "recommended_actions": ["Upload a dataset to activate India trend insights."],
        }

    signals = _detect_signals(df)
    monthly = _build_monthly_frame(df, signals)
    fiscal_summary = _build_fiscal_year_summary(monthly, fiscal_year_start_month)
    macro_overlay = _build_macro_overlay(monthly)
    festival_impact = _build_festival_impact(monthly)
    state_rows, tier_rows = _build_location_views(df, signals)
    gst_summary = _build_gst_summary(df, signals)
    sector_benchmarks = _build_sector_benchmarks(df, monthly)
    localization = _localized_block(language, str(sector_benchmarks.get("sector", "general")))

    actions = []
    if isinstance(gst_summary.get("return_readiness_pct"), (int, float)) and float(gst_summary["return_readiness_pct"]) < 75:
        actions.append("Add missing GST compliance fields (invoice/gstin/date/place_of_supply) before next filing cycle.")
    if festival_impact:
        best = max(festival_impact, key=lambda row: row.get("mom_change_pct") or float("-inf"))
        if isinstance(best.get("mom_change_pct"), (int, float)):
            actions.append(f"Replicate demand playbook around {best.get('festival')} (MoM impact {best.get('mom_change_pct')}%).")
    if tier_rows:
        leader = max(tier_rows, key=lambda row: row.get("revenue") or 0)
        actions.append(f"Scale campaigns in {leader.get('tier')} where revenue concentration is highest.")
    if not actions:
        actions = [
            "Track monthly KPIs by India fiscal year (Apr-Mar).",
            "Review state and tier contribution monthly for expansion planning.",
        ]

    return {
        "locale": "india",
        "currency": "INR",
        "number_format": "indian",
        "fiscal_year_start_month": fiscal_year_start_month,
        "signals": {
            "date_column": signals.date_column,
            "revenue_column": signals.revenue_column,
            "cost_column": signals.cost_column,
            "profit_column": signals.profit_column,
            "location_column": signals.location_column,
        },
        "macro_overlay": macro_overlay,
        "fiscal_year_summary": fiscal_summary,
        "festival_impact": festival_impact,
        "state_performance": state_rows,
        "tier_performance": tier_rows,
        "gst_summary": gst_summary,
        "sector_benchmarks": sector_benchmarks,
        "compliance_alerts": _build_compliance_alerts(),
        "localization": localization,
        "recommended_actions": actions[:5],
    }


def _format_indian_number(value: float) -> str:
    rounded = int(round(value))
    sign = "-" if rounded < 0 else ""
    digits = str(abs(rounded))
    if len(digits) <= 3:
        return f"{sign}{digits}"
    last_three = digits[-3:]
    head = digits[:-3]
    groups: list[str] = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return f"{sign}{','.join(groups + [last_three])}"


def _to_inr(value: float | None) -> str:
    return f"Rs {_format_indian_number(value)}" if value is not None else "N/A"


def build_india_report_payload(*, dataset_name: str, insights: dict[str, Any], language: str = "english") -> dict[str, Any]:
    localization = insights.get("localization") or _localized_block(language, "general")
    fy_rows = insights.get("fiscal_year_summary", [])
    latest_fy = fy_rows[-1] if fy_rows else None
    gst = insights.get("gst_summary", {})
    benchmarks = insights.get("sector_benchmarks", {})

    summary = str(localization.get("summary") or "India trend summary unavailable.")
    key_insights = list(localization.get("key_points") or [])
    if latest_fy:
        key_insights.append(f"{latest_fy.get('fiscal_year')} margin: {latest_fy.get('profit_margin_pct')}%.")
    if gst.get("net_gst_payable") is not None:
        key_insights.append(f"Estimated net GST payable: {_to_inr(_safe_float(gst.get('net_gst_payable')))}.")

    risks = []
    readiness = gst.get("return_readiness_pct")
    if isinstance(readiness, (int, float)) and readiness < 70:
        risks.append("GST return readiness is below 70%; compliance risk is elevated.")
    alerts = [item for item in insights.get("compliance_alerts", []) if item.get("severity") == "critical"]
    if alerts:
        risks.append(f"Immediate statutory deadline: {alerts[0].get('name')}.")
    if not risks:
        risks.append("No critical India-specific risk detected in current snapshot.")

    drivers = []
    festivals = insights.get("festival_impact", [])
    if festivals:
        top = max(festivals, key=lambda row: row.get("mom_change_pct") or float("-inf"))
        if isinstance(top.get("mom_change_pct"), (int, float)):
            drivers.append(f"Festival driver: {top.get('festival')} delivered {top.get('mom_change_pct')}% MoM movement.")
    locations = insights.get("state_performance", [])
    if locations:
        leader = max(locations, key=lambda row: row.get("revenue") or 0)
        drivers.append(f"Geography driver: {leader.get('location')} leads revenue contribution.")
    if not drivers:
        drivers.append("No dominant India-specific driver identified from current data.")

    recommendations = list(insights.get("recommended_actions") or [])
    kpis = {
        "Fiscal Year": str(latest_fy.get("fiscal_year")) if latest_fy else "N/A",
        "FY Revenue": _to_inr(_safe_float(latest_fy.get("revenue")) if latest_fy else None),
        "FY Profit": _to_inr(_safe_float(latest_fy.get("profit")) if latest_fy else None),
        "FY Margin %": str(latest_fy.get("profit_margin_pct")) if latest_fy else "N/A",
        "GST Net Payable": _to_inr(_safe_float(gst.get("net_gst_payable"))),
        "GST Readiness %": str(gst.get("return_readiness_pct")),
        "Benchmark Sector": str(benchmarks.get("sector") if isinstance(benchmarks, dict) else "general"),
    }

    markdown_lines = [
        f"# {localization.get('title', 'India Trend Report')}",
        "",
        f"Dataset: {dataset_name}",
        "",
        "## Executive Summary",
        summary,
        "",
        "## Key Insights",
    ]
    markdown_lines.extend([f"- {line}" for line in key_insights])
    markdown_lines.extend(["", "## KPI Snapshot"])
    markdown_lines.extend([f"- {key}: {value}" for key, value in kpis.items()])
    markdown_lines.extend(["", "## Risks"])
    markdown_lines.extend([f"- {line}" for line in risks])
    markdown_lines.extend(["", "## Drivers"])
    markdown_lines.extend([f"- {line}" for line in drivers])
    markdown_lines.extend(["", "## Recommendations"])
    markdown_lines.extend([f"- {line}" for line in recommendations])
    markdown_lines.extend(["", "Generated by SmartSheet India Insights Mode"])

    return {
        "name": f"{dataset_name} - India Trend Report",
        "type": "India Trend",
        "summary": summary,
        "key_insights": key_insights,
        "recommendations": recommendations,
        "risks": risks,
        "drivers": drivers,
        "kpis": {str(key): str(value) for key, value in kpis.items()},
        "content_markdown": "\n".join(markdown_lines),
        "status": "Ready",
    }
