#!/usr/bin/env python3
"""Offline House Duck blog translation cache builder."""

from __future__ import annotations

import argparse
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import tempfile


TARGETS = ("en", "de", "ja")
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
SKIP_TEXT_TAGS = {"code", "pre", "script", "style"}


class TranslatingHTMLParser(HTMLParser):
    def __init__(self, translate_text):
        super().__init__(convert_charrefs=False)
        self.translate_text = translate_text
        self.output = []
        self.stack = []

    def handle_starttag(self, tag, attrs):
        attributes = "".join(
            f' {name}="{html.escape(value, quote=True)}"' if value is not None else f" {name}"
            for name, value in attrs
        )
        self.output.append(f"<{tag}{attributes}>")
        if tag not in VOID_TAGS:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        attributes = "".join(
            f' {name}="{html.escape(value, quote=True)}"' if value is not None else f" {name}"
            for name, value in attrs
        )
        self.output.append(f"<{tag}{attributes}>")

    def handle_endtag(self, tag):
        self.output.append(f"</{tag}>")
        if tag in self.stack:
            reverse_index = self.stack[::-1].index(tag)
            del self.stack[len(self.stack) - reverse_index - 1 :]

    def handle_data(self, data):
        if not data.strip() or any(tag in SKIP_TEXT_TAGS for tag in self.stack):
            self.output.append(data)
            return
        prefix = data[: len(data) - len(data.lstrip())]
        suffix = data[len(data.rstrip()) :]
        self.output.append(prefix + self.translate_text(data.strip()) + suffix)

    def handle_entityref(self, name):
        self.output.append(f"&{name};")

    def handle_charref(self, name):
        self.output.append(f"&#{name};")

    def handle_comment(self, data):
        self.output.append(f"<!--{data}-->")

    def get_html(self):
        return "".join(self.output)


def translate_html(source_html, target, translate):
    parser = TranslatingHTMLParser(lambda text: translate(text, target))
    parser.feed(source_html)
    parser.close()
    return parser.get_html()


def update_cache(source, existing, translate):
    cache = {"posts": dict(existing.get("posts", {}))}
    for post in source.get("posts", []):
        slug = post["slug"]
        current = cache["posts"].get(slug, {})
        if current.get("source_hash") == post["source_hash"] and all(current.get(locale) for locale in TARGETS):
            continue
        translated = {"source_hash": post["source_hash"]}
        for locale in TARGETS:
            translated[locale] = {
                "title": translate(post["title"], locale),
                "summary": translate(post["summary"], locale),
                "body_html": translate_html(post["body_html"], locale, translate),
            }
        cache["posts"][slug] = translated
    return cache


def write_json_atomic(path, value):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=target.name, suffix=".tmp", dir=target.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary_name, target)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def argos_translator():
    from argostranslate import package, translate

    required_pairs = (("ko", "en"), ("en", "de"), ("en", "ja"))
    installed_pairs = {
        (source.code, target.code)
        for source in translate.get_installed_languages()
        for target in source.translations_to
    }
    missing = [pair for pair in required_pairs if pair not in installed_pairs]
    if missing:
        package.update_package_index()
        available = package.get_available_packages()
        for source_code, target_code in missing:
            candidate = next(
                item for item in available
                if item.from_code == source_code and item.to_code == target_code
            )
            package.install_from_path(candidate.download())

    translators = {
        locale: translate.get_translation_from_codes("ko", locale)
        for locale in TARGETS
    }
    if any(value is None for value in translators.values()):
        raise RuntimeError("Argos translation graph is incomplete")
    return lambda text, locale: translators[locale].translate(text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    source = json.loads(Path(args.input).read_text(encoding="utf-8"))
    output = Path(args.output)
    existing = json.loads(output.read_text(encoding="utf-8")) if output.exists() else {"posts": {}}
    updated = update_cache(source, existing, argos_translator())
    write_json_atomic(output, updated)
    print(f"translated cache: {len(updated['posts'])} post(s)")


if __name__ == "__main__":
    main()
