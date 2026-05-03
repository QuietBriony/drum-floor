from __future__ import annotations

import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = REPO_ROOT / "evolution" / "schema" / "promotion-request.schema.json"
EXAMPLE_PATH = REPO_ROOT / "evolution" / "examples" / "promotion-request.example.json"


class PromotionWorkflowChecks(unittest.TestCase):
    def test_promotion_schema_and_example_parse(self) -> None:
        schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        example = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
        self.assertEqual(schema["title"], "drum-floor evolution promotion request")
        self.assertEqual(example["schema"], "drum-floor.evolution.promotion-request.v1")

    def test_promotion_safety_flags_require_human_gate(self) -> None:
        example = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
        safety = example["safety"]
        self.assertTrue(safety["metadata_only"])
        self.assertFalse(safety["auto_promotes_pattern_frame"])
        self.assertFalse(safety["writes_live_armed"])
        self.assertFalse(safety["adds_audio"])
        self.assertFalse(safety["adds_samples"])
        self.assertFalse(safety["adds_dependencies"])
        self.assertFalse(safety["touches_workflows"])

    def test_promotion_docs_define_no_automatic_promotion(self) -> None:
        doc = (REPO_ROOT / "docs" / "evolution-promotion-workflow.md").read_text(encoding="utf-8")
        self.assertIn("Suggestions are useful hints. They are not source of truth.", doc)
        self.assertIn("No automatic promotion.", doc)
        self.assertIn("Do not rollback by deleting score history", doc)


if __name__ == "__main__":
    unittest.main()
