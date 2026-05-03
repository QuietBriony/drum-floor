from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from drum_floor.generator import GenerateRequest, NOTE_MAP, generate_candidate
from drum_floor.inspector import inspect_candidate


REPO_ROOT = Path(__file__).resolve().parents[1]


class LiveCandidateChecks(unittest.TestCase):
    def test_note_map_is_group_a_safe_except_documented_crash(self) -> None:
        group_a = range(36, 48)
        outside_group_a = {part: note for part, note in NOTE_MAP.items() if note not in group_a}
        self.assertEqual(outside_group_a, {"crash": 49})

        ep133_doc = (REPO_ROOT / "docs" / "ep133-midi-map.md").read_text(encoding="utf-8")
        self.assertIn("`crash=49` is intentionally cross-group", ep133_doc)
        self.assertIn("remap `crash=49`", ep133_doc)

    def test_generate_inspect_and_no_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            out = Path(temp_dir) / "candidate"
            request = GenerateRequest(
                style="nerdy_jazzy_hiphop",
                frame="deep_neo_soul_pocket",
                bpm=84,
                bars=8,
                energy=55,
                seed=42,
                out=out,
            )

            result = generate_candidate(request)
            self.assertTrue((out / "pattern.json").is_file())
            self.assertTrue((out / "drums.mid").is_file())
            self.assertTrue((out / "preview.txt").is_file())
            self.assertTrue((out / "meta.json").is_file())
            self.assertEqual(result.frame_id, "deep_neo_soul_pocket")

            inspection = inspect_candidate(out)
            self.assertTrue(inspection.ok, inspection.errors)
            self.assertEqual(inspection.summary["frame"], "deep_neo_soul_pocket")

            with self.assertRaises(FileExistsError):
                generate_candidate(request)


if __name__ == "__main__":
    unittest.main()
