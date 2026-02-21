from __future__ import annotations

import re
from typing import Any

import pandas as pd

NUMERIC_HINT_TOKENS = (
    "revenue",
    "sales",
    "amount",
    "total",
    "price",
    "value",
    "cost",
    "expense",
    "spend",
    "profit",
    "margin",
    "tax",
    "gst",
    "qty",
    "quantity",
    "units",
    "count",
    "volume",
)
IDENTIFIER_HINT_TOKENS = (
    "id",
    "code",
    "zip",
    "postal",
    "pin",
    "phone",
    "mobile",
    "sku",
    "gstin",
    "invoice",
)
DATE_HINT_TOKENS = ("date", "month", "year", "time", "day")


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        result = float(value)
        if pd.isna(result):
            return fallback
        return result
    except Exception:
        return fallback


def _strip_numeric_noise(series: pd.Series) -> pd.Series:
    cleaned = series.astype("string").str.strip()
    # Convert accounting-style negatives, e.g. "(1,200)" -> "-1,200".
    cleaned = cleaned.str.replace(r"^\((.+)\)$", r"-\1", regex=True)
    # Remove grouping separators and percentage symbol before numeric cast.
    cleaned = cleaned.str.replace(",", "", regex=False)
    cleaned = cleaned.str.replace("%", "", regex=False)
    # Keep only numeric sign/dot characters after removing currency/text noise.
    cleaned = cleaned.str.replace(r"[^\d\.\-]", "", regex=True)
    cleaned = cleaned.str.replace(r"^\-$", "", regex=True)
    cleaned = cleaned.replace("", pd.NA)
    return cleaned


def parse_numeric_like_series(series: pd.Series) -> tuple[pd.Series, float]:
    if pd.api.types.is_numeric_dtype(series):
        numeric = pd.to_numeric(series, errors="coerce")
        return numeric, 1.0

    if not (pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)):
        numeric = pd.to_numeric(series, errors="coerce")
        non_null = series[series.notna()]
        ratio = float(numeric[series.notna()].notna().mean()) if not non_null.empty else 0.0
        return numeric, ratio

    as_string = series.astype("string")
    non_null_mask = as_string.notna()
    if not bool(non_null_mask.any()):
        return pd.to_numeric(series, errors="coerce"), 0.0

    cleaned = _strip_numeric_noise(as_string)
    coerced = pd.to_numeric(cleaned, errors="coerce")
    ratio = float(coerced[non_null_mask].notna().mean())
    return coerced, ratio


def _contains_any_token(value: str, tokens: tuple[str, ...]) -> bool:
    lowered = value.lower()
    return any(token in lowered for token in tokens)


def _is_likely_date_column(column: str, series: pd.Series) -> bool:
    if _contains_any_token(column, DATE_HINT_TOKENS):
        sample = series.dropna().astype(str).head(250)
        if sample.empty:
            return True
        parsed = pd.to_datetime(sample, errors="coerce")
        return float(parsed.notna().mean()) >= 0.6
    return False


def _should_auto_coerce(column: str, ratio: float, series: pd.Series) -> bool:
    lower = column.lower()
    if _contains_any_token(lower, IDENTIFIER_HINT_TOKENS):
        return False
    if _is_likely_date_column(column, series):
        return False

    has_metric_hint = _contains_any_token(lower, NUMERIC_HINT_TOKENS)
    if has_metric_hint and ratio >= 0.5:
        return True
    if ratio >= 0.95:
        return True
    return ratio >= 0.8


def prepare_numeric_dataframe(
    df: pd.DataFrame,
) -> tuple[pd.DataFrame, list[str], dict[str, Any]]:
    working = df.copy(deep=True)
    coerced_columns: list[dict[str, Any]] = []
    ignored_columns: list[dict[str, Any]] = []
    parse_scores: list[float] = []

    for column in working.columns:
        series = working[column]
        if pd.api.types.is_numeric_dtype(series):
            continue
        if not (pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)):
            continue

        coerced, ratio = parse_numeric_like_series(series)
        if ratio <= 0:
            continue

        parse_scores.append(ratio)
        ratio_rounded = round(_safe_float(ratio), 4)
        if _should_auto_coerce(str(column), ratio, series):
            working[column] = coerced
            coerced_columns.append(
                {
                    "column": str(column),
                    "parse_ratio": ratio_rounded,
                }
            )
        elif ratio >= 0.5:
            ignored_columns.append(
                {
                    "column": str(column),
                    "parse_ratio": ratio_rounded,
                    "reason": "Looks numeric but was not auto-coerced (identifier/date/low confidence).",
                }
            )

    numeric_columns = working.select_dtypes(include=["number"]).columns.tolist()
    confidence = 1.0 if not parse_scores else round(sum(parse_scores) / len(parse_scores), 4)

    audit = {
        "coerced_columns": coerced_columns,
        "ignored_columns": ignored_columns,
        "coercion_confidence": confidence,
        "numeric_columns_used": [str(column) for column in numeric_columns],
    }
    return working, numeric_columns, audit
