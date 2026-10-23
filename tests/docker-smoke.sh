#!/usr/bin/env bash
# Real integration check. Requires Docker Engine, Compose and curl.
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)/scripts/common.sh"
require_docker
command -v curl >/dev/null || fail 'Instale curl para executar o teste.'
test_port="${JHONEME_TEST_PORT:-18080}"
valid_port "$test_port" || fail 'JHONEME_TEST_PORT inválida.'
test_dir="$(mktemp -d)"
test_project="jhoneme-smoke-$$"
test_image="jhoneme-studio:smoke-$$"
cleanup() {
  if [[ -f "$test_dir/.env" ]]; then compose down -v --remove-orphans >/dev/null 2>&1 || true; fi
  docker image rm "$test_image" >/dev/null 2>&1 || true
  rm -rf -- "$test_dir"
}
trap cleanup EXIT
cp -R "$JHONEME_ROOT/dist" "$JHONEME_ROOT/deploy" "$test_dir/"
cp "$JHONEME_ROOT/Dockerfile" "$JHONEME_ROOT/.dockerignore" "$JHONEME_ROOT/compose.yaml" "$JHONEME_ROOT/compose.local.yaml" "$test_dir/"
docker pull caddy:2-alpine
test_password='Jhoneme-smoke-password'
test_hash="$(printf '%s\n' "$test_password" | docker run --rm -i --entrypoint caddy caddy:2-alpine hash-password --algorithm bcrypt)"
valid_hash "$test_hash" || fail 'Falha ao gerar hash.'
umask 077
cat > "$test_dir/.env" <<ENV
COMPOSE_PROJECT_NAME='$test_project'
JHONEME_MODE='local'
JHONEME_SITE_ADDRESS='http://:8080'
JHONEME_LOCAL_PORT='$test_port'
JHONEME_ADMIN_USER='tester'
JHONEME_PASSWORD_HASH='$test_hash'
ENV
printf 'services:\n  studio:\n    image: %s\n' "$test_image" > "$test_dir/compose.test.yaml"
JHONEME_ROOT="$test_dir"
JHONEME_ENV_FILE="$test_dir/.env"
configure_compose
JHONEME_COMPOSE_FILES+=(-f "$test_dir/compose.test.yaml")
compose build --pull
compose run --rm --no-deps --entrypoint caddy studio validate --config /etc/caddy/Caddyfile --adapter caddyfile
start_studio
base="http://127.0.0.1:$test_port"
[[ "$(curl -sS -o /dev/null -w '%{http_code}' "$base/")" == 401 ]] || fail 'Acesso sem senha não foi bloqueado.'
[[ "$(curl -sS -u tester:wrong -o /dev/null -w '%{http_code}' "$base/")" == 401 ]] || fail 'Senha incorreta não foi bloqueada.'
for path in / /app.js /studio.js /quality.js /styles.css /assets/marina.png; do
  [[ "$(curl -sS -u "tester:$test_password" -o /dev/null -w '%{http_code}' "$base$path")" == 200 ]] || fail "Falha ao servir $path."
done
[[ "$(curl -sS -u "tester:$test_password" -o /dev/null -w '%{http_code}' "$base/arquivo-inexistente")" == 404 ]] || fail 'Arquivo inexistente não retornou 404.'
curl -sS -u "tester:$test_password" -D "$test_dir/headers" "$base/" > "$test_dir/page"
grep -qi 'content-security-policy:' "$test_dir/headers" || fail 'CSP ausente.'
grep -qi 'cache-control: no-store' "$test_dir/headers" || fail 'Controle de cache ausente.'
grep -qi 'Jhoneme' "$test_dir/page" || fail 'Página inesperada.'
note 'OK: container saudável, senha obrigatória, assets disponíveis e cabeçalhos presentes.'
