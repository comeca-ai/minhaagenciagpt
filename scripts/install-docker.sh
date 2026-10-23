#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$EUID" -eq 0 ]] || { printf 'Execute a instalação do Docker com sudo.\n' >&2; exit 1; }
# This is a system-owned file, not user configuration.
. /etc/os-release
case "${ID:-}" in
  ubuntu|debian) docker_distro="$ID" ;;
  *) printf 'Instalação automática disponível para Ubuntu e Debian. Instale o Docker seguindo https://docs.docker.com/engine/install/\n' >&2; exit 1 ;;
esac
docker_codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
[[ "$docker_codename" =~ ^[a-z]+$ ]] || { printf 'Codinome da distribuição não reconhecido.\n' >&2; exit 1; }
if command -v docker >/dev/null; then
  printf 'Docker já existe. Nenhum pacote será substituído.\n'
  exit 0
fi
# Do not uninstall container runtimes or packages from an existing server.
for package in docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc; do
  if dpkg-query -W -f='${Status}' "$package" 2>/dev/null | grep -qx 'install ok installed'; then
    printf 'Pacote existente: %s. Revise a migração com a documentação oficial antes de instalar o Docker CE. Nada foi removido.\n' "$package" >&2
    exit 1
  fi
done
if [[ -f /etc/apt/sources.list.d/docker.sources || -f /etc/apt/sources.list.d/docker.list ]]; then
  printf 'Já existe um repositório Docker em /etc/apt/sources.list.d/. Conclua a instalação existente antes de continuar.\n' >&2
  exit 1
fi
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl --proto '=https' --tlsv1.2 -fsSL "https://download.docker.com/linux/$docker_distro/gpg" -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
docker_arch="$(dpkg --print-architecture)"
cat > /etc/apt/sources.list.d/docker.sources <<SOURCES
Types: deb
URIs: https://download.docker.com/linux/$docker_distro
Suites: $docker_codename
Components: stable
Architectures: $docker_arch
Signed-By: /etc/apt/keyrings/docker.asc
SOURCES
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
printf 'Docker Engine e Compose instalados pelo repositório oficial.\n'
