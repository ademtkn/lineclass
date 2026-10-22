#!/usr/bin/env bash
# Yeni Ubuntu 24.04 sunucusunu hazırlar (bir kez, root): swap, Docker, güvenlik duvarı.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if ! swapon --show | grep -q .; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf && sysctl -q -p /etc/sysctl.d/99-swap.conf
fi

apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 ufw unattended-upgrades >/dev/null
systemctl enable --now docker >/dev/null

ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

# Docker günlüklerinin küçük diski doldurmasını engelle
mkdir -p /etc/docker
echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' > /etc/docker/daemon.json
systemctl restart docker

mkdir -p /opt/lineclass
echo "Sunucu hazır: $(docker --version)"
