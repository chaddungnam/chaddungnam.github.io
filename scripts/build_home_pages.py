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
    "딸깍 서바이벌": ("10key Survival", "10key Survival", "10key Survival"),
    "자세히 보기": ("Learn more", "Mehr erfahren", "詳しく見る"),
    "10key Survival 로고와 3D 키보드 위의 텐키, 마우스": (
        "10key Survival logo with the tenkey and the mouse on a 3D keyboard",
        "10key-Survival-Logo mit dem Tenkey und der Maus auf einer 3D-Tastatur",
        "10key Survivalのロゴと、3Dキーボードの上のテンキとマウス"),
    "출시 준비 중": ("Coming soon", "Bald verfügbar", "近日配信予定"),
    "화려한 모험, 그리고 ASMR": ("A dazzling adventure, and ASMR", "Ein funkelndes Abenteuer – und ASMR", "華やかな冒険、そしてASMR"),
    "부수는 키마다 실제로 녹음한 키보드 소리가 딸깍, 와장창 울려요. 살아 있는 텐키가 되어 끝없는 3D 키보드를 파고 내려가세요.": (
        "Every key you break clicks, clacks and shatters with real recorded keyboard sounds. Dig through an endless 3D keyboard as a living numpad.",
        "Jede Taste, die du zerschlägst, klickt, klackert und zerspringt mit echten aufgenommenen Tastaturgeräuschen. Grabe dich als lebendiger Ziffernblock durch eine endlose 3D-Tastatur.",
        "壊すキーのひとつひとつから、実際に録音したキーボードの音がカチッ、ガシャンと響きます。生きたテンキとなって、終わりのない3Dキーボードを掘り進もう。"),
    "사전예약하기": ("Pre-register", "Vorregistrieren", "事前登録する"),
    "출시 날 iOS·Android 다운로드 링크를 메일 한 통으로 보내 드려요.": (
        "On launch day we send you one email with the iOS and Android download link.",
        "Am Starttag schicken wir dir eine E-Mail mit dem Download-Link für iOS und Android.",
        "配信日に、iOS・Androidのダウンロードリンクをメールで1通お送りします。"),
    "itch.io에서 미리 플레이해보기": ("Play the free preview on itch.io", "Kostenlose Vorschau auf itch.io spielen", "itch.ioで無料体験版をプレイ"),
    "출시 전 무료 미리보기예요. 설치·가입 없이 브라우저에서 바로 시작돼요.": (
        "Free before launch, right in your browser. No download, no sign-up.",
        "Kostenlos vor dem Start, direkt im Browser. Ohne Download, ohne Anmeldung.",
        "配信前の無料体験版です。インストールも登録も不要で、ブラウザですぐ始まります。"),
    "실제 플레이 화면": ("Real gameplay", "Echtes Gameplay", "実際のプレイ画面"),
    "키를 부수며 파고드는 화면, 레벨업 카드 고르기, 황금 피버": (
        "Digging through keys, picking a level-up card, Golden Fever",
        "Tasten durchgraben, eine Karte beim Levelaufstieg wählen, Golden Fever",
        "キーを壊して掘り進む画面、レベルアップのカード選択、ゴールデンフィーバー"),
    "파고들기": ("Dig", "Graben", "掘る"),
    "방향을 누르고 있으면 키를 부수며 내려가요. 레벨업마다 카드 세 장 중 하나를 골라요.": (
        "Hold a direction to smash your way down. Every level-up, pick 1 of 3 cards.",
        "Halte eine Richtung gedrückt und brich dich nach unten durch. Bei jedem Levelaufstieg wählst du eine von drei Karten.",
        "方向を押し続けると、キーを壊しながら掘り進みます。レベルアップごとに3枚のカードから1枚を選びます。"),
    "마우스의 돌진, 내려찍는 스페이스바, NUM LOCK 철창": (
        "The mouse charging, the spacebar slamming down, a NUM LOCK cage",
        "Die Maus stürmt los, die Leertaste schlägt ein, ein NUM-LOCK-Käfig",
        "突進するマウス、叩きつけるスペースキー、NUM LOCKの檻"),
    "살아남기": ("Survive", "Überleben", "生き残る"),
    "레벨 7부터 마우스가, 레벨 14부터 스페이스바가 쫓아와요. 계속 움직이세요.": (
        "The mouse hunts you from level 7, the spacebar from level 14. Keep moving.",
        "Ab Level 7 jagt dich die Maus, ab Level 14 auch die Leertaste. Bleib in Bewegung.",
        "レベル7からはマウスが、レベル14からはスペースキーが追ってきます。止まらずに動き続けよう。"),
    "드리프트 키보드와 로봇으로 변신한 텐키": (
        "The tenkey as a drifting keyboard and as a robot",
        "Der Tenkey als driftende Tastatur und als Roboter",
        "ドリフトキーボードとロボットに変身したテンキ"),
    "진화하기": ("Evolve", "Verwandeln", "進化する"),
    "드리프트 카드로 키보드가 되고, 변신 카드로 로봇이 될 수 있어요.": (
        "A DRIFT card can turn you into a drifting keyboard, a TRANSFORM card into a robot.",
        "Mit der Karte DRIFT wirst du zur driftenden Tastatur, mit der Karte VERWANDLUNG zum Roboter.",
        "ドリフトのカードでキーボードに、変身のカードでロボットになれます。"),
    "딸깍 서바이벌 스크린샷": ("10key Survival screenshots", "10key Survival Screenshots", "10key Survivalのスクリーンショット"),
    "키보드를 부수며 파고들기": ("Smash the keyboard and dig down", "Die Tastatur zerschlagen und nach unten graben", "キーボードを壊して掘り進む"),
    "마우스 돌진 피하기": ("Dodge the mouse's charge", "Dem Ansturm der Maus ausweichen", "マウスの突進をよける"),
    "레벨업 카드 고르기": ("Level up: pick a card", "Levelaufstieg: eine Karte wählen", "レベルアップ：カードを選ぶ"),
    "코드를 입력해 NUM LOCK 철창에서 탈출": (
        "Type the code to escape the NUM LOCK cage", "Den Code eingeben und aus dem NUM-LOCK-Käfig ausbrechen", "コードを入力してNUM LOCKの檻から脱出"),
    "황금 피버: 점수 2배": ("Golden Fever: double score", "Golden Fever: doppelte Punkte", "ゴールデンフィーバー：スコア2倍"),
    "iOS·Android 앱 출시 준비 중: 유료 앱, 앱 내 구매 포함. 확률형 아이템(모듈 뽑기) 포함: 모듈 12종, 각 8.333%(1/12).": (
        "iOS and Android apps coming soon: paid apps with in-app purchases. Includes random items (module draws): 12 modules, 8.333% (1/12) each.",
        "iOS- und Android-Apps bald verfügbar: Bezahl-Apps mit In-App-Käufen. Enthält Zufallsobjekte (Modulziehung): 12 Module, je 8,333 % (1/12).",
        "iOS・Android版は近日配信予定（有料アプリ・アプリ内課金あり）。確率型アイテム（モジュールの抽選）を含みます：モジュール12種、各8.333%（1/12）。"),
    "확률 정보": ("Odds", "Wahrscheinlichkeiten (auf Englisch)", "確率情報（英語）"),
    "딸깍 서바이벌 실제 플레이": ("10key Survival gameplay", "10key Survival Gameplay", "10key Survivalのプレイ"),
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
    main = main.replace('href="10key/#prereg"', 'href="10key/index_en.html#prereg"')  # the pre-registration form, English page
    main = main.replace('href="10key/odds/"', 'href="10key/odds/#en"')  # one page, Korean then English
    main = re.sub(r'(assets/media/tenkey-itch/shot-[a-z]+)-ko\.webp', rf'\1-{lang}.webp', main)  # the store screenshots exist per language
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
