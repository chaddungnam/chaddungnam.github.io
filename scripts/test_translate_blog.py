import importlib.util
import json
import pathlib
import tempfile
import unittest


SCRIPT_PATH = pathlib.Path(__file__).with_name("translate_blog.py")


class BlogTranslationTest(unittest.TestCase):
    def test_updates_only_changed_posts_and_preserves_html(self):
        self.assertTrue(SCRIPT_PATH.exists(), "translate_blog.py must exist")
        spec = importlib.util.spec_from_file_location("translate_blog", SCRIPT_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        source = {
            "posts": [{
                "slug": "first-post",
                "source_hash": "new-hash",
                "title": "첫 기록",
                "summary": "첫 요약",
                "body_html": "<p>안녕 <strong>하우스덕</strong></p>",
            }]
        }
        existing = {
            "posts": {
                "unchanged": {
                    "source_hash": "same-hash",
                    "en": {"title": "keep", "summary": "keep", "body_html": "<p>keep</p>"},
                }
            }
        }
        calls = []

        def translate(text, target):
            calls.append((text, target))
            return f"{target}:{text}"

        result = module.update_cache(source, existing, translate)
        self.assertIn("unchanged", result["posts"])
        translated = result["posts"]["first-post"]
        self.assertEqual(translated["source_hash"], "new-hash")
        self.assertEqual(translated["en"]["title"], "en:첫 기록")
        self.assertEqual(
            translated["en"]["body_html"],
            "<p>en:안녕 <strong>en:하우스덕</strong></p>",
        )
        self.assertEqual({target for _, target in calls}, {"en", "de", "ja"})

    def test_writes_cache_atomically(self):
        self.assertTrue(SCRIPT_PATH.exists(), "translate_blog.py must exist")
        spec = importlib.util.spec_from_file_location("translate_blog_atomic", SCRIPT_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        with tempfile.TemporaryDirectory() as directory:
            output = pathlib.Path(directory) / "translations.json"
            module.write_json_atomic(output, {"posts": {"one": {"source_hash": "hash"}}})
            self.assertEqual(json.loads(output.read_text()), {"posts": {"one": {"source_hash": "hash"}}})

    def test_skips_model_startup_when_every_translation_is_current(self):
        self.assertTrue(SCRIPT_PATH.exists(), "translate_blog.py must exist")
        spec = importlib.util.spec_from_file_location("translate_blog_skip", SCRIPT_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        source = {"posts": [{"slug": "one", "source_hash": "same"}]}
        existing = {"posts": {"one": {
            "source_hash": "same",
            "en": {"title": "x"},
            "de": {"title": "x"},
            "ja": {"title": "x"},
        }}}
        self.assertFalse(module.needs_translation(source, existing))
        existing["posts"]["one"].pop("de")
        self.assertTrue(module.needs_translation(source, existing))


if __name__ == "__main__":
    unittest.main()
