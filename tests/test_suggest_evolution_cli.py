from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from drum_floor.generator import GenerateRequest, generate_candidate
from drum_floor.scoring import ScoreRequest, score_candidate
from drum_floor.suggestions import SuggestionRequest, suggest_evolution


class EvolutionSuggestionCliChecks(unittest.TestCase):
    def test_suggest_evolution_writes_metadata_only_suggestion(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            candidate_dir = root / "candidate"
            scores_dir = root / "scores"
            suggestions_dir = root / "suggestions"
            generate_candidate(GenerateRequest(
                style="nerdy_jazzy_hiphop",
                frame="deep_neo_soul_pocket",
                bpm=84,
                bars=8,
                energy=55,
                seed=42,
                out=candidate_dir,
            ))
            score_candidate(ScoreRequest(
                candidate=candidate_dir,
                target="ableton",
                reviewer="unit-test-gate",
                scores={
                    "pocket": 4,
                    "space": 5,
                    "bass_lock": 4,
                    "ghost_glue": 4,
                    "snare_lag_feel": 4,
                    "fill_naturalness": 2,
                    "mix_weight": 4,
                    "surprise": 3,
                    "repeatability": 4,
                },
                notes={
                    "what_worked": "space works",
                    "what_failed": "fill is too eager",
                    "next_hint": "make fills rarer",
                },
                out=scores_dir,
            ))

            result = suggest_evolution(SuggestionRequest(
                scores_dir=scores_dir,
                out=suggestions_dir,
                frame="deep_neo_soul_pocket",
                agent="unit-test-pocket-director",
            ))
            suggestion = json.loads(result.out_path.read_text(encoding="utf-8"))
            self.assertEqual(suggestion["schema"], "drum-floor.evolution.suggestion.v1")
            self.assertEqual(suggestion["target"]["frame"], "deep_neo_soul_pocket")
            self.assertEqual(suggestion["source"]["score_count"], 1)
            self.assertIn("reduce fill frequency", suggestion["suggestion"]["fill_policy_hint"])
            self.assertFalse(suggestion["safety"]["stores_audio"])
            self.assertFalse(suggestion["safety"]["stores_samples"])
            self.assertTrue(suggestion["safety"]["metadata_only"])
            self.assertFalse(suggestion["safety"]["auto_promotes_pattern_frame"])
            self.assertFalse(suggestion["safety"]["writes_live_armed"])
            self.assertTrue(suggestion["safety"]["requires_human_promotion"])


if __name__ == "__main__":
    unittest.main()
