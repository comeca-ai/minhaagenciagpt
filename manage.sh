#!/usr/bin/env bash
set -Eeuo pipefail
set +x
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/scripts/common.sh"
usage() {
  cat <<'HELP'
Manutenção da Jhoneme — execute na pasta do pacote:

  sudo bash manage.sh start       Iniciar e verificar o container.
  sudo bash manage.sh stop        Parar, preservando configuração e certificados.
  sudo bash manage.sh restart     Recriar com as configurações atuais.
  sudo bash manage.sh status      Mostrar estado e endereço.
  sudo bash manage.sh logs        Acompanhar logs (Ctrl+C para sair).
  sudo bash manage.sh update      Fazer backup e reconstruir o código local.
  sudo bash manage.sh rollback    Voltar à imagem anterior à última atualização.
  sudo bash manage.sh backup      Salvar código, configuração e certificados.
  sudo bash manage.sh password    Trocar a senha pelo prompt oculto.
  sudo bash manage.sh password --password-file /caminho/senha.txt
  sudo bash manage.sh restore-certificates /caminho/certificates.tar.gz

O backup da VPS NÃO contém briefings ou perfis salvos no navegador.
Exporte esses dados pelo aplicativo em Histórico & dados.
HELP
}
action="${1:-help}"
[[ $# -eq 0 ]] || shift
case "$action" in help|--help|-h) usage; exit 0 ;; esac
case "$action" in start|stop|restart|status|logs|update|rollback|backup|password|restore-certificates) ;; *) fail 'Comando desconhecido. Use manage.sh help.' ;; esac
require_docker
configure_compose
umask 077

backup_studio() (
  local temp archive timestamp
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$JHONEME_ROOT/backups"
  chmod 700 "$JHONEME_ROOT/backups"
  temp="$(mktemp -d "$JHONEME_ROOT/backups/.partial.XXXXXX")"
  trap 'rm -rf -- "$temp"' EXIT
  archive="$JHONEME_ROOT/backups/jhoneme-$timestamp-$$.tar.gz"
  tar -czf "$temp/application.tar.gz" -C "$JHONEME_ROOT" \
    .env .env.example Dockerfile .dockerignore compose.yaml compose.local.yaml \
    compose.https.yaml install.sh manage.sh README.md INSTALAR-VPS.md PROMPTS.md deploy scripts dist tests
  # Snapshot only Caddy storage. No browser workspace data lives in these volumes.
  compose run --rm --no-deps -T --entrypoint tar studio -czf - -C / data config > "$temp/certificates.tar.gz"
  printf '%s\n' \
    'Backup Jhoneme: application.tar.gz contém código e configuração.' \
    'certificates.tar.gz contém os volumes de certificados do Caddy.' \
    'Contém hashes de acesso e chaves TLS. Mantenha este arquivo privado.' \
    'NÃO inclui dados do localStorage: exporte o backup JSON dentro do aplicativo.' \
    'Restauração: siga INSTALAR-VPS.md na pasta da aplicação.' > "$temp/META.txt"
  tar -czf "$archive" -C "$temp" application.tar.gz certificates.tar.gz META.txt
  chmod 600 "$archive"
  note "Backup criado: $archive"
)

case "$action" in
  start)
    (($#==0)) || fail 'start não aceita argumentos.'
    start_studio; show_address ;;
  stop)
    (($#==0)) || fail 'stop não aceita argumentos.'
    compose stop studio
    note 'Estúdio parado. Os volumes e a configuração foram preservados.' ;;
  restart)
    (($#==0)) || fail 'restart não aceita argumentos.'
    compose config --quiet
    compose up -d --force-recreate studio
    wait_healthy; show_address ;;
  status)
    (($#==0)) || fail 'status não aceita argumentos.'
    compose ps
    if [[ "$(read_setting JHONEME_MODE)" == https ]]; then
      note "Endereço configurado: https://$(read_setting JHONEME_SITE_ADDRESS)"
    else
      note "Endereço local configurado: http://127.0.0.1:$(read_setting JHONEME_LOCAL_PORT)"
    fi ;;
  logs)
    (($#==0)) || fail 'logs não aceita argumentos.'
    compose logs -f --tail=100 studio ;;
  backup)
    (($#==0)) || fail 'backup não aceita argumentos.'
    backup_studio ;;
  update)
    (($#==0)) || fail 'update não aceita argumentos. Copie os novos arquivos para a pasta antes.'
    backup_studio
    id="$(compose ps -q studio)"
    if [[ -n "$id" ]]; then
      previous_image="$(docker inspect --format '{{.Image}}' "$id")"
      docker image tag "$previous_image" jhoneme-studio:previous
    fi
    compose build --pull
    compose run --rm --no-deps --entrypoint caddy studio validate --config /etc/caddy/Caddyfile --adapter caddyfile
    start_studio
    show_address
    note 'Atualização concluída. Para reverter a imagem: sudo bash manage.sh rollback' ;;
  rollback)
    (($#==0)) || fail 'rollback não aceita argumentos.'
    docker image inspect jhoneme-studio:previous >/dev/null 2>&1 || fail 'Não existe uma imagem anterior. Restaure um backup.'
    docker image tag jhoneme-studio:previous jhoneme-studio:local
    compose up -d --force-recreate studio
    wait_healthy
    note 'Imagem anterior restaurada. Configuração e dados locais do navegador não foram alterados.' ;;
  password)
    password_file=''
    if (($#)); then
      [[ $# -eq 2 && "$1" == --password-file ]] || fail 'Use password [--password-file ARQUIVO].'
      password_file="$2"
    fi
    if [[ -n "$password_file" ]]; then
      [[ -r "$password_file" ]] || fail 'Arquivo de senha não encontrado.'
      password="$(cat -- "$password_file")"
    elif [[ -t 0 ]]; then
      read -r -s -p 'Nova senha (12 a 72 bytes): ' password; printf '\n'
      read -r -s -p 'Repita a senha: ' confirmation; printf '\n'
      [[ "$password" == "$confirmation" ]] || fail 'As senhas não coincidem.'
      unset confirmation
    else
      fail 'Use um terminal interativo ou --password-file.'
    fi
    size="$(LC_ALL=C printf '%s' "$password" | wc -c)"
    ((size>=12 && size<=72)) || fail 'A senha deve ter de 12 a 72 bytes.'
    [[ "$password" != *$'\n'* && "$password" != *$'\r'* ]] || fail 'A senha deve ter uma única linha.'
    new_hash="$(printf '%s\n' "$password" | compose run --rm --no-deps -T --entrypoint caddy studio hash-password --algorithm bcrypt)"
    unset password
    valid_hash "$new_hash" || fail 'Não foi possível gerar um hash válido.'
    temp_env="$(mktemp "$JHONEME_ROOT/.env.tmp.XXXXXX")"
    trap 'rm -f -- "$temp_env"' EXIT
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "$line" == JHONEME_PASSWORD_HASH=* ]]; then
        printf "JHONEME_PASSWORD_HASH='%s'\n" "$new_hash"
      else
        printf '%s\n' "$line"
      fi
    done < "$JHONEME_ENV_FILE" > "$temp_env"
    chmod 600 "$temp_env"
    cp -p -- "$JHONEME_ENV_FILE" "$JHONEME_ROOT/.env.previous"
    mv -- "$temp_env" "$JHONEME_ENV_FILE"
    unset new_hash
    configure_compose
    compose up -d --force-recreate studio
    wait_healthy
    note 'Senha alterada. O navegador pode pedir as credenciais novamente.' ;;
  restore-certificates)
    [[ $# -eq 1 && -f "$1" ]] || fail 'Informe certificates.tar.gz extraído de um backup da Jhoneme.'
    certificate_archive="$(cd -- "$(dirname -- "$1")" && pwd)/$(basename -- "$1")"
    tar -tzf "$certificate_archive" >/dev/null || fail 'Arquivo de certificados inválido.'
    while IFS= read -r member; do
      [[ "$member" == data/ || "$member" == data/* || "$member" == config/ || "$member" == config/* ]] || fail 'O arquivo contém caminhos fora dos volumes esperados.'
      [[ ! "$member" =~ (^|/)\.\.(/|$) ]] || fail 'O arquivo contém um caminho inválido.'
    done < <(tar -tzf "$certificate_archive")
    compose stop studio
    compose build
    compose run --rm --no-deps -T --entrypoint tar studio -xzf - -C / < "$certificate_archive"
    note 'Certificados restaurados. Para iniciar: sudo bash manage.sh start' ;;
esac
