#!/usr/bin/env bash
set -Eeuo pipefail
# Secrets typed at the prompt must never be traced by bash -x.
set +x
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/scripts/common.sh"
usage() {
  cat <<'HELP'
Instalação da Jhoneme

  sudo bash install.sh --domain agencia.exemplo.com --email voce@exemplo.com
  sudo bash install.sh --local --port 8080

Opções:
  --install-docker       Instala Docker CE + Compose em Ubuntu/Debian, se ausentes.
  --domain DOMINIO       Domínio para HTTPS automático; sem https://, porta ou caminho.
  --email EMAIL          Contato para emissão dos certificados (modo domínio).
  --local               Acesso em 127.0.0.1 por túnel SSH (padrão).
  --port PORTA          Porta local (padrão 8080; não se aplica ao modo domínio).
  --user USUARIO        Usuário de acesso (padrão diretor).
  --password-file PATH  Ler a senha de arquivo, em vez do prompt oculto.
  --help                Mostrar ajuda.

Uma instalação existente é reutilizada sem sobrescrever domínio ou credenciais.
Para manutenção: sudo bash manage.sh help
HELP
}
mode=local domain='' email='admin@localhost' port=8080 admin_user=diretor
install_docker=0 password_file='' config_supplied=0 mode_supplied=''
while (($#)); do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --install-docker) install_docker=1; shift ;;
    --local)
      [[ -z "$mode_supplied" || "$mode_supplied" == local ]] || fail 'Escolha --local ou --domain.'
      mode_supplied=local; mode=local; config_supplied=1; shift ;;
    --domain|--email|--port|--user|--password-file)
      (($#>=2)) && [[ -n "$2" && "$2" != --* ]] || fail "Falta o valor de $1."
      case "$1" in
        --domain)
          [[ -z "$mode_supplied" || "$mode_supplied" == https ]] || fail 'Escolha --local ou --domain.'
          mode_supplied=https; mode=https; domain="${2,,}" ;;
        --email) email="$2" ;;
        --port) port="$2" ;;
        --user) admin_user="$2" ;;
        --password-file) password_file="$2" ;;
      esac
      config_supplied=1; shift 2 ;;
    *) fail "Opção desconhecida: $1. Use --help." ;;
  esac
done
[[ -f "$JHONEME_ROOT/dist/index.html" && -f "$JHONEME_ROOT/deploy/Caddyfile" ]] || fail 'Pacote incompleto. Extraia todo o ZIP antes de instalar.'
if [[ ! -f "$JHONEME_ENV_FILE" ]]; then
  valid_user "$admin_user" || fail 'Use um nome de usuário de até 40 letras, números, ponto, hífen ou sublinhado.'
  valid_port "$port" || fail 'A porta deve estar entre 1 e 65535.'
  if [[ "$mode" == https ]]; then
    valid_domain "$domain" || fail 'Informe um domínio válido, sem https://, porta ou caminho.'
    valid_email "$email" && [[ "$email" != admin@localhost ]] || fail 'Informe --email para o HTTPS.'
    [[ "$port" == 8080 ]] || fail '--port é exclusivo do modo local. HTTPS usa 80/443.'
  fi
  [[ -z "$password_file" || -r "$password_file" ]] || fail 'Não foi possível ler o arquivo da senha.'
fi
if ! command -v docker >/dev/null && ((install_docker)); then
  bash "$JHONEME_ROOT/scripts/install-docker.sh"
fi
require_docker
umask 077
if [[ -f "$JHONEME_ENV_FILE" ]]; then
  if ((config_supplied)); then
    fail 'Já existe uma configuração. Execute install.sh sem opções para reutilizá-la; use manage.sh password para trocar a senha. Nenhum dado foi alterado.'
  fi
  note 'Reutilizando domínio e credenciais existentes.'
else
  # Serialize first installation so two invocations cannot replace each other's credentials.
  mkdir "$JHONEME_ROOT/.install-lock" 2>/dev/null || fail 'Outra instalação está em andamento. Se foi interrompida, remova .install-lock e tente novamente.'
  env_tmp=''
  cleanup_install() { [[ -z "$env_tmp" ]] || rm -f -- "$env_tmp"; rmdir "$JHONEME_ROOT/.install-lock" 2>/dev/null || true; }
  trap cleanup_install EXIT
  [[ ! -f "$JHONEME_ENV_FILE" ]] || fail 'A configuração foi criada por outra execução. Rode novamente sem opções.'
  if [[ -n "$password_file" ]]; then
    password="$(cat -- "$password_file")"
  elif [[ -t 0 ]]; then
    read -r -s -p "Senha para $admin_user (12 a 72 bytes): " password
    printf '\n'
    read -r -s -p 'Repita a senha: ' password_confirm
    printf '\n'
    [[ "$password" == "$password_confirm" ]] || fail 'As senhas não coincidem.'
    unset password_confirm
  else
    fail 'Sem terminal interativo. Informe --password-file com um arquivo protegido contendo a senha.'
  fi
  password_size="$(LC_ALL=C printf '%s' "$password" | wc -c)"
  ((password_size>=12 && password_size<=72)) || fail 'Use uma senha entre 12 e 72 bytes.'
  [[ "$password" != *$'\n'* && "$password" != *$'\r'* ]] || fail 'A senha deve ter uma única linha.'
  note 'Preparando a imagem oficial do servidor e protegendo a senha...'
  docker pull caddy:2-alpine
  password_hash="$(printf '%s' "$password" | docker run --rm -i --entrypoint caddy caddy:2-alpine hash-password --algorithm bcrypt)"
  unset password
  valid_hash "$password_hash" || fail 'O servidor não retornou um hash bcrypt válido. A instalação foi interrompida.'
  site_address='http://:8080'
  [[ "$mode" != https ]] || site_address="$domain"
  env_tmp="$(mktemp "$JHONEME_ROOT/.env.tmp.XXXXXX")"
  {
    printf "COMPOSE_PROJECT_NAME='jhoneme'\nJHONEME_MODE='%s'\n" "$mode"
    printf "JHONEME_SITE_ADDRESS='%s'\nJHONEME_ACME_EMAIL='%s'\n" "$site_address" "$email"
    printf "JHONEME_LOCAL_PORT='%s'\nJHONEME_ADMIN_USER='%s'\n" "$port" "$admin_user"
    printf "JHONEME_PASSWORD_HASH='%s'\nCADDY_IMAGE='caddy:2-alpine'\n" "$password_hash"
  } > "$env_tmp"
  unset password_hash
  chmod 600 "$env_tmp"
  mv -- "$env_tmp" "$JHONEME_ENV_FILE"
  env_tmp=''
fi
configure_compose
compose config --quiet
compose build --pull
compose run --rm --no-deps --entrypoint caddy studio validate --config /etc/caddy/Caddyfile --adapter caddyfile
start_studio
show_address
note 'Backup dos briefings: no aplicativo, abra Histórico & dados → Exportar backup.'
