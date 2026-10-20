#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
failed=0
# Legal documents are English (main) + Korean + German (owner 2026-10-20: German back, GDPR); ja URLs redirect
# to English. 10KEY has no German terms: German pages link its English terms.
locales=(ko en de)
dropped_locales=(ja)

if ! command -v rg >/dev/null 2>&1; then
  rg() { grep -ER "$@"; }
fi

for locale in "${locales[@]}"; do
  privacy="$repo_dir/privacy/$locale.html"
  terms="$repo_dir/quirky-ball/terms/$locale.html"
  deletion="$repo_dir/quirky-ball/privacy/delete_$locale.html"

  for path in "$privacy" "$terms" "$deletion"; do
    if [[ ! -s "$path" ]]; then
      printf 'Missing policy page: %s\n' "$path" >&2
      failed=1
    fi
  done

  if ! rg -q '28' "$privacy" || ! rg -q 'support@houseduck\.in' "$privacy"; then
    printf 'Privacy page misses retention or contact: %s\n' "$privacy" >&2
    failed=1
  fi
  if ! rg -q '28' "$terms" || ! rg -q 'support@houseduck\.in' "$terms"; then
    printf 'Terms page misses retention or contact: %s\n' "$terms" >&2
    failed=1
  fi
  if ! rg -q '28' "$deletion" || ! rg -q 'support@houseduck\.in' "$deletion"; then
    printf 'Deletion page misses retention or contact: %s\n' "$deletion" >&2
    failed=1
  fi
  if ! rg -q 'iOS' "$privacy" || ! rg -q 'iOS' "$terms"; then
    printf 'Policy pages miss iOS availability: %s / %s\n' "$privacy" "$terms" >&2
    failed=1
  fi

  case "$locale" in
    ko) product_term='스타터 패키지'; rights_term='정당한 환불 요청' ;;
    en) product_term='Starter Package'; rights_term='legitimate refund request' ;;
    de) product_term='Starter-Paket'; rights_term='berechtigter Erstattungsantrag' ;;
  esac
  if ! rg -q "$product_term" "$terms" || ! rg -qi 'yakwon' "$terms" || ! rg -q "$rights_term" "$terms"; then
    printf 'Terms page misses current product or lawful-refund protection: %s\n' "$terms" >&2
    failed=1
  fi

  if ! rg -qi 'Apple|애플|アップル' "$privacy" || ! rg -qi 'StoreKit|Google Play Billing' "$privacy"; then
    printf 'Privacy page misses Apple sign-in or store purchase processing: %s\n' "$privacy" >&2
    failed=1
  fi

  case "$locale" in
    ko) analytics_term='자체 이용 분석'; social_term='친구' ;;
    en) analytics_term='First-party usage analytics'; social_term='Friend' ;;
    de) analytics_term='Eigene Nutzungsanalyse'; social_term='Freund' ;;
  esac
  if ! rg -qi "$analytics_term" "$privacy" || ! rg -q "$social_term" "$privacy"; then
    printf 'Privacy page misses current analytics or social data disclosure: %s\n' "$privacy" >&2
    failed=1
  fi

  privacy_redirect="$repo_dir/quirky-ball/privacy/$locale.html"
  terms_redirect="$repo_dir/terms/$locale.html"
  if ! rg -q "/privacy/$locale\.html" "$privacy_redirect"; then
    printf 'Legacy privacy route is not linked to canonical page: %s\n' "$privacy_redirect" >&2
    failed=1
  fi
  if ! rg -q "quirky-ball/terms/$locale\.html" "$terms_redirect"; then
    printf 'Legacy terms route is not linked to canonical page: %s\n' "$terms_redirect" >&2
    failed=1
  fi

  # 10KEY: section 13 of the shared policy, its own Terms, and the /10key/privacy/ route (index.html is the full English
  # policy opened at section 13 that moves ko / de browsers to that section of their language).
  tenkey_locale="$locale"
  [[ "$locale" == de ]] && tenkey_locale=en
  tenkey_terms="$repo_dir/10key/terms/$tenkey_locale.html"
  tenkey_redirect="$repo_dir/10key/privacy/$locale.html"
  [[ "$locale" == de ]] && tenkey_redirect="$repo_dir/10key/privacy/index.html"
  if [[ ! -s "$tenkey_terms" ]]; then
    printf 'Missing 10KEY terms page: %s\n' "$tenkey_terms" >&2
    failed=1
  else
    for token in 'support@houseduck\.in' 'CrazyGames' 'Google Play' 'App Store' 'Steam' '327r' "/privacy/$tenkey_locale\.html#section-13" 'datetime="2026-10-19"'; do
      if ! rg -q "$token" "$tenkey_terms"; then
        printf '10KEY terms page misses %s: %s\n' "$token" "$tenkey_terms" >&2
        failed=1
      fi
    done
    if rg -n -i 'AdMob|AppLovin|Firebase|Starter|yakwon|약원|Remove Ads|광고 제거|Sign in with Apple|Apple로 로그인|\bgems?\b|젬|season pass|시즌패스|subscription|구독' "$tenkey_terms"; then
      printf '10KEY terms page contains Quirky-Ball-only or removed wording: %s\n' "$tenkey_terms" >&2
      failed=1
    fi
  fi
  if ! rg -q 'id="section-13">13\. 10KEY</h2>' "$privacy" || ! rg -q "/10key/terms/$tenkey_locale\.html" "$privacy"; then
    printf 'Privacy page misses the 10KEY section or its terms link: %s\n' "$privacy" >&2
    failed=1
  fi
  tenkey_section="$(sed -n '/id="section-13">13\. 10KEY/,/id="section-14"/p' "$privacy")"
  for token in 'eu-west-1' 'CrazyGames' 'Google Play' 'Steam' '12' '35' '90' '183' 'support@houseduck\.in'; do
    if ! printf '%s' "$tenkey_section" | grep -Eq "$token"; then
      printf 'Privacy 10KEY section misses %s: %s\n' "$token" "$privacy" >&2
      failed=1
    fi
  done
  if printf '%s' "$tenkey_section" | grep -Eiq 'AdMob|Firebase|AppLovin|Sign in with Apple|Apple로 로그인'; then
    printf 'Privacy 10KEY section names a Quirky-Ball-only SDK or sign-in: %s\n' "$privacy" >&2
    failed=1
  fi
  if ! rg -q "(url=|replace\(\")/privacy/$locale\.html(#section-13|\" \+ \(location\.hash \|\| \"#section-13\"\))" "$tenkey_redirect"; then
    printf '10KEY privacy route is not linked to the shared policy: %s\n' "$tenkey_redirect" >&2
    failed=1
  fi
  if ! rg -q "\.\./10key/terms/$tenkey_locale\.html" "$terms_redirect"; then
    printf 'Terms selector does not offer 10KEY: %s\n' "$terms_redirect" >&2
    failed=1
  fi
done

for locale in "${dropped_locales[@]}"; do
  for pair in "privacy/$locale.html=/privacy/en.html" "quirky-ball/privacy/$locale.html=/privacy/en.html" \
    "terms/$locale.html=/terms/en.html" "quirky-ball/terms/$locale.html=/quirky-ball/terms/en.html" \
    "quirky-ball/privacy/delete_$locale.html=/quirky-ball/privacy/delete_en.html"; do
    page="$repo_dir/${pair%%=*}"
    target="${pair#*=}"
    if [[ ! -s "$page" ]] || ! rg -q "content=\"0;url=$target\"" "$page" || rg -q 'data-legal-content' "$page"; then
      printf 'Dropped-language legal URL must be only a redirect to %s: %s\n' "$target" "$page" >&2
      failed=1
    fi
  done
done

if rg -n -i 'season pass|premium pass|시즌패스|프리미엄 패스|Saisonpass|Premium-Pass|シーズンパス|プレミアムパス|subscription|구독|Abonnement|サブスクリプション' "$repo_dir/quirky-ball/terms" "$repo_dir/privacy"; then
  printf 'Policy contains removed season-pass or subscription wording.\n' >&2
  failed=1
fi

if rg -n -i 'iOS version is planned|iOS 버전은 향후|iOS-Version ist geplant|iOS版は今後|no in-app purchases|인앱 구매는 제공하지|keine In-App-Käufe|アプリ内購入は提供して' "$repo_dir/quirky-ball/terms" "$repo_dir/privacy"; then
  printf 'Policy contains obsolete planned-iOS or no-IAP wording.\n' >&2
  failed=1
fi

if rg -n -i '회사나 사업자가 아닌|not a company or business entity|kein Unternehmen oder Gewerbebetrieb|会社や事業者ではなく' "$repo_dir/privacy" "$repo_dir/quirky-ball/terms"; then
  printf 'Canonical policy contains obsolete operator wording.\n' >&2
  failed=1
fi

if rg -n '7일이 지나면|after 7 days even without|automatisch nach 7 Tagen|7日経過後' "$repo_dir/quirky-ball/privacy"; then
  printf 'Deletion page contains obsolete seven-day retention wording.\n' >&2
  failed=1
fi

if rg -n '별도의 분석\(애널리틱스\) SDK도 사용하지 않습니다|does not use a separate analytics SDK|ein separates Analyse-SDK wird nicht verwendet|独立した分析.*SDKも使用していません' "$repo_dir/privacy"; then
  printf 'Canonical privacy policy contains obsolete analytics wording.\n' >&2
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

printf 'Quirky Ball and 10KEY policy content check passed (en + ko + de; ja redirects to en).\n'
