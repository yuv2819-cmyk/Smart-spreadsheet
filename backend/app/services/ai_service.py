import json
import logging
from typing import Any

from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

PLACEHOLDER_OPENAI_KEYS = {
    "",
    "your-openai-api-key-here",
    "your_openai_api_key_here",
}


def _is_placeholder_api_key(value: str | None) -> bool:
    if not value:
        return True
    return value.strip().lower() in PLACEHOLDER_OPENAI_KEYS


class AIService:
    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.client = None if _is_placeholder_api_key(self.api_key) else OpenAI(api_key=self.api_key)
        self.provider = "openai" if self.client else "mock"

    def summarize_dataset(
        self,
        row_count: int,
        columns: list[str],
        sample_data: list[dict[str, Any]],
        numeric_stats: dict[str, dict[str, float]],
    ) -> dict[str, Any]:
        """Generate a summary of the dataset using OpenAI or heuristics fallback."""
        if self.provider == "mock":
            return self._generate_heuristic_summary(row_count, columns, numeric_stats)

        try:
            return self._generate_openai_summary(row_count, columns, sample_data, numeric_stats)
        except Exception as exc:
            logger.error(f"AI provider failed: {str(exc)}")
            return self._generate_heuristic_summary(row_count, columns, numeric_stats)

    def _generate_openai_summary(
        self,
        row_count: int,
        columns: list[str],
        sample_data: list[dict[str, Any]],
        numeric_stats: dict[str, dict[str, float]],
    ) -> dict[str, Any]:
        logger.info("Calling OpenAI for dataset summary")

        stats_str = json.dumps(numeric_stats, indent=None)
        samples_str = json.dumps(sample_data[:5], indent=None)

        system_prompt = (
            "You are a professional data analyst. "
            "Analyze the provided dataset metadata and generate a concise summary and 3-5 key insights. "
            "Return strictly valid JSON with keys: 'summary' (string) and 'key_insights' (list of strings)."
        )
        user_prompt = (
            f"Dataset Stats:\n"
            f"- Rows: {row_count}\n"
            f"- Columns: {', '.join(columns)}\n"
            f"- Numeric Stats: {stats_str}\n"
            f"- Sample Data: {samples_str}\n\n"
            "Generate a professional summary and insights."
        )

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=500,
        )

        content = response.choices[0].message.content or ""
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            data = json.loads(content)
            return {
                "summary": data.get("summary", "Summary not generated."),
                "key_insights": data.get("key_insights", []),
            }
        except json.JSONDecodeError:
            logger.error("Failed to parse AI JSON response")
            return {
                "summary": content[:500] if content else "Summary could not be generated.",
                "key_insights": ["Could not extract structured insights."],
            }

    def _generate_heuristic_summary(
        self,
        row_count: int,
        columns: list[str],
        numeric_stats: dict[str, dict[str, float]],
    ) -> dict[str, Any]:
        summary = (
            f"This dataset contains {row_count} rows and {len(columns)} columns. "
            f"Key columns include {', '.join(columns[:5])}."
        )

        insights: list[str] = []
        for col, stats in list(numeric_stats.items())[:3]:
            insights.append(f"{col}: Avg {stats.get('avg', 0):.2f}, Max {stats.get('max', 0)}")

        if not insights:
            insights.append("No numeric columns found for deep analysis.")

        return {
            "summary": summary,
            "key_insights": insights,
        }


ai_service = AIService()
