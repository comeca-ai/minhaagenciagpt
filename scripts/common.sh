#!/usr/bin/env bash
# Shared by the install and maintenance commands. Never source the .env file.
set -Eeuo pipefail
JHONEME_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
JHONEME_ENV_FILE="$JHONEME_ROOT/.env"
fail() { printf 'Erro: %s\n' "$*" >&2; exit 1; }
note() { printf '%s\n' "$*"; }

read_setting() {
  local key="$1" line value
  [[ -f "$JHONEME_ENV_FILE" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "$key="* ]]; then
      value="${line#*=}"
      if [[ "$value" == \"*\" || "$value" == \'*\' ]]; then value="${value:1:${#value}-2}"; fi
      printf '%s' "$value"
      return 0
    fi
  done < "$JHONEME_ENV_FILE"
}
valid_user() { [[ "$1" =~ ^[A-Za-z0-9_.-]{1,40}$ ]]; }
valid_port() { [[ "$1" =~ ^[1-9][0-9]{0,4}$ ]] && (( 10#$1 <= 65535 )); }
valid_domain() {
  [[ ${#1} -le 253 && "$1" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$ ]]
}
valid_email() { [[ "$1" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$ ]]; }
valid_hash() { [[ "$1" =~ ^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$ ]]; }

require_docker() {
  command -v docker >/dev/null || fail 'Docker não encontrado. Use sudo bash install.sh --install-docker ou instale o Docker Engine.'
  docker info >/dev/null 2>&1 || fail 'Não foi possível acessar o Docker. Inicie o serviço e execute este comando com sudo ou com acesso ao Docker.'
  docker compose version >/dev/null 2>&1 || fail 'Instale o plugin Docker Compose: https://docs.docker.com/compose/install/linux/'
}

configure_compose() {
  [[ -f "$JHONEME_ENV_FILE" ]] || fail 'Execute bash install.sh antes.'
  local mode user hash address
  mode="$(read_setting JHONEME_MODE)"
  user="$(read_setting JHONEME_ADMIN_USER)"
  hash="$(read_setting JHONEME_PASSWORD_HASH)"
  address="$(read_setting JHONEME_SITE_ADDRESS)"
  valid_user "$user" || fail 'Usuário inválido no .env.'
  valid_hash "$hash" || fail 'Hash de senha inválido no .env.'
  case "$mode" in
    local)
      [[ "$address" == 'http://:8080' ]] || fail 'Endereço local inválido.'
      valid_port "$(read_setting JHONEME_LOCAL_PORT)" || fail 'Porta local inválida.'
      ;;
    https)
      valid_domain "$address" || fail 'Domínio inválido no .env.'
      valid_email "$(read_setting JHONEME_ACME_EMAIL)" || fail 'E-mail inválido no .env.'
      ;;
    *) fail 'Modo inválido no .env. Use local ou https.' ;;
  esac
  JHONEME_COMPOSE_FILES=(-f "$JHONEME_ROOT/compose.yaml" -f "$JHONEME_ROOT/compose.$mode.yaml")
}

compose() {
  # Shell variables must not silently override the installed configuration.
  env -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES \
    -u JHONEME_SITE_ADDRESS -u JHONEME_ACME_EMAIL -u JHONEME_ADMIN_USER \
    -u JHONEME_PASSWORD_HASH -u JHONEME_MODE -u JHONEME_LOCAL_PORT -u CADDY_IMAGE \
    docker compose --project-directory "$JHONEME_ROOT" --env-file "$JHONEME_ENV_FILE" \
    "${JHONEME_COMPOSE_FILES[@]}" "$@"
}

wait_healthy() {
  local id health attempt
  id="$(compose ps -q studio)"
  [[ -n "$id" ]] || fail 'O container não foi criado. Veja: sudo bash manage.sh logs'
  for ((attempt=0; attempt<45; attempt++)); do
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    case "$health" in
      healthy) return 0 ;;
      unhealthy|exited|dead) break ;;
    esac
    sleep 2
  done
  fail 'O container não ficou saudável em 90 segundos. Veja: sudo bash manage.sh logs'
}

start_studio() {
  compose config --quiet
  compose up -d --remove-orphans
  wait_healthy
}
show_address() {
  if [[ "$(read_setting JHONEME_MODE)" == https ]]; then
    note "Estúdio iniciado. Endereço configurado: https://$(read_setting JHONEME_SITE_ADDRESS)"
    note 'A emissão do HTTPS depende do DNS e da liberação das portas 80/443; pode levar alguns minutos.'
  else
    local port
    port="$(read_setting JHONEME_LOCAL_PORT)"
    note "Estúdio iniciado em http://127.0.0.1:$port (somente acesso local)."
    note "No seu computador, crie um túnel: ssh -L $port:127.0.0.1:$port usuario@IP_DA_VPS"
    note "Depois abra http://localhost:$port no navegador."
  fi
  note "Usuário de acesso: $(read_setting JHONEME_ADMIN_USER)"
}
