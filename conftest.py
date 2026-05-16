"""pytest path setup for the drum-floor test suite.

This environment runs Python with ``sys.flags.safe_path`` enabled, so the
current working directory is not added to ``sys.path`` automatically. Without
this, ``tests/test_*.py`` cannot ``import drum_floor`` and pytest reports
collection errors. Adding the repo root (absolute) here keeps ``python -m
pytest tests/`` runnable directly, which is what ``stack-check`` relies on.
"""

import os
import sys

_ROOT = os.path.dirname(os.path.abspath(__file__))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
