#!/usr/bin/env bash
set -euo pipefail

curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
dnf install -y nodejs

cat > /etc/yum.repos.d/mongodb-org-8.0.repo <<'EOF'
[mongodb-org-8.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/8.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-8.0.asc
EOF

dnf install -y \
  mongodb-org \
  libreoffice-core \
  libreoffice-writer \
  libreoffice-calc \
  libreoffice-impress \
  liberation-fonts \
  google-noto-sans-cjk-fonts

systemctl enable --now mongod

echo "NATIVE_INSTALL_COMPLETE"
node -v
npm -v
mongod --version | head -2
soffice --version
free -h
