#!/bin/bash
#
# Agent Foreman Installer
# https://github.com/mylukin/agent-foreman
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mylukin/agent-foreman/main/scripts/install.sh | bash
#
# Environment Variables:
#   INSTALL_DIR - Custom installation directory (default: /usr/local/bin)
#   VERSION     - Specific version to install (default: latest)
#   USE_NPM     - Set to "1" to install via npm instead of binary
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
GITHUB_REPO="mylukin/agent-foreman"
BINARY_NAME="agent-foreman"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
NPM_PACKAGE="agent-foreman"

# Print colored output
info() {
    echo -e "${BLUE}==>${NC} ${BOLD}$1${NC}"
}

success() {
    echo -e "${GREEN}==>${NC} ${BOLD}$1${NC}"
}

warn() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

error() {
    echo -e "${RED}Error:${NC} $1" >&2
    exit 1
}

# Detect OS
detect_os() {
    local os
    os=$(uname -s | tr '[:upper:]' '[:lower:]')

    case "$os" in
        darwin)
            echo "darwin"
            ;;
        linux)
            echo "linux"
            ;;
        mingw*|msys*|cygwin*)
            error "Windows is not supported via this installer. Please use npm install -g ${NPM_PACKAGE}"
            ;;
        *)
            error "Unsupported operating system: $os"
            ;;
    esac
}

# Detect architecture
detect_arch() {
    local arch
    arch=$(uname -m)

    case "$arch" in
        x86_64|amd64)
            echo "x64"
            ;;
        arm64|aarch64)
            echo "arm64"
            ;;
        *)
            error "Unsupported architecture: $arch"
            ;;
    esac
}

# Check for required commands
check_requirements() {
    local missing=()

    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        missing+=("curl or wget")
    fi

    if [ ${#missing[@]} -ne 0 ]; then
        error "Missing required commands: ${missing[*]}"
    fi
}

# Download file using curl or wget
download() {
    local url="$1"
    local output="$2"

    if command -v curl &> /dev/null; then
        curl -fsSL "$url" -o "$output"
    elif command -v wget &> /dev/null; then
        wget -q "$url" -O "$output"
    else
        error "Neither curl nor wget found"
    fi
}

# Get JSON value (portable, no jq required)
get_json_value() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed 's/.*: *"\([^"]*\)".*/\1/' | head -1
}

# Get latest version from GitHub releases
get_latest_version() {
    local api_url="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"
    local response

    if command -v curl &> /dev/null; then
        response=$(curl -fsSL "$api_url" 2>/dev/null) || {
            warn "Could not fetch latest version from GitHub API"
            return 1
        }
    else
        response=$(wget -qO- "$api_url" 2>/dev/null) || {
            warn "Could not fetch latest version from GitHub API"
            return 1
        }
    fi

    local tag_name
    tag_name=$(get_json_value "$response" "tag_name")

    # Remove 'v' prefix if present
    echo "${tag_name#v}"
}

# Verify SHA256 checksum
verify_checksum() {
    local file="$1"
    local expected="$2"
    local actual

    if command -v sha256sum &> /dev/null; then
        actual=$(sha256sum "$file" | awk '{print $1}')
    elif command -v shasum &> /dev/null; then
        actual=$(shasum -a 256 "$file" | awk '{print $1}')
    else
        warn "Cannot verify checksum: sha256sum/shasum not found"
        return 0
    fi

    if [ "$actual" != "$expected" ]; then
        error "Checksum verification failed!\nExpected: $expected\nActual:   $actual"
    fi

    return 0
}

# Get expected checksum from SHA256SUMS.txt
get_expected_checksum() {
    local binary_name="$1"
    local checksums_file="$2"

    grep "$binary_name" "$checksums_file" 2>/dev/null | awk '{print $1}'
}

# Detect user's shell config file
detect_shell_config() {
    local shell_name
    shell_name=$(basename "$SHELL")

    case "$shell_name" in
        zsh)
            echo "${HOME}/.zshrc"
            ;;
        bash)
            # macOS uses .bash_profile, Linux uses .bashrc
            if [ -f "${HOME}/.bash_profile" ]; then
                echo "${HOME}/.bash_profile"
            else
                echo "${HOME}/.bashrc"
            fi
            ;;
        fish)
            echo "${HOME}/.config/fish/config.fish"
            ;;
        *)
            # Default to .profile for other shells
            echo "${HOME}/.profile"
            ;;
    esac
}

# Ensure INSTALL_DIR is in PATH
ensure_path_configured() {
    # Check if INSTALL_DIR is already in PATH
    if echo "$PATH" | tr ':' '\n' | grep -q "^${INSTALL_DIR}$"; then
        return 0
    fi

    info "Configuring PATH..."

    local shell_config
    shell_config=$(detect_shell_config)
    local path_export="export PATH=\"\$PATH:${INSTALL_DIR}\""

    # Check if already configured in shell config
    if [ -f "$shell_config" ] && grep -q "${INSTALL_DIR}" "$shell_config" 2>/dev/null; then
        info "PATH already configured in ${shell_config}"
        return 0
    fi

    # Add to shell config
    if [ -n "$shell_config" ]; then
        echo "" >> "$shell_config"
        echo "# Added by agent-foreman installer" >> "$shell_config"
        echo "$path_export" >> "$shell_config"
        success "Added ${INSTALL_DIR} to PATH in ${shell_config}"
    fi
}

# Install via npm
install_via_npm() {
    info "Installing via npm..."

    if ! command -v npm &> /dev/null; then
        error "npm not found. Please install Node.js first: https://nodejs.org"
    fi

    local npm_args="-g ${NPM_PACKAGE}"

    if [ -n "$VERSION" ]; then
        npm_args="-g ${NPM_PACKAGE}@${VERSION}"
        info "Installing version: ${VERSION}"
    else
        info "Installing latest version"
    fi

    # Try without sudo first
    if npm install $npm_args 2>/dev/null; then
        success "Installed via npm"
    else
        info "Requesting sudo access for global npm install..."
        sudo npm install $npm_args
    fi

    # Verify installation
    local installed_version
    installed_version=$(${BINARY_NAME} --version 2>/dev/null || echo "unknown")

    echo ""
    success "Installation complete!"
    echo ""
    echo -e "  ${BOLD}Version:${NC}  ${installed_version}"
    echo -e "  ${BOLD}Method:${NC}   npm global package"
    echo ""
    echo -e "  Run ${BOLD}agent-foreman --help${NC} to get started"
    echo ""
}

# Install binary
install_binary() {
    local os arch platform binary_file
    os=$(detect_os)
    arch=$(detect_arch)
    platform="${os}-${arch}"
    binary_file="${BINARY_NAME}-${platform}"

    info "Detected platform: ${platform}"

    # Create temporary directory
    local tmp_dir
    tmp_dir=$(mktemp -d)
    trap 'rm -rf "$tmp_dir"' EXIT

    # Determine version
    local version
    if [ -n "$VERSION" ]; then
        version="$VERSION"
        info "Installing version: ${version}"
    else
        info "Fetching latest version..."
        version=$(get_latest_version)
        if [ -z "$version" ]; then
            error "Could not determine latest version. Please specify VERSION=x.x.x"
        fi
        info "Latest version: ${version}"
    fi

    # GitHub release URL
    local download_url="https://github.com/${GITHUB_REPO}/releases/download/v${version}/${binary_file}"
    local checksums_url="https://github.com/${GITHUB_REPO}/releases/download/v${version}/SHA256SUMS.txt"

    # Download binary
    info "Downloading ${binary_file}..."
    download "$download_url" "${tmp_dir}/${binary_file}" || error "Failed to download binary from ${download_url}"

    # Download checksums (optional)
    info "Downloading checksums..."
    if download "$checksums_url" "${tmp_dir}/SHA256SUMS.txt" 2>/dev/null; then
        # Verify checksum if available
        info "Verifying checksum..."
        local expected_checksum
        expected_checksum=$(get_expected_checksum "$binary_file" "${tmp_dir}/SHA256SUMS.txt")
        if [ -n "$expected_checksum" ]; then
            verify_checksum "${tmp_dir}/${binary_file}" "$expected_checksum"
            success "Checksum verified"
        else
            warn "Checksum not found for ${binary_file}"
        fi
    else
        warn "Could not download checksums, skipping verification"
    fi

    # Make executable
    chmod +x "${tmp_dir}/${binary_file}"

    # Install binary
    info "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."

    # Ensure install directory exists
    if [ ! -d "$INSTALL_DIR" ]; then
        if [ -w "$(dirname "$INSTALL_DIR")" ]; then
            mkdir -p "$INSTALL_DIR"
        else
            sudo mkdir -p "$INSTALL_DIR"
        fi
    fi

    # Check if we need sudo
    if [ -w "$INSTALL_DIR" ]; then
        cp "${tmp_dir}/${binary_file}" "${INSTALL_DIR}/${BINARY_NAME}"
    else
        info "Requesting sudo access to install to ${INSTALL_DIR}..."
        sudo cp "${tmp_dir}/${binary_file}" "${INSTALL_DIR}/${BINARY_NAME}"
        sudo chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    fi

    # macOS: Remove quarantine attribute
    if [ "$os" = "darwin" ]; then
        info "Removing macOS quarantine attribute..."
        if [ -w "$INSTALL_DIR" ]; then
            xattr -dr com.apple.quarantine "${INSTALL_DIR}/${BINARY_NAME}" 2>/dev/null || true
        else
            sudo xattr -dr com.apple.quarantine "${INSTALL_DIR}/${BINARY_NAME}" 2>/dev/null || true
        fi
    fi

    # Ensure INSTALL_DIR is in PATH
    ensure_path_configured

    # Verify installation
    local installed_version
    installed_version=$("${INSTALL_DIR}/${BINARY_NAME}" --version 2>/dev/null || echo "unknown")

    echo ""
    success "Installation complete!"
    echo ""
    echo -e "  ${BOLD}Version:${NC}  ${installed_version}"
    echo -e "  ${BOLD}Location:${NC} ${INSTALL_DIR}/${BINARY_NAME}"
    echo ""

    # Check if command is accessible
    if command -v "${BINARY_NAME}" &> /dev/null; then
        echo -e "  Run ${BOLD}agent-foreman --help${NC} to get started"
    else
        local shell_config
        shell_config=$(detect_shell_config)
        echo -e "  ${YELLOW}Note:${NC} Run this to use immediately:"
        echo ""
        echo -e "    ${BOLD}source ${shell_config}${NC}  # or restart your terminal"
        echo ""
        echo -e "  Then run ${BOLD}agent-foreman --help${NC} to get started"
    fi
    echo ""
}

# Main function
main() {
    echo ""
    echo -e "${BOLD}Agent Foreman Installer${NC}"
    echo "========================"
    echo ""

    # Check requirements
    check_requirements

    # Determine installation method
    if [ "$USE_NPM" = "1" ]; then
        install_via_npm
    else
        install_binary
    fi
}

# Run main function
main
