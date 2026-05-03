from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from drum_floor.cli import main
from drum_floor.promotion import validate_promotion_request


REPO_ROOT = Path(__file__).resolve().parents[1]
EXAMPLE_PATH = REPO_ROOT / "evolution" / "examples" / "promotion-request.example.json"


class PromotionValidationCliChecks(unittest.TestCase):
    def test_example_promotion_request_validates_with_missing_source_warnings(self) -> None:
        result = validate_promotion_request(EXAMPLE_PATH)
        self.assertTrue(result.ok, result.errors)
        self.assertEqual(result.summary["pattern_frame"], "deep_neo_soul_pocket")
        self.assertEqual(result.summary["target_field"], "pocket_director.ghost_glue")
        self.assertGreaterEqual(len(result.warnings), 1)

    def test_cli_validate_promotion_accepts_example(self) -> None:
        self.assertEqual(main(["validate-promotion", str(EXAMPLE_PATH)]), 0)

    def test_cli_require_sources_rejects_missing_example_sources(self) -> None:
        self.assertEqual(main(["validate-promotion", str(EXAMPLE_PATH), "--require-sources"]), 1)

    def test_rejects_unsafe_safety_flags(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            request_path = Path(temp_dir) / "promotion-request.json"
            data = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
            data["safety"]["auto_promotes_pattern_frame"] = True
            request_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            result = validate_promotion_request(request_path)
            self.assertFalse(result.ok)
            self.assertIn("safety.auto_promotes_pattern_frame must be false", result.errors)

    def test_rejects_forbidden_source_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            request_path = Path(temp_dir) / "promotion-request.json"
            data = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
            data["source"]["score_files"] = ["live/armed/score.json"]
            request_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            result = validate_promotion_request(request_path)
            self.assertFalse(result.ok)
            self.assertTrue(any("forbidden path" in error for error in result.errors))


if __name__ == "__main__":
    unittest.main()
