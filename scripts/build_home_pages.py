#!/usr/bin/env python3
"""Build the English, German and Japanese home pages from the Korean one.

index.html (Korean) is the source of the home's <main>. For index_en/de/ja.html this script keeps each page's own
<head> (meta, Open Graph, JSON-LD, hreflang), skip link, header and footer, aligns the home's stylesheet and script tags
with the Korean page, and replaces <main> with a translated copy of the Korean one. Edit the Korean page, then run:

    python3 scripts/build_home_pages.py

Any Korean text left in a translated <main> fails the build, so a new Korean string must get a row in TEXT first.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGS = ("en", "de", "ja")

# Korean -> (English, German, Japanese). Matched against whole text nodes and attribute values.
TEXT = {
    "딸깍 서바이벌 보러 가기": ("See 10key Survival", "10key Survival ansehen", "10key Survivalを見る"),
    "신작": ("New game", "Neues Spiel", "新作"),
    "출시 준비 중": ("Coming soon", "Bald verfügbar", "近日配信予定"),
    "딸깍 서바이벌": ("10key Survival", "10key Survival", "10key Survival"),
    "살아 있는 텐키(숫자 키패드)가 되어 끝없는 3D 키보드를 파고 내려가세요. 키를 부수고, 레벨업마다 스킬 카드를 고르고, 마우스에게서 살아남으세요.": (
        "Dig through an endless 3D keyboard as a living numpad. Smash keys, pick a new skill at every level-up and outlast the mouse.",
        "Gräbe dich als lebendiger Ziffernblock durch eine endlose 3D-Tastatur. Zerschlage Tasten, wähle bei jedem Levelaufstieg einen neuen Skill und überlebe die Maus.",
        "生きたテンキとなって、終わりのない3Dキーボードを掘り進もう。キーを壊し、レベルアップごとに新しいスキルを選び、マウスから生き延びよう。"),
    "출시 정보": ("Release facts", "Eckdaten", "リリース情報"),
    "광고 없음": ("No ads", "Keine Werbung", "広告なし"),
    "자세히 보기": ("Learn more", "Mehr erfahren", "詳しく見る"),
    "유료 앱, 앱 내 구매 포함": ("Paid app, includes in-app purchases", "Bezahl-App mit In-App-Käufen", "有料アプリ（アプリ内課金あり）"),
    "딸깍 서바이벌 실제 플레이 영상": ("10key Survival gameplay video", "10key Survival Gameplay-Video", "10key Survivalのプレイ映像"),
    "딸깍 서바이벌 실제 플레이": ("10key Survival gameplay", "10key Survival Gameplay", "10key Survivalのプレイ"),
    "출시 전 빌드의 실제 플레이 화면": ("Gameplay from a pre-release build", "Gameplay aus einer Vorabversion", "リリース前のビルドの実際のプレイ画面"),
    "키를 눌러 보세요": ("Press a key", "Drück eine Taste", "キーを押してみて"),
    "출시작": ("Out now", "Erschienen", "配信中"),
    "버전": ("Version", "Version", "バージョン"),
    "2D 머지에서 3D 비커, 보스전까지. 쿼키와 함께 실험실을 탈출하세요.": (
        "From 2D merge to 3D beakers and boss fights. Escape the lab with Quirky.",
        "Vom 2D-Merge über den 3D-Becher bis zum Bosskampf. Brich mit Quirky aus dem Labor aus.",
        "2Dマージから3Dビーカー、ボス戦まで。Quirkyと一緒に研究所を脱出しよう。"),
    "무료 다운로드, 광고 및 앱 내 구매 포함": ("Free download, ads and in-app purchases", "Kostenlos, mit Werbung und In-App-Käufen", "無料ダウンロード（広告・アプリ内購入あり）"),
    "플레이어들이 함께 연구한 점수": ("Researched by players together", "Gemeinsam von Spielern erforscht", "プレイヤーのみんなで研究したスコア"),
    "점": ("points", "Punkte", "点"),
    "최근 플레이 횟수": ("Recent plays", "Letzte Runden", "最近のプレイ回数"),
    "기록을 불러오는 중…": ("Loading records…", "Aufzeichnungen werden geladen…", "記録を読み込み中…"),
    "다시 시도": ("Retry", "Erneut versuchen", "再試行"),
    "어떤 점수를 더했나요?": ("What goes into this number?", "Wie wird die Zahl berechnet?", "どのスコアを集計していますか？"),
    "클래식·실험실 연구 판의 점수 기록과 지금 모든 플레이어의 쿼키력을 더했어요. 최근 플레이 횟수는 점수가 기록된 판과 실험실 탈출 판의 수예요. 테스트·운영 계정, 관리자가 제외하거나 고친 기록, 계정에 연결되지 않은 기록과 중복은 뺐어요. 서비스 초기 기록 일부는 서버 보관 기간이 지나 이미 지워져 들어 있지 않아요.": (
        "Scores from Classic and Lab Research runs, plus the current Quirky Power of every player. Recent plays counts runs with a recorded score plus Lab escape runs. Test/operator accounts, admin-excluded or corrected records, unlinked records and duplicates are left out. Some early records had already passed the server retention period and are not included.",
        "Punkte aus Classic- und Laborforschung-Runden plus die aktuelle Quirky-Kraft aller Spieler. „Letzte Runden“ zählt Runden mit gespeicherter Punktzahl und Labor-Fluchtrunden. Test-/Betreiberkonten, administrativ ausgeschlossene oder korrigierte Datensätze, Datensätze ohne Kontoverknüpfung und Duplikate sind nicht enthalten. Einige frühe Daten waren bereits über die Speicherfrist hinaus und fehlen.",
        "クラシックと実験室研究のスコア記録に、全プレイヤーの現在のQuirky力を加えています。最近のプレイ回数は、スコアが記録されたプレイと実験室脱出のプレイの数です。テスト・運営アカウント、管理者が除外・修正した記録、アカウント未連携の記録、重複は除外しています。初期の記録の一部はサーバーの保存期間を過ぎて削除済みのため含まれません。"),
    "개발실 기록": ("Lab notes", "Lab Notes", "開発室ノート"),
    "개발실에서 생긴 일": ("Inside the dev room", "Aus dem Entwicklungsraum", "開発室のできごと"),
    "채널에서 모두 보기 ↗": ("View channel ↗", "Zum Kanal ↗", "チャンネルを見る ↗"),
    "고객지원": ("Player support", "Support", "サポート"),
    "막혔나요?": ("Stuck?", "Du kommst nicht weiter?", "困ったときは、"),
    "바로 도와드릴게요.": ("Let’s sort it out.", "Wir helfen dir.", "ここから。"),
    "로그인도, 긴 양식도 없이. 필요한 도움부터 골라주세요.": (
        "No sign-in. No long forms. Start with the help you need.",
        "Ohne Anmeldung. Ohne lange Formulare. Wähle dein Anliegen.",
        "ログインも長いフォームも不要。必要なサポートを選んでください。"),
    "고객지원 열기": ("Get support", "Support öffnen", "サポートを開く"),
    "고객지원 주제": ("Support topics", "Support-Themen", "サポートのトピック"),
    "결제·구매 복원": ("Purchases &amp; restore", "Käufe &amp; Wiederherstellung", "購入・復元"),
    "버그·플레이 문제": ("Bugs &amp; gameplay", "Fehler &amp; Spielablauf", "不具合・プレイ"),
    "계정·진행 데이터": ("Account &amp; progress", "Konto &amp; Fortschritt", "アカウント・進行"),
    "계정 삭제": ("Delete account", "Konto löschen", "アカウント削除"),
    "개인정보·데이터 권리 ↗": ("Privacy &amp; your data ↗", "Datenschutz &amp; deine Rechte ↗", "プライバシー・データの権利 ↗"),
    "Quirky Ball 실제 플레이 영상": ("Quirky Ball gameplay video", "Quirky Ball Gameplay-Video", "Quirky Ballのプレイ映像"),
    "Quirky Ball 2.0 실제 플레이": ("Quirky Ball 2.0 gameplay", "Quirky Ball 2.0 Gameplay", "Quirky Ball 2.0のプレイ"),
    "동무와 멋진신세계 실제 플레이 영상": ("Comrade and the Brave New World gameplay video", "Genosse und die schöne neue Welt – Gameplay-Video",
        "Comrade and the Brave New Worldのプレイ映像"),
    "동무와 멋진신세계 실제 플레이": ("Comrade and the Brave New World gameplay", "Genosse und die schöne neue Welt – Gameplay",
        "Comrade and the Brave New Worldのプレイ"),
    "동무와 멋진신세계": ("Comrade and the Brave New World", "Genosse und die schöne neue Welt", "Comrade and the Brave New World"),
    "다른 장르의 게임에서 만나요": ("See you in a game of another genre", "Wir sehen uns in einem Spiel eines anderen Genres",
                         "別のジャンルのゲームでまた会いましょう"),
}
SUPPORT = {"en": "english", "de": "german", "ja": "japanese"}
YOUTUBE_TITLES = re.compile(r'(<a class="youtube-card"[^>]*>.*?</a>)', re.S)  # video titles stay as published
HANGUL = re.compile(r"[가-힣]")


def tr(text, i):
    core = text.strip()
    if not core:
        return text
    if core not in TEXT:
        return text
    return text.replace(core, TEXT[core][i])


def translate_main(main, lang, badges):
    i = LANGS.index(lang)
    keep = {}

    def stash(m):
        keep[f"\0{len(keep)}\0"] = m.group(1)
        return f"\0{len(keep) - 1}\0"
    main = YOUTUBE_TITLES.sub(stash, main)
    main = re.sub(r">([^<>]+)<", lambda m: ">" + tr(m.group(1), i) + "<", main)
    main = re.sub(r'\b(aria-label|alt|title|data-[a-z-]+)="([^"]*)"', lambda m: f'{m.group(1)}="{tr(m.group(2), i)}"', main)
    main = re.sub(r'<span class="hd-title-alt"[^>]*>[^<]*</span>', "", main)  # the Latin name is already the title
    main = main.replace('href="quirky-ball/?lang=ko"', f'href="quirky-ball/?lang={lang}"')
    main = main.replace('href="10key/"', 'href="10key/index_en.html"')  # the 10key Survival page exists in Korean and English only
    main = main.replace('href="quirky-ball/privacy/delete_ko.html"', f'href="quirky-ball/privacy/delete_{lang}.html"')
    main = main.replace('href="privacy/ko.html"', f'href="privacy/{lang}.html"')
    main = re.sub(r'href="support/#ko-', f'href="support/#{lang}-', main)
    main = main.replace('href="support/"', f'href="support/#{SUPPORT[lang]}"')
    main = main.replace(badges["ko"], badges[lang])
    for k, v in keep.items():
        main = main.replace(k, v)
    left = [line.strip()[:80] for line in YOUTUBE_TITLES.sub("", main).splitlines() if HANGUL.search(line)]
    if left:
        sys.exit(f"{lang}: untranslated Korean in <main>:\n  " + "\n  ".join(left))
    return main


def badge_block(html):
    m = re.search(r'<div class="release-actions"><a class="store-button google-play-badge"[\s\S]*?</a><a class="store-button app-store-badge"[\s\S]*?</a></div>', html)
    return m.group(0) if m else None


def home_tags(ko):
    css = re.findall(r'<link rel="stylesheet" href="assets/home(?:-desk)?\.css[^"]*">', ko)
    js = re.findall(r'<script src="assets/home(?:-desk)?\.js[^"]*" defer></script>', ko)
    return "".join(css), "".join(js)


def align_head(page, css, js):
    """Swap the old home tags (studio-home.*) or earlier home.* tags for the Korean page's current ones."""
    page = re.sub(r'<link rel="stylesheet" href="assets/(?:studio-home|home-desk)\.css[^"]*">', "", page)
    page = re.sub(r'<script src="assets/(?:studio-home|home-desk)\.js[^"]*" defer></script>', "", page)
    page = re.sub(r'<link rel="stylesheet" href="assets/home\.css[^"]*">', "", page)
    page = re.sub(r'<script src="assets/home\.js[^"]*" defer></script>', "", page)
    brand_css = re.search(r'<link rel="stylesheet" href="assets/brand-site\.css[^"]*">', page).group(0)
    brand_js = re.search(r'<script src="assets/brand-site\.js[^"]*" defer></script>', page).group(0)
    page = page.replace(brand_css, brand_css + css, 1).replace(brand_js, brand_js + js, 1)
    return page


def main():
    ko = (ROOT / "index.html").read_text(encoding="utf-8")
    ko_main = ko[ko.index("<main"):ko.index("</main>") + len("</main>")]
    ko_body = re.search(r"<body[^>]*>", ko).group(0)
    badges = {"ko": badge_block(ko_main)}
    stored = json.loads((ROOT / "scripts" / "home_store_badges.json").read_text(encoding="utf-8"))
    for lang in LANGS:
        badges[lang] = stored[lang]
    css, js = home_tags(ko)
    for lang in LANGS:
        path = ROOT / f"index_{lang}.html"
        page = align_head(path.read_text(encoding="utf-8"), css, js)
        page = re.sub(r"<body[^>]*>", ko_body, page, count=1)
        page = page[:page.index("<main")] + translate_main(ko_main, lang, badges) + page[page.index("</main>") + len("</main>"):]
        page = re.sub(r'\s*<nav class="section-rail"[\s\S]*?</nav>', "", page)
        path.write_text(page, encoding="utf-8")
        print("built", path.name)


if __name__ == "__main__":
    main()
