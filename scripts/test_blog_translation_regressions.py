import importlib.util
import pathlib


script = pathlib.Path(__file__).with_name("translate_blog.py")
spec = importlib.util.spec_from_file_location("translate_blog_regressions", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

source = {
    "title": "Quirky Ball 개발기",
    "summary": "Godot으로 만든 House Duck의 Project K 기록",
    "body_html": '<p><span>첫 게임 </span><b><span>쿼키볼</span></b><span> 개발</span></p>',
}
translated = {
    "title": "Building Quirky Ball",
    "summary": "House Duck's Project K log, built with Godot",
    "body_html": '<p><span>My first game </span><b><span>Quirky Ball</span></b><span> development log</span></p>',
}
module.validate_translation(source, translated)

for broken in (
    {**translated, "title": "Building Ball licking"},
    {**translated, "body_html": translated["body_html"].replace("Quirky Ball", "Ball licking")},
):
    try:
        module.validate_translation(source, broken)
    except ValueError:
        pass
    else:
        raise AssertionError("brand-name corruption must fail validation")

print("blog translation regressions: PASS")
