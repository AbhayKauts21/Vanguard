#!/bin/bash

# Vanguard VM Initialization Script
# This script installs Docker, PostgreSQL, and Grafana on Ubuntu 22.04 LTS

set -e  # Exit on any error

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/vanguard-init.log
}

log "Starting Vanguard VM initialization..."

# Update system packages
log "Updating system packages..."
apt-get update -y
apt-get upgrade -y

# ========================================
# Install Docker
# ========================================

log "Installing Docker..."

# Install required packages
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add default user to docker group
usermod -aG docker ${SUDO_USER:-azureadmin}

log "Docker installed successfully. Version: $(docker --version)"

# ========================================
# Install PostgreSQL
# ========================================

log "Installing PostgreSQL..."

# Install PostgreSQL
apt-get install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

log "PostgreSQL installed successfully. Version: $(psql --version)"

# Configure PostgreSQL to accept remote connections
log "Configuring PostgreSQL..."
PG_VERSION=$(ls /etc/postgresql/)
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

# Backup original files
cp "${PG_CONF}" "${PG_CONF}.backup"
cp "${PG_HBA}" "${PG_HBA}.backup"

# Allow connections from all addresses (adjust as needed for security)
echo "listen_addresses = '*'" >> "${PG_CONF}"

# Add host-based authentication entry
echo "host    all             all             0.0.0.0/0               md5" >> "${PG_HBA}"

# Restart PostgreSQL to apply changes
systemctl restart postgresql

log "PostgreSQL configuration completed."

# ========================================
# Install Grafana
# ========================================

log "Installing Grafana..."

# Install required dependencies
apt-get install -y software-properties-common wget

# Add Grafana GPG key
wget -q -O - https://packages.grafana.com/gpg.key | gpg --dearmor | tee /usr/share/keyrings/grafana.gpg > /dev/null

# Add Grafana repository
echo "deb [signed-by=/usr/share/keyrings/grafana.gpg] https://packages.grafana.com/oss/deb stable main" | tee /etc/apt/sources.list.d/grafana.list

# Install Grafana
apt-get update -y
apt-get install -y grafana

# Start and enable Grafana
systemctl daemon-reload
systemctl start grafana-server
systemctl enable grafana-server

log "Grafana installed successfully. Version: $(grafana-server -v)"

# ========================================
# Install Docker Compose (standalone)
# ========================================

log "Installing Docker Compose..."

DOCKER_COMPOSE_VERSION="v2.24.5"
curl -SL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

log "Docker Compose installed successfully. Version: $(docker-compose --version)"

# ========================================
# Install useful utilities
# ========================================

log "Installing additional utilities..."

apt-get install -y \
    git \
    vim \
    htop \
    net-tools \
    jq \
    unzip \
    tree

# ========================================
# Configure Firewall (UFW)
# ========================================

log "Configuring firewall..."

apt-get install -y ufw

# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow Grafana
ufw allow 3000/tcp

# Allow PostgreSQL (if needed for external access)
ufw allow 5432/tcp

# Enable firewall (in permissive mode)
ufw --force enable

log "Firewall configured."

# ========================================
# Create directories for services
# ========================================

log "Creating service directories..."

mkdir -p /opt/vanguard/{docker,postgresql,grafana}
chown -R ${SUDO_USER:-azureadmin}:${SUDO_USER:-azureadmin} /opt/vanguard

# ========================================
# System Information
# ========================================

log "Gathering system information..."

cat > /opt/vanguard/system-info.txt <<EOF
Vanguard VM System Information
================================
Hostname: $(hostname)
IP Address: $(hostname -I | awk '{print $1}')
OS: $(lsb_release -d | cut -f2)
Kernel: $(uname -r)
Docker Version: $(docker --version)
Docker Compose Version: $(docker-compose --version)
PostgreSQL Version: $(psql --version)
Grafana Version: $(grafana-server -v | head -n 1)

Installation Date: $(date)

Services:
- Docker: http://localhost
- PostgreSQL: localhost:5432
- Grafana: http://localhost:3000 (default login: admin/admin)

Logs:
- Init Script: /var/log/vanguard-init.log
EOF

log "System information written to /opt/vanguard/system-info.txt"

# ========================================
# Completion
# ========================================

log "Vanguard VM initialization completed successfully!"
log "Services installed:"
log "  - Docker: $(docker --version)"
log "  - PostgreSQL: $(psql --version)"
log "  - Grafana: http://$(hostname -I | awk '{print $1}'):3000"
log ""
log "Please reboot the system to apply all changes."
log "After reboot, you can:"
log "  - Access Grafana at http://$(hostname -I | awk '{print $1}'):3000"
log "  - Use Docker commands: docker ps, docker run, etc."
log "  - Connect to PostgreSQL: psql -U postgres"
log ""
log "For more information, see /opt/vanguard/system-info.txt"

# Create a success marker file
touch /opt/vanguard/.initialization-complete

exit 0
