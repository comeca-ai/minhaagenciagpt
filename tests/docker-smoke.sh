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
cp -R "$JHONEME_ROOT/public" "$JHONEME_ROOT/deploy" "$JHONEME_ROOT/server" "$test_dir/"
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
[[ "$(curl -sS -o /dev/null -w '%{http_code}' "$base/")" == 302 ]] || fail 'Acesso sem sessão não foi bloqueado.'
[[ "$(curl -sS -o /dev/null -w '%{http_code}' "$base/login")" == 200 ]] || fail 'Porta de entrada indisponível.'
[[ "$(curl -sS -o /dev/null -w '%{http_code}' "$base/api/workspace")" == 401 ]] || fail 'API sem sessão não foi bloqueada.'
[[ "$(curl -sS -H "Origin: $base" -H 'Content-Type: application/json' --data '{"username":"tester","password":"wrong"}' -o /dev/null -w '%{http_code}' "$base/api/login")" == 401 ]] || fail 'Senha incorreta não foi bloqueada.'
printf '{"username":"tester","password":"%s"}' "$test_password" > "$test_dir/login.json"
[[ "$(curl -sS -H "Origin: $base" -H 'Content-Type: application/json' --data-binary "@$test_dir/login.json" -c "$test_dir/cookies" -o /dev/null -w '%{http_code}' "$base/api/login")" == 200 ]] || fail 'Login falhou.'
for path in / /app.js /server-sync.js /intake.js /voice.js /studio.js /quality.js /styles.css /assets/marina.png; do
  [[ "$(curl -sS -b "$test_dir/cookies" -o /dev/null -w '%{http_code}' "$base$path")" == 200 ]] || fail "Falha ao servir $path."
done
[[ "$(curl -sS -b "$test_dir/cookies" -o /dev/null -w '%{http_code}' "$base/arquivo-inexistente")" == 404 ]] || fail 'Arquivo inexistente não retornou 404.'
curl -sS -b "$test_dir/cookies" -D "$test_dir/headers" "$base/" > "$test_dir/page"
grep -qi 'content-security-policy:' "$test_dir/headers" || fail 'CSP ausente.'
grep -qi 'microphone=(self)' "$test_dir/headers" || fail 'Microfone bloqueado pela política do servidor.'
grep -qi 'cache-control: no-store' "$test_dir/headers" || fail 'Controle de cache ausente.'
grep -qi 'Jhoneme' "$test_dir/page" || fail 'Página inesperada.'
cat > "$test_dir/state.json" <<'JSON'
{"expectedRevision":0,"state":{"schema":1,"areas":[],"agents":[],"steps":[],"adjustments":[],"history":[],"studio":{"version":1,"people":[],"projects":[],"meetings":[],"tasks":[]}}}
JSON
[[ "$(curl -sS -b "$test_dir/cookies" -H "Origin: $base" -H 'Content-Type: application/json' -X PUT --data-binary "@$test_dir/state.json" -o /dev/null -w '%{http_code}' "$base/api/workspace")" == 200 ]] || fail 'Banco não gravou.'
[[ "$(curl -sS -b "$test_dir/cookies" -H "Origin: $base" -H 'Content-Type: application/json' -X PUT --data-binary "@$test_dir/state.json" -o /dev/null -w '%{http_code}' "$base/api/workspace")" == 409 ]] || fail 'Conflito não foi detectado.'
compose up -d --force-recreate studio
wait_healthy
curl -fsS -b "$test_dir/cookies" "$base/api/workspace" > "$test_dir/persisted.json"
grep -q '"revision":1' "$test_dir/persisted.json" || fail 'Banco ou sessão perdido ao recriar container.'
compose run --rm --no-deps -T --entrypoint node studio /app/backup.mjs > "$test_dir/workspace.json"
compose run --rm --no-deps -T --entrypoint node studio /app/restore.mjs < "$test_dir/workspace.json"
[[ "$(curl -sS -b "$test_dir/cookies" -H "Origin: $base" -H 'Content-Type: application/json' --data '{}' -o /dev/null -w '%{http_code}' "$base/api/logout")" == 200 ]] || fail 'Logout falhou.'
[[ "$(curl -sS -b "$test_dir/cookies" -o /dev/null -w '%{http_code}' "$base/api/workspace")" == 401 ]] || fail 'Sessão não foi revogada.'
note 'OK: login, sessão, proteção da API, banco persistente, conflitos, backup, restauração, assets e cabeçalhos.'
