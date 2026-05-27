#!/usr/bin/env bash
#
# AllmonTouch Installer Script
# Installs the mobile web interface for Allmon3 on AllStarLink nodes.
# Runs on Debian 12/13 (ASL3 default).
#

set -e

# Configuration
INSTALL_DIR="/usr/share/allmontouch"
GITHUB_USER="ffrafat"          # Replace with your GitHub username
GITHUB_REPO="AllmonLink"       # Replace with your repository name (pointing to the original github repository)
BRANCH="main"                  # Target branch for download

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0;29m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${GREEN}             AllmonTouch PWA Installer             ${NC}"
echo -e "${BLUE}===================================================${NC}"

# 1. Verify root execution
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root (sudo).${NC}"
    exit 1
fi

# 2. Determine installation source mode (Local dev vs. Remote curl)
IS_LOCAL=false
if [ -f "./index.html" ] && [ -f "./manifest.json" ] && [ -d "./js" ]; then
    IS_LOCAL=true
    echo -e "${GREEN}[+] Local install source detected. Copying local directory files...${NC}"
else
    echo -e "${GREEN}[+] Remote install mode. Pulling files from GitHub...${NC}"
fi

# 3. Create target directory
echo -e "${BLUE}[*] Creating directory ${INSTALL_DIR}...${NC}"
mkdir -p "${INSTALL_DIR}"

# 4. Copy or download files
if [ "$IS_LOCAL" = true ]; then
    # Copy from local repo folder
    cp -r index.html manifest.json sw.js css js img "${INSTALL_DIR}/"
else
    # Install dependencies for remote fetch
    if ! command -v curl &> /dev/null || ! command -v unzip &> /dev/null; then
        echo -e "${YELLOW}[*] Installing curl and unzip packages...${NC}"
        apt-get update -y &>/dev/null
        apt-get install -y curl unzip &>/dev/null
    fi

    # Fetch zip file from GitHub
    TEMP_ZIP="/tmp/allmontouch.zip"
    ZIP_URL="https://github.com/${GITHUB_USER}/${GITHUB_REPO}/archive/refs/heads/${BRANCH}.zip"
    
    echo -e "${BLUE}[*] Downloading from GitHub: ${ZIP_URL}...${NC}"
    if ! curl -sSL -o "${TEMP_ZIP}" "${ZIP_URL}"; then
        echo -e "${RED}Error: Failed to download repository archive. Verify GITHUB_USER/GITHUB_REPO in script.${NC}"
        exit 1
      fi

    echo -e "${BLUE}[*] Extracting files...${NC}"
    TEMP_EXTRACT="/tmp/allmontouch-extract"
    rm -rf "${TEMP_EXTRACT}"
    mkdir -p "${TEMP_EXTRACT}"
    unzip -q "${TEMP_ZIP}" -d "${TEMP_EXTRACT}"
    
    # Locate the extracted directory (varies based on branch name)
    EXTRACTED_DIR=$(find "${TEMP_EXTRACT}" -maxdepth 1 -type d -name "${GITHUB_REPO}-*" | head -n 1)
    
    if [ -z "${EXTRACTED_DIR}" ]; then
        echo -e "${RED}Error: Failed to parse extracted directories.${NC}"
        exit 1
    fi

    # Copy files
    cp -r "${EXTRACTED_DIR}/index.html" "${EXTRACTED_DIR}/manifest.json" "${EXTRACTED_DIR}/sw.js" "${EXTRACTED_DIR}/css" "${EXTRACTED_DIR}/js" "${EXTRACTED_DIR}/img" "${INSTALL_DIR}/"
    
    # Clean up temp
    rm -f "${TEMP_ZIP}"
    rm -rf "${TEMP_EXTRACT}"
fi

# Set proper ownership and permissions
echo -e "${BLUE}[*] Setting file permissions...${NC}"
chown -R www-data:www-data "${INSTALL_DIR}"
find "${INSTALL_DIR}" -type d -exec chmod 755 {} \;
find "${INSTALL_DIR}" -type f -exec chmod 644 {} \;

# 5. Detect and configure web servers (Nginx vs. Apache)
NGINX_RUNNING=false
APACHE_RUNNING=false

if systemctl is-active --quiet nginx 2>/dev/null; then
    NGINX_RUNNING=true
fi
if systemctl is-active --quiet apache2 2>/dev/null; then
    APACHE_RUNNING=true
fi

# Configure Nginx
if [ "$NGINX_RUNNING" = true ]; then
    echo -e "${GREEN}[+] Nginx detected active. Configuring location block...${NC}"
    
    # Write Nginx configuration snippet
    NGINX_CONF_FILE="/etc/nginx/conf.d/allmontouch.conf"
    
    # Check if we can include it. A cleaner way for Nginx is writing directly
    # next to the existing allmon3 config inside sites-available/default
    DEFAULT_SITE_FILE="/etc/nginx/sites-available/default"
    
    if [ -f "${DEFAULT_SITE_FILE}" ]; then
        # Check if /allmontouch block is already configured
        if grep -q "location /allmontouch/" "${DEFAULT_SITE_FILE}"; then
            echo -e "${YELLOW}[*] Nginx /allmontouch/ block already exists. Skipping insertion.${NC}"
        else
            # Insert the allmontouch block right before location /allmon3/
            echo -e "${BLUE}[*] Injecting /allmontouch/ config into ${DEFAULT_SITE_FILE}...${NC}"
            
            # Create location block payload
            CONF_BLOCK="\n    location /allmontouch/ {\n        alias ${INSTALL_DIR}/;\n        autoindex off;\n    }\n"
            
            # Insert using sed right before "location /allmon3/"
            sed -i "/location \/allmon3\//i\\$CONF_BLOCK" "${DEFAULT_SITE_FILE}"
            
            echo -e "${BLUE}[*] Restarting Nginx server...${NC}"
            systemctl restart nginx
        fi
    else
        echo -e "${YELLOW}Warning: Nginx is active but ${DEFAULT_SITE_FILE} was not found. Please manual configure path /allmontouch/ mapping to ${INSTALL_DIR}.${NC}"
    fi
fi

# Configure Apache
if [ "$APACHE_RUNNING" = true ]; then
    echo -e "${GREEN}[+] Apache2 detected active. Configuring alias...${NC}"
    
    APACHE_CONF="/etc/apache2/conf-available/allmontouch.conf"
    
    # Write alias configuration file
    cat <<EOF > "${APACHE_CONF}"
# AllmonTouch Mobile PWA Interface
Alias /allmontouch "${INSTALL_DIR}"
<Directory "${INSTALL_DIR}">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>
EOF

    echo -e "${BLUE}[*] Enabling Apache configuration...${NC}"
    a2enconf allmontouch &>/dev/null
    
    echo -e "${BLUE}[*] Restarting Apache server...${NC}"
    systemctl restart apache2
fi

# 6. Create global command shortcuts for updates/uninstall
echo -e "${BLUE}[*] Creating terminal shortcuts (allmontouch-update / allmontouch-uninstall)...${NC}"

# Update command shortcut
cat <<'EOF' > /usr/local/bin/allmontouch-update
#!/usr/bin/env bash
if [ "$EUID" -ne 0 ]; then
    echo "Error: Please run as root (sudo allmontouch-update)"
    exit 1
fi
echo "Updating AllmonTouch..."
curl -sSL https://raw.githubusercontent.com/ffrafat/AllmonLink/main/install.sh | bash
EOF
chmod +x /usr/local/bin/allmontouch-update

# Uninstall command shortcut
cat <<'EOF' > /usr/local/bin/allmontouch-uninstall
#!/usr/bin/env bash
if [ "$EUID" -ne 0 ]; then
    echo "Error: Please run as root (sudo allmontouch-uninstall)"
    exit 1
fi

read -p "Are you sure you want to completely uninstall AllmonTouch? [y/N] " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "Uninstall cancelled."
    exit 0
fi

echo "Uninstalling AllmonTouch..."

# Remove files
rm -rf /usr/share/allmontouch

# Remove Apache configuration
if [ -f "/etc/apache2/conf-available/allmontouch.conf" ]; then
    echo "Removing Apache configuration..."
    a2disconf allmontouch &>/dev/null || true
    rm -f /etc/apache2/conf-available/allmontouch.conf
    systemctl restart apache2 2>/dev/null || true
fi

# Remove Nginx configuration
DEFAULT_SITE_FILE="/etc/nginx/sites-available/default"
if [ -f "${DEFAULT_SITE_FILE}" ] && grep -q "location /allmontouch/" "${DEFAULT_SITE_FILE}"; then
    echo "Removing Nginx configuration..."
    sed -i '/location \/allmontouch\//,/}/d' "${DEFAULT_SITE_FILE}"
    systemctl restart nginx 2>/dev/null || true
fi

# Remove shortcuts
rm -f /usr/local/bin/allmontouch-update
rm -f /usr/local/bin/allmontouch-uninstall

echo "AllmonTouch has been successfully uninstalled."
EOF
chmod +x /usr/local/bin/allmontouch-uninstall

# Get IP address of the Pi
IP_ADDR=$(hostname -I | awk '{print $1}')
if [ -z "$IP_ADDR" ]; then
    IP_ADDR="localhost"
fi

echo -e "${BLUE}===================================================${NC}"
echo -e "${GREEN}       AllmonTouch Installation Completed!         ${NC}"
echo -e "${BLUE}===================================================${NC}"
echo -e "You can access AllmonTouch on your mobile browser at:"
echo -e "👉 ${YELLOW}http://${IP_ADDR}/allmontouch/${NC}"
echo -e ""
echo -e "Inside Safari/Chrome, tap 'Add to Home Screen' to install as an App."
echo -e "${BLUE}===================================================${NC}"
