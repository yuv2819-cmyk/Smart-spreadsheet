from __future__ import annotations

from collections import Counter
from datetime import date, datetime
from typing import Any

import pandas as pd


def _is_string_column(series: pd.Series) -> bool:
    return pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return fallback


def _clean_text_series(series: pd.Series) -> pd.Series:
    return (
        series.astype(str)
        .str.strip()
        .str.replace(r"\s+", " ", regex=True)
    )


def _find_trim_changes(series: pd.Series) -> tuple[pd.Series, pd.Index]:
    non_null = series[series.notna()]
    if non_null.empty:
        return series, pd.Index([])
    cleaned = _clean_text_series(non_null)
    changed_idx = non_null.index[cleaned != non_null.astype(str)]
    updated = series.copy()
    if len(changed_idx) > 0:
        updated.loc[changed_idx] = cleaned.loc[changed_idx]
    return updated, changed_idx


def _snake_case_column(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() else "_" for ch in value.strip().lower())
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    cleaned = cleaned.strip("_")
    return cleaned or "column"


def _standardize_column_mapping(columns: list[str]) -> dict[str, str]:
    used: set[str] = set()
    mapping: dict[str, str] = {}
    for col in columns:
        target = _snake_case_column(str(col))
        if target in used:
            suffix = 2
            candidate = f"{target}_{suffix}"
            while candidate in used:
                suffix += 1
                candidate = f"{target}_{suffix}"
            target = candidate
        used.add(target)
        mapping[str(col)] = target
    return mapping


def _build_category_mapping(series: pd.Series) -> tuple[dict[str, str], int]:
    non_null = series[series.notna()]
    if non_null.empty:
        return {}, 0

    cleaned = _clean_text_series(non_null)
    normalized = cleaned.str.lower()

    variants: dict[str, Counter[str]] = {}
    for idx in cleaned.index:
        norm = str(normalized.loc[idx])
        val = str(cleaned.loc[idx])
        bucket = variants.setdefault(norm, Counter())
        bucket[val] += 1

    mapping: dict[str, str] = {}
    affected_rows = 0
    for norm, counts in variants.items():
        most_common = counts.most_common(1)[0][0]
        mapping[norm] = most_common
        if len(counts) > 1:
            affected_rows += int(sum(counts.values()))

    return mapping, affected_rows


def _coerce_numeric_series(series: pd.Series) -> tuple[pd.Series, float]:
    if pd.api.types.is_numeric_dtype(series):
        return series, 1.0
    coerced = pd.to_numeric(series, errors="coerce")
    non_null = series[series.notna()]
    if non_null.empty:
        return series, 0.0
    ratio = float(coerced[series.notna()].notna().mean())
    return coerced, ratio


def _coerce_datetime_series(series: pd.Series) -> tuple[pd.Series, float]:
    if pd.api.types.is_datetime64_any_dtype(series):
        return pd.to_datetime(series, errors="coerce"), 1.0
    coerced = pd.to_datetime(series, errors="coerce")
    non_null = series[series.notna()]
    if non_null.empty:
        return series, 0.0
    ratio = float(coerced[series.notna()].notna().mean())
    return coerced, ratio


def _outlier_bounds(series: pd.Series) -> tuple[float | None, float | None, int]:
    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if numeric.shape[0] < 6:
        return None, None, 0
    q1 = float(numeric.quantile(0.25))
    q3 = float(numeric.quantile(0.75))
    iqr = q3 - q1
    if iqr <= 0:
        return None, None, 0
    lower = q1 - (1.5 * iqr)
    upper = q3 + (1.5 * iqr)
    count = int(((numeric < lower) | (numeric > upper)).sum())
    return lower, upper, count


def _count_missing_cells(df: pd.DataFrame) -> int:
    return int(df.isna().sum().sum())


def _count_changed_cells(before: pd.Series, after: pd.Series) -> int:
    before_obj = before.astype("object")
    after_obj = after.astype("object")
    same = (before_obj == after_obj) | (before_obj.isna() & after_obj.isna())
    return int((~same).sum())


def _jsonable_value(value: Any) -> Any:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    if isinstance(value, (pd.Timestamp, datetime, date)):
        return value.isoformat()

    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return str(value)

    return value


def dataframe_to_json_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    normalized = df.where(pd.notnull(df), None)
    records: list[dict[str, Any]] = []
    for _, row in normalized.iterrows():
        records.append({str(col): _jsonable_value(value) for col, value in row.items()})
    return records


def build_cleaning_suggestions(df: pd.DataFrame) -> list[dict[str, Any]]:
    suggestions: list[dict[str, Any]] = []

    column_mapping = _standardize_column_mapping([str(col) for col in df.columns])
    if any(original != mapped for original, mapped in column_mapping.items()):
        suggestions.append(
            {
                "id": "standardize_column_names",
                "label": "Standardize column names",
                "description": "Rename columns to lowercase snake_case for consistency.",
                "rule_type": "standardize_column_names",
                "column": None,
                "confidence": 0.9,
                "severity": "low",
                "affected_rows": 0,
                "params": {"mapping": column_mapping},
            }
        )

    duplicate_rows = int(df.duplicated().sum())
    if duplicate_rows > 0:
        suggestions.append(
            {
                "id": "drop_duplicates",
                "label": "Remove duplicate rows",
                "description": "Drop repeated rows while keeping the first occurrence.",
                "rule_type": "drop_duplicates",
                "column": None,
                "confidence": 0.98,
                "severity": "high",
                "affected_rows": duplicate_rows,
                "params": {},
            }
        )

    for column in df.columns:
        series = df[column]

        if _is_string_column(series):
            _, trim_idx = _find_trim_changes(series)
            if len(trim_idx) > 0:
                suggestions.append(
                    {
                        "id": f"trim_whitespace::{column}",
                        "label": f"Trim whitespace in {column}",
                        "description": "Normalize leading/trailing spaces and repeated spaces.",
                        "rule_type": "trim_whitespace",
                        "column": str(column),
                        "confidence": 0.95,
                        "severity": "medium",
                        "affected_rows": int(len(trim_idx)),
                        "params": {},
                    }
                )

            category_map, affected_rows = _build_category_mapping(series)
            if category_map and affected_rows > 0:
                suggestions.append(
                    {
                        "id": f"normalize_category::{column}",
                        "label": f"Normalize labels in {column}",
                        "description": "Merge inconsistent category variants (case/spacing).",
                        "rule_type": "normalize_category",
                        "column": str(column),
                        "confidence": 0.82,
                        "severity": "medium",
                        "affected_rows": int(affected_rows),
                        "params": {},
                    }
                )

            numeric_coerced, numeric_ratio = _coerce_numeric_series(series)
            if numeric_ratio >= 0.75:
                suggestions.append(
                    {
                        "id": f"coerce_numeric::{column}",
                        "label": f"Convert {column} to numeric",
                        "description": "Parse numeric-like text values into numeric dtype.",
                        "rule_type": "coerce_numeric",
                        "column": str(column),
                        "confidence": round(min(0.95, numeric_ratio), 2),
                        "severity": "medium",
                        "affected_rows": int(numeric_coerced.notna().sum()),
                        "params": {},
                    }
                )

            datetime_coerced, datetime_ratio = _coerce_datetime_series(series)
            if datetime_ratio >= 0.75:
                suggestions.append(
                    {
                        "id": f"coerce_datetime::{column}",
                        "label": f"Convert {column} to datetime",
                        "description": "Parse date-like values into consistent datetime format.",
                        "rule_type": "coerce_datetime",
                        "column": str(column),
                        "confidence": round(min(0.95, datetime_ratio), 2),
                        "severity": "medium",
                        "affected_rows": int(datetime_coerced.notna().sum()),
                        "params": {},
                    }
                )

            missing_count = int(series.isna().sum())
            if missing_count > 0:
                non_null = series[series.notna()]
                if non_null.empty:
                    fill_value = "Unknown"
                else:
                    fill_value = str(_clean_text_series(non_null).mode().iloc[0])
                suggestions.append(
                    {
                        "id": f"fill_categorical_mode::{column}",
                        "label": f"Fill missing values in {column}",
                        "description": "Fill missing values with the most common category.",
                        "rule_type": "fill_categorical_mode",
                        "column": str(column),
                        "confidence": 0.58,
                        "severity": "low",
                        "affected_rows": missing_count,
                        "params": {"fill_value": fill_value},
                    }
                )
            continue

        if pd.api.types.is_numeric_dtype(series):
            missing_count = int(series.isna().sum())
            if missing_count > 0:
                non_null = pd.to_numeric(series, errors="coerce").dropna()
                fill_value = _safe_float(non_null.median(), 0.0) if not non_null.empty else 0.0
                suggestions.append(
                    {
                        "id": f"fill_numeric_median::{column}",
                        "label": f"Fill missing numeric values in {column}",
                        "description": "Fill missing values with the column median.",
                        "rule_type": "fill_numeric_median",
                        "column": str(column),
                        "confidence": 0.64,
                        "severity": "low",
                        "affected_rows": missing_count,
                        "params": {"fill_value": fill_value},
                    }
                )

            lower, upper, outlier_count = _outlier_bounds(series)
            if outlier_count > 0 and lower is not None and upper is not None:
                suggestions.append(
                    {
                        "id": f"clip_outliers::{column}",
                        "label": f"Clip outliers in {column}",
                        "description": "Clamp extreme values using the IQR method.",
                        "rule_type": "clip_outliers",
                        "column": str(column),
                        "confidence": 0.7,
                        "severity": "low",
                        "affected_rows": outlier_count,
                        "params": {"lower": lower, "upper": upper},
                    }
                )

    return suggestions


def build_cleaning_profile(df: pd.DataFrame, dataset_id: int) -> dict[str, Any]:
    row_count = int(len(df))
    column_count = int(len(df.columns))
    missing_cells = _count_missing_cells(df)
    total_cells = max(1, row_count * max(1, column_count))

    return {
        "dataset_id": dataset_id,
        "row_count": row_count,
        "column_count": column_count,
        "duplicate_rows": int(df.duplicated().sum()),
        "total_missing_cells": missing_cells,
        "missing_pct": round((missing_cells / total_cells) * 100, 2),
        "suggestions": build_cleaning_suggestions(df),
    }


def apply_cleaning_rules(
    df: pd.DataFrame,
    selected_rule_ids: list[str],
    suggestions: list[dict[str, Any]],
    *,
    sample_limit: int = 20,
) -> dict[str, Any]:
    rules_by_id = {rule["id"]: rule for rule in suggestions}
    valid_rule_ids = [rule_id for rule_id in selected_rule_ids if rule_id in rules_by_id]

    working = df.copy(deep=True)
    total_cells_changed = 0
    total_rows_removed = 0
    sample_diffs: list[dict[str, Any]] = []
    rule_impacts: list[dict[str, Any]] = []

    for rule_id in valid_rule_ids:
        rule = rules_by_id[rule_id]
        rule_type = str(rule.get("rule_type", ""))
        column = rule.get("column")
        params = rule.get("params") or {}
        changed_cells = 0
        rows_removed = 0
        note: str | None = None

        if rule_type == "drop_duplicates":
            dup_mask = working.duplicated(keep="first")
            rows_removed = int(dup_mask.sum())
            if rows_removed > 0 and len(sample_diffs) < sample_limit:
                for idx in working.index[dup_mask].tolist()[: sample_limit - len(sample_diffs)]:
                    sample_diffs.append(
                        {
                            "rule_id": rule_id,
                            "row_index": int(idx),
                            "column": "__row__",
                            "before": "duplicate row",
                            "after": "removed",
                        }
                    )
            working = working.loc[~dup_mask].copy()
            working.reset_index(drop=True, inplace=True)

        elif rule_type == "standardize_column_names":
            mapping = params.get("mapping") if isinstance(params, dict) else None
            if not isinstance(mapping, dict):
                mapping = _standardize_column_mapping([str(col) for col in working.columns])
            rename_map = {
                str(original): str(target)
                for original, target in mapping.items()
                if str(original) in working.columns and str(original) != str(target)
            }
            if rename_map:
                before_columns = list(working.columns)
                working = working.rename(columns=rename_map)
                changed_cells = int(len(rename_map))
                if len(sample_diffs) < sample_limit:
                    for original, updated in list(rename_map.items())[: sample_limit - len(sample_diffs)]:
                        sample_diffs.append(
                            {
                                "rule_id": rule_id,
                                "row_index": -1,
                                "column": "__column__",
                                "before": original,
                                "after": updated,
                            }
                        )
                note = (
                    f"Renamed {len(rename_map)} columns. "
                    f"Columns before: {before_columns[:8]}"
                )

        elif rule_type == "trim_whitespace" and isinstance(column, str) and column in working.columns:
            before = working[column].copy()
            after, changed_idx = _find_trim_changes(before)
            changed_cells = int(len(changed_idx))
            if changed_cells > 0:
                if len(sample_diffs) < sample_limit:
                    for idx in changed_idx.tolist()[: sample_limit - len(sample_diffs)]:
                        sample_diffs.append(
                            {
                                "rule_id": rule_id,
                                "row_index": int(idx),
                                "column": column,
                                "before": _jsonable_value(before.loc[idx]),
                                "after": _jsonable_value(after.loc[idx]),
                            }
                        )
                working[column] = after

        elif rule_type == "normalize_category" and isinstance(column, str) and column in working.columns:
            before = working[column].copy()
            non_null = before[before.notna()]
            if not non_null.empty:
                cleaned = _clean_text_series(non_null)
                normalized = cleaned.str.lower()
                canonical_map = params.get("canonical_map") if isinstance(params, dict) else None
                if not isinstance(canonical_map, dict):
                    canonical_map, _ = _build_category_mapping(before)
                mapped = normalized.map(lambda value: canonical_map.get(str(value), None))
                mapped = mapped.where(mapped.notna(), cleaned)
                updated = before.copy()
                updated.loc[cleaned.index] = mapped.values
                changed_cells = _count_changed_cells(before, updated)
                if changed_cells > 0 and len(sample_diffs) < sample_limit:
                    change_mask = ~(
                        (before.astype("object") == updated.astype("object"))
                        | (before.isna() & updated.isna())
                    )
                    changed_idx = change_mask[change_mask].index.tolist()
                    for idx in changed_idx[: sample_limit - len(sample_diffs)]:
                        sample_diffs.append(
                            {
                                "rule_id": rule_id,
                                "row_index": int(idx),
                                "column": column,
                                "before": _jsonable_value(before.loc[idx]),
                                "after": _jsonable_value(updated.loc[idx]),
                            }
                        )
                working[column] = updated

        elif rule_type == "fill_numeric_median" and isinstance(column, str) and column in working.columns:
            before = working[column].copy()
            fill_value = _safe_float(params.get("fill_value"), 0.0) if isinstance(params, dict) else 0.0
            missing_idx = before[before.isna()].index
            if len(missing_idx) > 0:
                updated = before.copy()
                updated.loc[missing_idx] = fill_value
                changed_cells = int(len(missing_idx))
                if len(sample_diffs) < sample_limit:
                    for idx in missing_idx.tolist()[: sample_limit - len(sample_diffs)]:
                        sample_diffs.append(
                            {
                                "rule_id": rule_id,
                                "row_index": int(idx),
                                "column": column,
                                "before": None,
                                "after": _jsonable_value(fill_value),
                            }
                        )
                working[column] = updated

        elif rule_type == "fill_categorical_mode" and isinstance(column, str) and column in working.columns:
            before = working[column].copy()
            fill_value = "Unknown"
            if isinstance(params, dict) and params.get("fill_value"):
                fill_value = str(params["fill_value"])
            missing_idx = before[before.isna()].index
            if len(missing_idx) > 0:
                updated = before.copy()
                updated.loc[missing_idx] = fill_value
                changed_cells = int(len(missing_idx))
                if len(sample_diffs) < sample_limit:
                    for idx in missing_idx.tolist()[: sample_limit - len(sample_diffs)]:
                        sample_diffs.append(
                            {
                                "rule_id": rule_id,
                                "row_index": int(idx),
                                "column": column,
                                "before": None,
                                "after": fill_value,
                            }
                        )
                working[column] = updated

        elif rule_type == "coerce_numeric" and isinstance(column, str) and column in working.columns:
            before = working[column].copy()
            coerced, _ = _coerce_numeric_series(before)
            updated = coerced
            changed_cells = _count_changed_cells(before, updated)
            if changed_cells > 0 and len(sample_diffs) < sample_limit:
                change_mask = ~(
                    (before.astype("object") == updated.astype("object"))
                    | (before.isna() & updated.isna())
                )
                changed_idx = change_mask[change_mask].index.tolist()
                for idx in changed_idx[: sample_limit - len(sample_diffs)]:
                    sample_diffs.append(
                        {
                            "rule_id": rule_id,
                            "row_index": int(idx),
                            "column": column,
                            "before": _jsonable_value(before.loc[idx]),
                            "after": _jsonable_value(updated.loc[idx]),
                        }
                    )
            working[column] = updated

        elif rule_type == "coerce_datetime" and isinstance(column, str) and column in working.columns:
            before = working[column].copy()
            coerced, _ = _coerce_datetime_series(before)
            updated = coerced
            changed_cells = _count_changed_cells(before, updated)
            if changed_cells > 0 and len(sample_diffs) < sample_limit:
                change_mask = ~(
                    (before.astype("object") == updated.astype("object"))
                    | (before.isna() & updated.isna())
                )
                changed_idx = change_mask[change_mask].index.tolist()
                for idx in changed_idx[: sample_limit - len(sample_diffs)]:
                    sample_diffs.append(
                        {
                            "rule_id": rule_id,
                            "row_index": int(idx),
                            "column": column,
                            "before": _jsonable_value(before.loc[idx]),
                            "after": _jsonable_value(updated.loc[idx]),
                        }
                    )
            working[column] = updated

        elif rule_type == "clip_outliers" and isinstance(column, str) and column in working.columns:
            before = working[column].copy()
            lower = _safe_float(params.get("lower"), float("-inf")) if isinstance(params, dict) else float("-inf")
            upper = _safe_float(params.get("upper"), float("inf")) if isinstance(params, dict) else float("inf")
            numeric = pd.to_numeric(before, errors="coerce")
            clipped = numeric.clip(lower=lower, upper=upper)
            updated = clipped
            changed_cells = _count_changed_cells(before, updated)
            if changed_cells > 0 and len(sample_diffs) < sample_limit:
                change_mask = ~(
                    (before.astype("object") == updated.astype("object"))
                    | (before.isna() & updated.isna())
                )
                changed_idx = change_mask[change_mask].index.tolist()
                for idx in changed_idx[: sample_limit - len(sample_diffs)]:
                    sample_diffs.append(
                        {
                            "rule_id": rule_id,
                            "row_index": int(idx),
                            "column": column,
                            "before": _jsonable_value(before.loc[idx]),
                            "after": _jsonable_value(updated.loc[idx]),
                        }
                    )
            working[column] = updated

        else:
            note = "Rule was skipped because the target column was unavailable."

        total_cells_changed += changed_cells
        total_rows_removed += rows_removed
        rule_impacts.append(
            {
                "rule_id": rule_id,
                "changed_cells": changed_cells,
                "rows_removed": rows_removed,
                "note": note,
            }
        )

    return {
        "selected_rule_ids": valid_rule_ids,
        "rows_before": int(len(df)),
        "rows_after": int(len(working)),
        "total_cells_changed": int(total_cells_changed),
        "total_rows_removed": int(total_rows_removed),
        "rule_impacts": rule_impacts,
        "sample_diffs": sample_diffs[:sample_limit],
        "dataframe": working,
    }


def build_row_level_diff(
    before_df: pd.DataFrame,
    after_df: pd.DataFrame,
    *,
    limit: int = 20,
) -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []
    max_rows = max(len(before_df), len(after_df))

    for idx in range(max_rows):
        before_row = before_df.iloc[idx].to_dict() if idx < len(before_df) else None
        after_row = after_df.iloc[idx].to_dict() if idx < len(after_df) else None
        if before_row == after_row:
            continue
        changes.append(
            {
                "row_index": idx,
                "before": {str(k): _jsonable_value(v) for k, v in (before_row or {}).items()},
                "after": {str(k): _jsonable_value(v) for k, v in (after_row or {}).items()},
            }
        )
        if len(changes) >= limit:
            break

    return changes
