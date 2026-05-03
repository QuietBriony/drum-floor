from __future__ import annotations

import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = REPO_ROOT / "evolution" / "schema" / "listening-score.schema.json"
EXAMPLE_PATH = REPO_ROOT / "evolution" / "examples" / "deep-pocket-score.example.json"


class EvolutionContractChecks(unittest.TestCase):
    def test_schema_and_example_parse(self) -> None:
        schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        example = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
        self.assertEqual(schema["title"], "drum-floor listening score")
        self.assertEqual(example["schema"], "drum-floor.evolution.listening-score.v1")

    def test_score_axes_are_complete(self) -> None:
        example = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
        expected_axes = {
            "pocket",
            "space",
            "bass_lock",
            "ghost_glue",
            "snare_lag_feel",
            "fill_naturalness",
            "mix_weight",
            "surprise",
            "repeatability",
        }
        self.assertEqual(set(example["scores"]), expected_axes)
        for score in example["scores"].values():
            self.assertGreaterEqual(score, 1)
            self.assertLessEqual(score, 5)

    def test_safety_flags_prevent_automatic_promotion(self) -> None:
        example = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
        safety = example["safety"]
        self.assertFalse(safety["stores_audio"])
        self.assertFalse(safety["stores_samples"])
        self.assertTrue(safety["metadata_only"])
        self.assertFalse(safety["auto_promotes_pattern_frame"])
        self.assertFalse(safety["writes_live_armed"])

    def test_docs_state_human_gate(self) -> None:
        loop_doc = (REPO_ROOT / "docs" / "evolution-pocket-director-loop.md").read_text(encoding="utf-8")
        self.assertIn("Human-gated evolution loop", loop_doc)
        self.assertIn("Do not auto-overwrite `patterns/drum-pattern-frames.json`", loop_doc)
        self.assertIn("Do not write to `live/armed/`", loop_doc)


if __name__ == "__main__":
    unittest.main()
