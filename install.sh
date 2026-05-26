#!/usr/bin/env bash
#
# AllmonLink Installer Script
# Installs the mobile web interface for Allmon3 on AllStarLink nodes.
# Runs on Debian 12/13 (ASL3 default).
#

set -e

# Configuration
INSTALL_DIR="/usr/share/allmonlink"
GITHUB_USER="ffrafat"          # Replace with your GitHub username
GITHUB_REPO="AllmonLink"       # Replace with your repository name
BRANCH="main"                  # Target branch for download

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0;29m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${GREEN}             AllmonLink PWA Installer              ${NC}"
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
    TEMP_ZIP="/tmp/allmonlink.zip"
    ZIP_URL="https://github.com/${GITHUB_USER}/${GITHUB_REPO}/archive/refs/heads/${BRANCH}.zip"
    
    echo -e "${BLUE}[*] Downloading from GitHub: ${ZIP_URL}...${NC}"
    if ! curl -sSL -o "${TEMP_ZIP}" "${ZIP_URL}"; then
        echo -e "${RED}Error: Failed to download repository archive. Verify GITHUB_USER/GITHUB_REPO in script.${NC}"
        exit 1
      fi

    echo -e "${BLUE}[*] Extracting files...${NC}"
    TEMP_EXTRACT="/tmp/allmonlink-extract"
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
    NGINX_CONF_FILE="/etc/nginx/conf.d/allmonlink.conf"
    
    # Check if we can include it. A cleaner way for Nginx is writing directly
    # next to the existing allmon3 config inside sites-available/default
    DEFAULT_SITE_FILE="/etc/nginx/sites-available/default"
    
    if [ -f "${DEFAULT_SITE_FILE}" ]; then
        # Check if /allmonlink block is already configured
        if grep -q "location /allmonlink/" "${DEFAULT_SITE_FILE}"; then
            echo -e "${YELLOW}[*] Nginx /allmonlink/ block already exists. Skipping insertion.${NC}"
        else
            # Insert the allmonlink block right before location /allmon3/
            echo -e "${BLUE}[*] Injecting /allmonlink/ config into ${DEFAULT_SITE_FILE}...${NC}"
            
            # Create location block payload
            CONF_BLOCK="\n    location /allmonlink/ {\n        alias ${INSTALL_DIR}/;\n        autoindex off;\n    }\n"
            
            # Insert using sed right before "location /allmon3/"
            sed -i "/location \/allmon3\//i\\$CONF_BLOCK" "${DEFAULT_SITE_FILE}"
            
            echo -e "${BLUE}[*] Restarting Nginx server...${NC}"
            systemctl restart nginx
        fi
    else
        echo -e "${YELLOW}Warning: Nginx is active but ${DEFAULT_SITE_FILE} was not found. Please manual configure path /allmonlink/ mapping to ${INSTALL_DIR}.${NC}"
    fi
fi

# Configure Apache
if [ "$APACHE_RUNNING" = true ]; then
    echo -e "${GREEN}[+] Apache2 detected active. Configuring alias...${NC}"
    
    APACHE_CONF="/etc/apache2/conf-available/allmonlink.conf"
    
    # Write alias configuration file
    cat <<EOF > "${APACHE_CONF}"
# AllmonLink Mobile PWA Interface
Alias /allmonlink "${INSTALL_DIR}"
<Directory "${INSTALL_DIR}">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>
EOF

    echo -e "${BLUE}[*] Enabling Apache configuration...${NC}"
    a2enconf allmonlink &>/dev/null
    
    echo -e "${BLUE}[*] Restarting Apache server...${NC}"
    systemctl restart apache2
fi

if [ "$NGINX_RUNNING" = false ] && [ "$APACHE_RUNNING" = false ]; then
    echo -e "${YELLOW}Warning: No active Nginx or Apache web server detected. Please ensure your web server points /allmonlink to ${INSTALL_DIR}${NC}"
fi

# Get IP address of the Pi
IP_ADDR=$(hostname -I | awk '{print $1}')
if [ -z "$IP_ADDR" ]; then
    IP_ADDR="localhost"
fi

echo -e "${BLUE}===================================================${NC}"
echo -e "${GREEN}       AllmonLink Installation Completed!          ${NC}"
echo -e "${BLUE}===================================================${NC}"
echo -e "You can access AllmonLink on your mobile browser at:"
echo -e "👉 ${YELLOW}http://${IP_ADDR}/allmonlink/${NC}"
echo -e ""
echo -e "Inside Safari/Chrome, tap 'Add to Home Screen' to install as an App."
echo -e "${BLUE}===================================================${NC}"
