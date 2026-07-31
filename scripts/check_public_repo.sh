#!/usr/bin/env bash
set -euo pipefail

mode="${1:-staged}"
failed=0

if [[ "$mode" == "--all" ]]; then
  file_list_command=(git ls-files)
else
  file_list_command=(git diff --cached --name-only --diff-filter=ACMR)
fi

blocked_path_pattern='(^|/)(\.env($|\.)|credentials?($|[._-])|secrets?($|[._-]))|\.(pem|key|p12|pfx|jks|keystore|apk|aab|db|sqlite|sqlite3|log|bak|zip)$'
secret_pattern='-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----|(^|[^A-Za-z0-9])(sk_live_|sk_test_|gh[pousr]_|AIza[0-9A-Za-z_-]{20,})|service[_-]?role[^A-Za-z0-9]*(key)?[^A-Za-z0-9]*[:=]|(supabase|api|client)[_-]?(secret|key)[^A-Za-z0-9]*[:=]|authorization[^A-Za-z0-9]*:[[:space:]]*bearer[[:space:]]+[A-Za-z0-9._-]+'

while IFS= read -r path; do
  [[ -z "$path" ]] && continue

  if printf '%s\n' "$path" | grep -Eiq -- "$blocked_path_pattern"; then
    printf '차단: 공개 저장소에 민감하거나 불필요한 파일이 포함되었습니다: %s\n' "$path" >&2
    failed=1
    continue
  fi

  case "$path" in
    scripts/check_public_repo.sh|.github/*|SECURITY.md) continue ;;
  esac

  if [[ "$mode" == "--all" ]]; then
    content_command=(cat -- "$path")
  else
    content_command=(git show ":$path")
  fi

  if "${content_command[@]}" 2>/dev/null | LC_ALL=C grep -Eiq -- "$secret_pattern"; then
    printf '차단: 공개 저장소 파일에서 비밀정보로 의심되는 문자열을 찾았습니다: %s\n' "$path" >&2
    failed=1
  fi
done < <("${file_list_command[@]}")

if [[ "$failed" -ne 0 ]]; then
  printf '커밋을 중단했습니다. 실제 비밀정보라면 먼저 폐기·재발급하세요.\n' >&2
  exit 1
fi

printf '공개 사이트 보안 검사 통과\n'
