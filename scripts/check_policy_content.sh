#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
failed=0
locales=(ko en de ja)

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

  if ! rg -qi 'Apple|애플|アップル' "$privacy" || ! rg -qi 'StoreKit|Google Play Billing' "$privacy"; then
    printf 'Privacy page misses Apple sign-in or store purchase processing: %s\n' "$privacy" >&2
    failed=1
  fi

  case "$locale" in
    ko) analytics_term='자체 이용 분석'; social_term='친구' ;;
    en) analytics_term='First-party usage analytics'; social_term='Friend' ;;
    de) analytics_term='Eigene Nutzungsanalyse'; social_term='Freund' ;;
    ja) analytics_term='自社利用分析'; social_term='フレンド' ;;
  esac
  if ! rg -q "$analytics_term" "$privacy" || ! rg -q "$social_term" "$privacy"; then
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

printf 'Quirky Ball policy content check passed.\n'
