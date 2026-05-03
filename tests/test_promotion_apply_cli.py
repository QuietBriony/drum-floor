from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from drum_floor.cli import main
from drum_floor.promotion_apply import dry_run_apply_promotion_request
from drum_floor.promotion_plan import FRAMES_PATH


REPO_ROOT = Path(__file__).resolve().parents[1]
EXAMPLE_PATH = REPO_ROOT / "evolution" / "examples" / "promotion-request.example.json"


class PromotionApplyCliChecks(unittest.TestCase):
    def test_dry_run_apply_promotion_preview_does_not_write_pattern_frames(self) -> None:
        before = FRAMES_PATH.read_text(encoding="utf-8")
        result = dry_run_apply_promotion_request(EXAMPLE_PATH)
        after = FRAMES_PATH.read_text(encoding="utf-8")

        self.assertTrue(result.ok, result.errors)
        self.assertEqual(before, after)
        self.assertTrue(result.summary["dry_run"])
        self.assertFalse(result.summary["would_write"])
        self.assertTrue(result.summary["requires_human_pr"])
        self.assertIn("- pocket_director.ghost_glue: 0.86", result.patch_preview)
        self.assertIn("+ pocket_director.ghost_glue: 0.88", result.patch_preview)

    def test_cli_apply_promotion_dry_run_accepts_example(self) -> None:
        self.assertEqual(main(["apply-promotion", str(EXAMPLE_PATH), "--dry-run"]), 0)

    def test_rejects_stale_request_before_patch_preview(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            request_path = Path(temp_dir) / "promotion-request.json"
            data = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
            data["proposed_change"]["from"] = 0.11
            request_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            result = dry_run_apply_promotion_request(request_path)
            self.assertFalse(result.ok)
            self.assertEqual(result.patch_preview, [])
            self.assertTrue(any("stale" in error for error in result.errors))


if __name__ == "__main__":
    unittest.main()
