import openai
import os
import json
import logging
from typing import List, Dict, Any, Optional

# Configure logging
logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.provider = "openai" if self.api_key else "mock"
        if self.api_key:
            openai.api_key = self.api_key

    def summarize_dataset(
        self, 
        row_count: int, 
        columns: List[str], 
        sample_data: List[Dict[str, Any]],
        numeric_stats: Dict[str, Dict[str, float]]
    ) -> Dict[str, Any]:
        """
        Generate a summary of the dataset using the configured AI provider.
        """
        if self.provider == "mock":
            return self._generate_heuristic_summary(row_count, columns, numeric_stats)

        try:
            return self._generate_openai_summary(row_count, columns, sample_data, numeric_stats)
        except Exception as e:
            logger.error(f"AI Provider failed: {str(e)}")
            # Fallback to heuristics on failure
            return self._generate_heuristic_summary(row_count, columns, numeric_stats)

    def _generate_openai_summary(
        self, 
        row_count: int, 
        columns: List[str], 
        sample_data: List[Dict[str, Any]],
        numeric_stats: Dict[str, Dict[str, float]]
    ) -> Dict[str, Any]:
        """
        Call OpenAI to generate the summary.
        """
        logger.info("Calling OpenAI for dataset summary")
        
        # Construct efficient context
        stats_str = json.dumps(numeric_stats, indent=None)
        samples_str = json.dumps(sample_data[:5], indent=None) # Limit to 5 rows for token efficiency
        
        system_prompt = (
            "You are a professional data analyst. "
            "Analyze the provided dataset metadata and generate a concise summary and 3-5 key insights. "
            "Return the response in strictly valid JSON format with keys: 'summary' (string) and 'key_insights' (list of strings)."
        )
        
        user_prompt = (
            f"Dataset Stats:\n"
            f"- Rows: {row_count}\n"
            f"- Columns: {', '.join(columns)}\n"
            f"- Numeric Stats: {stats_str}\n"
            f"- Sample Data: {samples_str}\n\n"
            "Generate a professional summary and insights."
        )

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo", # Use 3.5-turbo for speed/cost (or gpt-4 if specified)
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )

        content = response.choices[0].message.content
        
        # Parse JSON from response
        try:
            # Handle potential markdown fencing
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
                
            data = json.loads(content)
            return {
                "summary": data.get("summary", "Summary not generated."),
                "key_insights": data.get("key_insights", [])
            }
        except json.JSONDecodeError:
            logger.error("Failed to parse AI JSON response")
            # Fallback if JSON parsing fails but text exists
            return {
                "summary": content[:500],
                "key_insights": ["Could not extract structured insights."]
            }

    def _generate_heuristic_summary(
        self, 
        row_count: int, 
        columns: List[str], 
        numeric_stats: Dict[str, Dict[str, float]]
    ) -> Dict[str, Any]:
        """
        Fallback logic when AI is unavailable.
        """
        summary = f"This dataset contains {row_count} rows and {len(columns)} columns. Key columns include {', '.join(columns[:5])}."
        
        insights = []
        for col, stats in list(numeric_stats.items())[:3]:
            insights.append(f"{col}: Avg {stats.get('avg', 0):.2f}, Max {stats.get('max', 0)}")
            
        if not insights:
            insights.append("No numeric columns found for deep analysis.")
            
        return {
            "summary": summary,
            "key_insights": insights
        }

# Singleton instance
ai_service = AIService()
