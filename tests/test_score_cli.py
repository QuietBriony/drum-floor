from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from drum_floor.generator import GenerateRequest, generate_candidate
from drum_floor.scoring import ScoreRequest, score_candidate


class ListeningScoreCliChecks(unittest.TestCase):
    def test_score_candidate_writes_metadata_only_score(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            candidate_dir = root / "candidate"
            score_dir = root / "scores"
            generate_candidate(GenerateRequest(
                style="nerdy_jazzy_hiphop",
                frame="deep_neo_soul_pocket",
                bpm=84,
                bars=8,
                energy=55,
                seed=42,
                out=candidate_dir,
            ))

            result = score_candidate(ScoreRequest(
                candidate=candidate_dir,
                target="ableton",
                reviewer="unit-test-gate",
                scores={
                    "pocket": 4,
                    "space": 5,
                    "bass_lock": 4,
                    "ghost_glue": 4,
                    "snare_lag_feel": 4,
                    "fill_naturalness": 3,
                    "mix_weight": 4,
                    "surprise": 3,
                    "repeatability": 4,
                },
                notes={
                    "what_worked": "pocket sits well",
                    "what_failed": "fill can be rarer",
                    "next_hint": "reduce fill pressure",
                },
                out=score_dir,
            ))

            score = json.loads(result.out_path.read_text(encoding="utf-8"))
            self.assertEqual(score["schema"], "drum-floor.evolution.listening-score.v1")
            self.assertEqual(score["candidate"]["frame"], "deep_neo_soul_pocket")
            self.assertEqual(score["listening"]["target"], "ableton")
            self.assertFalse(score["safety"]["stores_audio"])
            self.assertFalse(score["safety"]["stores_samples"])
            self.assertTrue(score["safety"]["metadata_only"])
            self.assertFalse(score["safety"]["auto_promotes_pattern_frame"])
            self.assertFalse(score["safety"]["writes_live_armed"])


if __name__ == "__main__":
    unittest.main()
