from __future__ import annotations

import json
import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def read_text(path: str) -> str:
    return (REPO_ROOT / path).read_text(encoding="utf-8")


class PwaStaticContractChecks(unittest.TestCase):
    def test_manifest_has_stable_install_identity(self) -> None:
        manifest = json.loads(read_text("manifest.webmanifest"))
        self.assertEqual(manifest["id"], "./")
        self.assertEqual(manifest["start_url"], "./")
        self.assertEqual(manifest["scope"], "./")
        self.assertEqual(manifest["display"], "standalone")
        self.assertIn("standalone", manifest["display_override"])

        icon_paths = [icon["src"] for icon in manifest["icons"]]
        self.assertIn("icons/icon-192.png", icon_paths)
        self.assertIn("icons/icon-512-maskable.png", icon_paths)
        for icon_path in icon_paths:
            self.assertTrue((REPO_ROOT / icon_path).is_file(), icon_path)

    def test_html_sw_and_precache_versions_match(self) -> None:
        html = read_text("index.html")
        sw = read_text("sw.js")
        self.assertIn('href="manifest.webmanifest"', html)
        self.assertIn('navigator.serviceWorker.register("./sw.js")', html)
        self.assertIn("style.css?v=pwa-3", html)
        self.assertIn("app.js?v=pwa-3", html)
        self.assertIn('const CACHE_PREFIX = "drum-floor-pwa"', sw)
        self.assertIn('const VERSION = `${CACHE_PREFIX}-v3`', sw)
        self.assertIn('"style.css?v=pwa-3"', sw)
        self.assertIn('"app.js?v=pwa-3"', sw)

    def test_precache_targets_exist(self) -> None:
        sw = read_text("sw.js")
        block_match = re.search(r"const PRECACHE_URLS = \[(.*?)\];", sw, re.S)
        self.assertIsNotNone(block_match)
        urls = re.findall(r'"([^"]+)"', block_match.group(1))
        for url in urls:
            if url == "./":
                continue
            path = url.split("?", 1)[0]
            self.assertTrue((REPO_ROOT / path).is_file(), url)

    def test_lifecycle_guard_stops_audio_before_background(self) -> None:
        app = read_text("app.js")
        self.assertIn("quietForPageLifecycle", app)
        self.assertIn('window.addEventListener("pagehide"', app)
        self.assertIn('document.addEventListener("visibilitychange"', app)
        self.assertIn('document.addEventListener("freeze"', app)
        self.assertIn("audioEngine.panic()", app)
        self.assertIn("audioInput.stop()", app)


if __name__ == "__main__":
    unittest.main()
