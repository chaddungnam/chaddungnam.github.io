import importlib.util
import pathlib
from types import SimpleNamespace


SCRIPT_PATH = pathlib.Path(__file__).with_name("translate_blog.py")
SPEC = importlib.util.spec_from_file_location("translate_blog_regressions", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


calls = []


def contextual_translate(text, target):
    calls.append((text, target))
    return text.replace("첫 게임 ", "First game ").replace(" 개발", " development")


# Regression: Tistory split one sentence across span/b tags, so the old pipeline
# translated fragments without context and renamed Quirky Ball to “Ball licking”.
translated = MODULE.translate_html(
    "<p><span>첫 게임 </span><b><span>쿼키볼</span></b><span> 개발</span></p>",
    "en",
    contextual_translate,
)
assert translated == "<p>First game Quirky Ball development</p>"
assert len(calls) == 1
assert calls[0][1] == "en"
assert "쿼키볼" not in calls[0][0]


def argos_like_translate(text, _target):
    """Reproduce Argos 1.11's destructive rewrite of the old sentinel."""
    return text.replace("__HD_TERM_0__", "HD TERM 0")


for locale in MODULE.TARGETS:
    try:
        protected_result = MODULE.translate_text_preserving_terms(
            "Release Quirky Ball soon", locale, argos_like_translate
        )
    except ValueError as error:
        protected_result = str(error)
    assert protected_result == "Release Quirky Ball soon"


assert hasattr(MODULE, "installed_translation_pairs")
ko = SimpleNamespace(code="ko")
en = SimpleNamespace(code="en")
translation = SimpleNamespace(from_lang=ko, to_lang=en)
language = SimpleNamespace(translations_to=[translation])
assert MODULE.installed_translation_pairs([language]) == {("ko", "en")}

source = {
    "translation_version": MODULE.TRANSLATION_PIPELINE_VERSION,
    "posts": [{"slug": "one", "source_hash": "same"}],
}
old_cache = {"posts": {"one": {
    "source_hash": "same",
    "en": {"title": "x"},
    "de": {"title": "x"},
    "ja": {"title": "x"},
}}}
assert MODULE.needs_translation(source, old_cache), "old pipeline cache must be regenerated"


def destructive_brand_translate(text, _target):
    return text.replace("Quirky Ball", "Ball licking")


protected_cache = MODULE.update_cache(
    {
        "translation_version": MODULE.TRANSLATION_PIPELINE_VERSION,
        "posts": [{
            "slug": "brand",
            "source_hash": "brand-hash",
            "title": "Quirky Ball launch",
            "summary": "Building Quirky Ball",
            "body_html": "<p>Quirky Ball</p>",
        }],
    },
    {"posts": {}},
    destructive_brand_translate,
)
for locale in MODULE.TARGETS:
    assert protected_cache["posts"]["brand"][locale]["title"] == "Quirky Ball launch"
    assert protected_cache["posts"]["brand"][locale]["summary"] == "Building Quirky Ball"

print("blog translation regressions: PASS")
