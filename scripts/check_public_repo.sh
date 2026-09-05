#!/usr/bin/env bash
set -euo pipefail

mode="${1:-staged}"
failed=0

if [[ "$mode" == "--all" ]]; then
  file_list_command=(git ls-files)
else
  file_list_command=(git diff --cached --name-only --diff-filter=ACMR)
fi

blocked_path_pattern='(^|/)(\.env($|\.)|credentials?($|[._-])|secrets?($|[._-]))|\.(pem|key|p12|pfx|jks|keystore|apk|aab|db|sqlite|sqlite3|log|bak)$'
secret_pattern='-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----|(^|[^A-Za-z0-9])(sk_live_|sk_test_|gh[pousr]_|AIza[0-9A-Za-z_-]{20,})|service[_-]?role[^A-Za-z0-9]*(key)?[^A-Za-z0-9]*[:=]|(supabase|api|client)[_-]?(secret|key)[^A-Za-z0-9]*[:=]|authorization[^A-Za-z0-9]*:[[:space:]]*bearer[[:space:]]+[A-Za-z0-9._-]+'

while IFS= read -r path; do
  [[ -z "$path" ]] && continue

  case "$path" in
    scripts/check_public_repo.sh|.github/*|SECURITY.md) continue ;;
  esac

  if [[ "$path" == *.zip ]]; then
    case "$path" in
      play/quirky-ball/index.pck.zip) expected_hash='c67501f533d1b83be8530b1c93a588971c212d90c5aaaf623a54141df75357e7' ;;
      play/quirky-ball/index.wasm.zip) expected_hash='29b5bea06061f80658986bc07185d3b69c6ae6e1487ffa95c325632a4f818a0e' ;;
      *)
        printf '차단: 공개 저장소에 민감하거나 불필요한 파일이 포함되었습니다: %s\n' "$path" >&2
        failed=1
        continue
        ;;
    esac

    if [[ "$mode" == "--all" ]]; then
      actual_hash="$(shasum -a 256 -- "$path" | awk '{print $1}')"
    else
      actual_hash="$(git show ":$path" | shasum -a 256 | awk '{print $1}')"
    fi
    if [[ "$actual_hash" != "$expected_hash" ]]; then
      printf '차단: 승인된 ZIP 스냅샷 해시가 일치하지 않습니다: %s\n' "$path" >&2
      failed=1
    fi
    continue
  fi

  if [[ "$path" != ".env.example" ]] && printf '%s\n' "$path" | grep -Eiq -- "$blocked_path_pattern"; then
    printf '차단: 공개 저장소에 민감하거나 불필요한 파일이 포함되었습니다: %s\n' "$path" >&2
    failed=1
    continue
  fi

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
