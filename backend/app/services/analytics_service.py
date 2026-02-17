from __future__ import annotations

from typing import Any

import pandas as pd

DATE_HINT_TOKENS = ("date", "time", "month", "year", "day")
REVENUE_HINT_TOKENS = ("revenue", "sales", "amount", "total", "gmv", "value")
VOLUME_HINT_TOKENS = ("quantity", "qty", "units", "orders", "count", "volume")


def _clean_label(value: Any) -> str:
    if value is None:
        return "Unknown"
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null", "<na>"}:
        return "Unknown"
    return text[:120]


def _detect_date_columns(df: pd.DataFrame) -> tuple[list[str], dict[str, pd.Series]]:
    date_columns: list[str] = []
    parsed_by_column: dict[str, pd.Series] = {}

    for column in df.columns:
        series = df[column]
        if pd.api.types.is_datetime64_any_dtype(series):
            date_columns.append(column)
            parsed_by_column[column] = pd.to_datetime(series, errors="coerce")
            continue

        if not pd.api.types.is_object_dtype(series) and not pd.api.types.is_string_dtype(series):
            continue

        non_null = series.dropna().astype(str)
        if non_null.empty:
            continue

        sample = non_null.head(300)
        parsed_sample = pd.to_datetime(sample, errors="coerce")
        parse_ratio = float(parsed_sample.notna().mean())

        is_likely_date_name = any(token in column.lower() for token in DATE_HINT_TOKENS)
        if parse_ratio >= 0.7 or (is_likely_date_name and parse_ratio >= 0.5):
            parsed_full = pd.to_datetime(series, errors="coerce")
            if float(parsed_full.notna().mean()) >= 0.5:
                date_columns.append(column)
                parsed_by_column[column] = parsed_full

    return date_columns, parsed_by_column


def _find_best_metric_column(columns: list[str], numeric_columns: list[str]) -> str | None:
    if not numeric_columns:
        return None

    lower_columns = {col: col.lower() for col in numeric_columns}
    for token in REVENUE_HINT_TOKENS:
        for original, lowered in lower_columns.items():
            if token in lowered:
                return original
    return numeric_columns[0]


def _build_data_quality(df: pd.DataFrame) -> dict[str, Any]:
    row_count = int(len(df))
    column_count = int(len(df.columns))
    total_cells = max(1, row_count * max(1, column_count))

    missing_by_column = df.isna().sum()
    duplicate_rows = int(df.duplicated().sum())
    total_missing = int(missing_by_column.sum())
    completeness_pct = round(((total_cells - total_missing) / total_cells) * 100, 2)

    high_missing_columns = []
    for column, missing_count in missing_by_column.sort_values(ascending=False).items():
        missing_pct = round((float(missing_count) / max(1, row_count)) * 100, 2)
        if missing_pct >= 10:
            high_missing_columns.append(
                {
                    "column": str(column),
                    "missing_count": int(missing_count),
                    "missing_pct": missing_pct,
                }
            )

    return {
        "rows_analyzed": row_count,
        "columns_analyzed": column_count,
        "duplicate_rows": duplicate_rows,
        "duplicate_pct": round((duplicate_rows / max(1, row_count)) * 100, 2),
        "completeness_pct": completeness_pct,
        "high_missing_columns": high_missing_columns[:8],
    }


def _build_numeric_profiles(df: pd.DataFrame, numeric_columns: list[str]) -> list[dict[str, Any]]:
    profiles: list[dict[str, Any]] = []
    row_count = max(1, len(df))

    for column in numeric_columns:
        series = pd.to_numeric(df[column], errors="coerce")
        valid = series.dropna()
        if valid.empty:
            continue

        q1 = float(valid.quantile(0.25))
        q3 = float(valid.quantile(0.75))
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        outlier_count = int(((valid < lower) | (valid > upper)).sum()) if iqr > 0 else 0

        profiles.append(
            {
                "column": column,
                "count": int(valid.shape[0]),
                "missing_pct": round((1 - (valid.shape[0] / row_count)) * 100, 2),
                "min": float(valid.min()),
                "q1": q1,
                "median": float(valid.median()),
                "mean": float(valid.mean()),
                "q3": q3,
                "max": float(valid.max()),
                "std_dev": float(valid.std()) if valid.shape[0] > 1 else 0.0,
                "outlier_count": outlier_count,
                "outlier_pct": round((outlier_count / max(1, valid.shape[0])) * 100, 2),
            }
        )

    return profiles[:12]


def _build_categorical_profiles(
    df: pd.DataFrame,
    categorical_columns: list[str],
) -> list[dict[str, Any]]:
    profiles: list[dict[str, Any]] = []
    row_count = max(1, len(df))

    for column in categorical_columns:
        series = df[column].astype("string")
        non_null = series.dropna()
        if non_null.empty:
            continue

        value_counts = non_null.value_counts(dropna=True).head(5)
        top_values = [
            {
                "label": _clean_label(label),
                "count": int(count),
                "pct": round((int(count) / row_count) * 100, 2),
            }
            for label, count in value_counts.items()
        ]

        profiles.append(
            {
                "column": column,
                "unique_count": int(non_null.nunique(dropna=True)),
                "missing_pct": round((1 - (non_null.shape[0] / row_count)) * 100, 2),
                "top_values": top_values,
            }
        )

    return profiles[:8]


def _build_correlations(df: pd.DataFrame, numeric_columns: list[str]) -> list[dict[str, Any]]:
    if len(numeric_columns) < 2:
        return []

    usable = df[numeric_columns].apply(pd.to_numeric, errors="coerce")
    usable = usable.dropna(how="all")
    if usable.shape[0] < 3:
        return []

    corr_matrix = usable.corr(numeric_only=True)
    results: list[dict[str, Any]] = []

    columns = corr_matrix.columns.tolist()
    for i, left in enumerate(columns):
        for j in range(i + 1, len(columns)):
            right = columns[j]
            value = corr_matrix.iloc[i, j]
            if pd.isna(value):
                continue
            corr = float(value)
            results.append(
                {
                    "column_x": left,
                    "column_y": right,
                    "correlation": round(corr, 4),
                    "strength": abs(round(corr, 4)),
                    "direction": "positive" if corr >= 0 else "negative",
                }
            )

    results.sort(key=lambda item: item["strength"], reverse=True)
    return results[:8]


def _build_segment_insights(
    df: pd.DataFrame,
    categorical_columns: list[str],
    metric_column: str | None,
) -> list[dict[str, Any]]:
    if not metric_column or not categorical_columns:
        return []

    segments: list[dict[str, Any]] = []
    numeric_metric = pd.to_numeric(df[metric_column], errors="coerce")
    base = pd.DataFrame({"metric": numeric_metric})

    for column in categorical_columns[:4]:
        base[column] = df[column].map(_clean_label)
        grouped = (
            base.dropna(subset=["metric"])
            .groupby(column)["metric"]
            .agg(["sum", "mean", "count"])
            .sort_values("sum", ascending=False)
        )
        if grouped.empty:
            continue

        top = grouped.head(5)
        total_sum = float(grouped["sum"].sum()) if float(grouped["sum"].sum()) != 0 else 1.0
        top_rows = [
            {
                "segment": str(index),
                "sum": float(row["sum"]),
                "mean": float(row["mean"]),
                "count": int(row["count"]),
                "share_pct": round((float(row["sum"]) / total_sum) * 100, 2),
            }
            for index, row in top.iterrows()
        ]

        segments.append(
            {
                "segment_column": column,
                "metric_column": metric_column,
                "top_segments": top_rows,
            }
        )

    return segments[:3]


def _build_trend_insight(
    df: pd.DataFrame,
    date_columns: list[str],
    parsed_dates: dict[str, pd.Series],
    metric_column: str | None,
) -> dict[str, Any] | None:
    if not date_columns or not metric_column:
        return None

    preferred_date = None
    for column in date_columns:
        if any(token in column.lower() for token in DATE_HINT_TOKENS):
            preferred_date = column
            break
    if not preferred_date:
        preferred_date = date_columns[0]

    date_series = parsed_dates.get(preferred_date)
    if date_series is None:
        return None

    metric_series = pd.to_numeric(df[metric_column], errors="coerce")
    trend_df = pd.DataFrame({"date": date_series, "metric": metric_series}).dropna()
    if trend_df.empty or trend_df.shape[0] < 3:
        return None

    trend_df["period"] = trend_df["date"].dt.to_period("M").astype(str)
    grouped = trend_df.groupby("period")["metric"].sum().sort_index()
    if grouped.shape[0] < 2:
        return None

    points = [{"period": period, "value": float(value)} for period, value in grouped.tail(12).items()]
    latest = float(grouped.iloc[-1])
    previous = float(grouped.iloc[-2])
    growth_pct: float | None = None
    if previous != 0:
        growth_pct = round(((latest - previous) / abs(previous)) * 100, 2)

    return {
        "date_column": preferred_date,
        "metric_column": metric_column,
        "latest_value": latest,
        "previous_value": previous,
        "growth_pct": growth_pct,
        "direction": "up" if growth_pct is not None and growth_pct >= 0 else "down",
        "points": points,
    }


def _build_kpis(df: pd.DataFrame, numeric_columns: list[str]) -> dict[str, Any]:
    revenue_column = None
    volume_column = None

    lower = {column: column.lower() for column in numeric_columns}
    for column, lowered in lower.items():
        if revenue_column is None and any(token in lowered for token in REVENUE_HINT_TOKENS):
            revenue_column = column
        if volume_column is None and any(token in lowered for token in VOLUME_HINT_TOKENS):
            volume_column = column

    kpis: dict[str, Any] = {}

    if revenue_column:
        revenue_series = pd.to_numeric(df[revenue_column], errors="coerce").dropna()
        if not revenue_series.empty:
            kpis["total_revenue_like"] = float(revenue_series.sum())
            kpis["avg_revenue_like"] = float(revenue_series.mean())
            kpis["revenue_column"] = revenue_column

    if volume_column:
        volume_series = pd.to_numeric(df[volume_column], errors="coerce").dropna()
        if not volume_series.empty:
            kpis["total_volume_like"] = float(volume_series.sum())
            kpis["avg_volume_like"] = float(volume_series.mean())
            kpis["volume_column"] = volume_column

    if revenue_column and volume_column:
        denominator = float(kpis.get("total_volume_like", 0.0))
        numerator = float(kpis.get("total_revenue_like", 0.0))
        if denominator > 0:
            kpis["avg_value_per_unit"] = round(numerator / denominator, 4)

    return kpis


def _build_recommendations(
    data_quality: dict[str, Any],
    numeric_profiles: list[dict[str, Any]],
    correlations: list[dict[str, Any]],
    segments: list[dict[str, Any]],
    trend: dict[str, Any] | None,
) -> list[str]:
    recommendations: list[str] = []

    if data_quality.get("high_missing_columns"):
        top_missing = data_quality["high_missing_columns"][0]
        recommendations.append(
            f"Prioritize data quality cleanup for '{top_missing['column']}' "
            f"({top_missing['missing_pct']}% missing)."
        )

    duplicate_pct = float(data_quality.get("duplicate_pct", 0))
    if duplicate_pct > 0:
        recommendations.append(
            f"Deduplicate records before modeling; duplicate rate is {duplicate_pct:.2f}%."
        )

    outlier_profiles = [p for p in numeric_profiles if float(p.get("outlier_pct", 0)) >= 5]
    if outlier_profiles:
        recommendations.append(
            f"Review outliers in '{outlier_profiles[0]['column']}' where "
            f"{outlier_profiles[0]['outlier_pct']}% of values are outside IQR bounds."
        )

    strong_corr = [c for c in correlations if float(c.get("strength", 0)) >= 0.7]
    if strong_corr:
        top_corr = strong_corr[0]
        recommendations.append(
            f"Track '{top_corr['column_x']}' and '{top_corr['column_y']}' together; "
            f"they show a {top_corr['direction']} correlation of {top_corr['correlation']}."
        )

    if segments:
        first_segment = segments[0]
        top_rows = first_segment.get("top_segments", [])
        if top_rows:
            leader = top_rows[0]
            if float(leader.get("share_pct", 0)) >= 40:
                recommendations.append(
                    f"Revenue concentration risk: segment '{leader['segment']}' contributes "
                    f"{leader['share_pct']}% of {first_segment['metric_column']}."
                )

    if trend and trend.get("growth_pct") is not None:
        growth_pct = float(trend["growth_pct"])
        if growth_pct < 0:
            recommendations.append(
                f"Investigate decline in {trend['metric_column']}; latest period fell {abs(growth_pct):.2f}%."
            )
        elif growth_pct > 5:
            recommendations.append(
                f"Scale current strategy for {trend['metric_column']}; latest period grew {growth_pct:.2f}%."
            )

    if not recommendations:
        recommendations.append("Dataset health is stable. Focus on deeper cohort or funnel analysis next.")

    return recommendations[:6]


def _build_executive_summary(
    df: pd.DataFrame,
    numeric_columns: list[str],
    categorical_columns: list[str],
    data_quality: dict[str, Any],
    trend: dict[str, Any] | None,
    segments: list[dict[str, Any]],
) -> str:
    row_count = int(len(df))
    col_count = int(len(df.columns))
    completeness = float(data_quality.get("completeness_pct", 0))

    parts = [
        f"Analyzed {row_count} rows across {col_count} columns "
        f"({len(numeric_columns)} numeric, {len(categorical_columns)} categorical).",
        f"Overall completeness is {completeness:.2f}%.",
    ]

    if trend and trend.get("growth_pct") is not None:
        growth = float(trend["growth_pct"])
        direction = "increased" if growth >= 0 else "decreased"
        parts.append(
            f"Time trend on '{trend['metric_column']}' {direction} by {abs(growth):.2f}% in the latest period."
        )

    if segments:
        segment = segments[0]
        top_segments = segment.get("top_segments", [])
        if top_segments:
            leader = top_segments[0]
            parts.append(
                f"Top segment for '{segment['metric_column']}' is '{leader['segment']}' "
                f"at {leader['share_pct']}% share."
            )

    return " ".join(parts)


def build_analyst_insights(df: pd.DataFrame) -> dict[str, Any]:
    """Build deterministic analyst-style insights for a dataframe."""
    if df.empty:
        return {
            "executive_summary": "Dataset is empty. Upload a CSV with at least one row to generate insights.",
            "recommendations": ["Upload non-empty data to start analysis."],
            "data_quality": {
                "rows_analyzed": 0,
                "columns_analyzed": 0,
                "duplicate_rows": 0,
                "duplicate_pct": 0.0,
                "completeness_pct": 0.0,
                "high_missing_columns": [],
            },
            "numeric_profiles": [],
            "categorical_profiles": [],
            "top_correlations": [],
            "segments": [],
            "trend": None,
            "kpis": {},
        }

    numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()
    date_columns, parsed_dates = _detect_date_columns(df)
    categorical_columns = [
        column for column in df.columns if column not in numeric_columns and column not in date_columns
    ]

    metric_column = _find_best_metric_column(list(df.columns), numeric_columns)
    data_quality = _build_data_quality(df)
    numeric_profiles = _build_numeric_profiles(df, numeric_columns)
    categorical_profiles = _build_categorical_profiles(df, categorical_columns)
    correlations = _build_correlations(df, numeric_columns)
    segments = _build_segment_insights(df, categorical_columns, metric_column)
    trend = _build_trend_insight(df, date_columns, parsed_dates, metric_column)
    kpis = _build_kpis(df, numeric_columns)
    recommendations = _build_recommendations(data_quality, numeric_profiles, correlations, segments, trend)
    executive_summary = _build_executive_summary(
        df=df,
        numeric_columns=numeric_columns,
        categorical_columns=categorical_columns,
        data_quality=data_quality,
        trend=trend,
        segments=segments,
    )

    return {
        "executive_summary": executive_summary,
        "recommendations": recommendations,
        "data_quality": data_quality,
        "numeric_profiles": numeric_profiles,
        "categorical_profiles": categorical_profiles,
        "top_correlations": correlations,
        "segments": segments,
        "trend": trend,
        "kpis": kpis,
    }
