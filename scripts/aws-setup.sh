#!/usr/bin/env bash
# One-time bootstrap for the VELTO Food Palace EC2 instance.
# Run as: sudo bash scripts/aws-setup.sh
# Tested on: Ubuntu 24.04 LTS, t3.small, ap-south-1 (Mumbai)
set -euo pipefail

REPO_DIR="/opt/velto"
EC2_USER="ubuntu"

echo "=== Installing system packages ==="
apt-get update -q
apt-get install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git ufw

echo "=== Configuring firewall ==="
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "=== Setting up Docker ==="
systemctl start docker
systemctl enable docker
usermod -aG docker "$EC2_USER"

echo "=== Cloning repository ==="
# Generate a deploy key first: ssh-keygen -t ed25519 -f /root/.ssh/deploy_key -N ""
# Then add the public key as a GitHub deploy key for the repo.
git clone git@github.com:badal484/VELTO_FOOD_PALACE.git "$REPO_DIR"
chown -R "$EC2_USER:$EC2_USER" "$REPO_DIR"

echo "=== Setting up Nginx ==="
cp "$REPO_DIR/nginx/api.go2qt.com.conf" /etc/nginx/sites-available/api.go2qt.com
ln -sf /etc/nginx/sites-available/api.go2qt.com /etc/nginx/sites-enabled/api.go2qt.com
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo ""
echo "================================================================"
echo " NEXT STEPS — complete in this order:"
echo "================================================================"
echo ""
echo "1. In your domain registrar / Route 53:"
echo "   Add A record: api.go2qt.com → <this EC2 Elastic IP>"
echo "   Wait ~60 seconds for DNS to propagate."
echo ""
echo "2. Copy your production env file to the server:"
echo "   scp .env.prod ubuntu@<EC2-IP>:/opt/velto/.env.prod"
echo ""
echo "3. Issue SSL certificate (run from the server):"
echo "   sudo certbot --nginx -d api.go2qt.com \\"
echo "     --non-interactive --agree-tos -m support@go2qt.com"
echo ""
echo "4. Start backend + Redis:"
echo "   cd /opt/velto"
echo "   sudo -u ubuntu docker compose -f docker-compose.aws.yml up -d --build"
echo ""
echo "5. Verify:"
echo "   curl https://api.go2qt.com/api/v1/health"
echo ""
echo "6. Update BACKEND_URL in Vercel to: https://api.go2qt.com"
echo "================================================================"
