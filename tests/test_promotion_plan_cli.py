from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from drum_floor.cli import main
from drum_floor.promotion_plan import plan_promotion_request


REPO_ROOT = Path(__file__).resolve().parents[1]
EXAMPLE_PATH = REPO_ROOT / "evolution" / "examples" / "promotion-request.example.json"


class PromotionPlanCliChecks(unittest.TestCase):
    def test_example_promotion_request_plans_current_frame_change(self) -> None:
        result = plan_promotion_request(EXAMPLE_PATH)
        self.assertTrue(result.ok, result.errors)
        self.assertEqual(result.summary["pattern_frame"], "deep_neo_soul_pocket")
        self.assertEqual(result.summary["target_field"], "pocket_director.ghost_glue")
        self.assertEqual(result.summary["current_value"], 0.86)
        self.assertEqual(result.summary["proposed_to"], 0.88)
        self.assertFalse(result.summary["would_write"])
        self.assertTrue(result.summary["requires_human_pr"])

    def test_cli_plan_promotion_accepts_example(self) -> None:
        self.assertEqual(main(["plan-promotion", str(EXAMPLE_PATH)]), 0)

    def test_rejects_stale_previous_value(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            request_path = Path(temp_dir) / "promotion-request.json"
            data = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
            data["proposed_change"]["from"] = 0.11
            request_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            result = plan_promotion_request(request_path)
            self.assertFalse(result.ok)
            self.assertTrue(any("stale" in error for error in result.errors))

    def test_rejects_missing_target_field(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            request_path = Path(temp_dir) / "promotion-request.json"
            data = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
            data["target"]["field"] = "pocket_director.nope"
            request_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            result = plan_promotion_request(request_path)
            self.assertFalse(result.ok)
            self.assertTrue(any("target field not found" in error for error in result.errors))


if __name__ == "__main__":
    unittest.main()
