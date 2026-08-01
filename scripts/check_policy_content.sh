#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
failed=0
locales=(ko en de ja)

for locale in "${locales[@]}"; do
  privacy="$repo_dir/quirky-ball/privacy/$locale.html"
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

  privacy_redirect="$repo_dir/privacy/$locale.html"
  terms_redirect="$repo_dir/terms/$locale.html"
  if ! rg -q "quirky-ball/privacy/$locale\.html" "$privacy_redirect"; then
    printf 'Legacy privacy route is not linked to canonical page: %s\n' "$privacy_redirect" >&2
    failed=1
  fi
  if ! rg -q "quirky-ball/terms/$locale\.html" "$terms_redirect"; then
    printf 'Legacy terms route is not linked to canonical page: %s\n' "$terms_redirect" >&2
    failed=1
  fi
done

if rg -n -i '회사나 사업자가 아닌|not a company or business entity|kein Unternehmen oder Gewerbebetrieb|会社や事業者ではなく' "$repo_dir/quirky-ball/privacy" "$repo_dir/quirky-ball/terms"; then
  printf 'Canonical policy contains obsolete operator wording.\n' >&2
  failed=1
fi

if rg -n '7일이 지나면|after 7 days even without|automatisch nach 7 Tagen|7日経過後' "$repo_dir/quirky-ball/privacy"; then
  printf 'Deletion page contains obsolete seven-day retention wording.\n' >&2
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

printf 'Quirky Ball policy content check passed.\n'
