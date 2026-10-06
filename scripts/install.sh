#!/usr/bin/env bash
set -Eeuo pipefail

NODE_VERSION=22.22.1
PNPM_VERSION=12.9.1
NODE_MINIMUM_MINOR=13
LOCAL_BIN="$HOME/.local/bin"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
NODE_HOME="$DATA_HOME/evil-lander/node-v$NODE_VERSION"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd -- "$SCRIPT_DIR/.." && pwd)

INSTALL_DIR=$PROJECT_ROOT
HOST_PORT=3000
ADMIN_USERNAME=""
ADMIN_PASSWORD=${INSTALL_ADMIN_PASSWORD:-}
ASSUME_YES=0

fail() {
  printf 'evil-lander installer: %s\n' "$*" >&2
  exit 1
}

install_linux_tools() {
  local packages=()
  command -v curl >/dev/null 2>&1 || packages+=(curl)
  command -v tar >/dev/null 2>&1 || packages+=(tar)
  command -v awk >/dev/null 2>&1 || packages+=(gawk)
  command -v grep >/dev/null 2>&1 || packages+=(grep)
  if ! command -v sha256sum >/dev/null 2>&1 &&
    ! command -v shasum >/dev/null 2>&1; then
    packages+=(coreutils)
  fi
  ((${#packages[@]} == 0)) && return

  local sudo_command=()
  if [[ "$EUID" -ne 0 ]]; then
    command -v sudo >/dev/null 2>&1 ||
      fail "Install these system tools, then rerun: ${packages[*]}"
    sudo_command=(sudo)
  fi

  if command -v apt-get >/dev/null 2>&1; then
    "${sudo_command[@]}" apt-get update
    "${sudo_command[@]}" apt-get install -y "${packages[@]}" ca-certificates
  elif command -v dnf >/dev/null 2>&1; then
    "${sudo_command[@]}" dnf install -y "${packages[@]}" ca-certificates
  elif command -v pacman >/dev/null 2>&1; then
    "${sudo_command[@]}" pacman -Sy --needed --noconfirm "${packages[@]}" ca-certificates
  else
    fail "Unsupported Linux package manager. Install curl, tar, awk, grep, and sha256sum."
  fi
}

usage() {
  cat <<'EOF'
Usage: scripts/install.sh [options]

Runs an interactive installer unless --yes is given or stdin is not a terminal.

  --dir PATH         Install location of the web app (default: this checkout)
  --port PORT        Port the web app listens on (default: 3000)
  --admin USER       Admin email/username to create (empty skips creation)
  --yes              Do not prompt; use defaults and the options above
  -h, --help         Show this help

The admin password is read from INSTALL_ADMIN_PASSWORD or prompted for.
EOF
}

parse_args() {
  while (($#)); do
    case "$1" in
      --dir) [[ $# -ge 2 ]] || fail "--dir needs a value."; INSTALL_DIR=$2; shift 2 ;;
      --port) [[ $# -ge 2 ]] || fail "--port needs a value."; HOST_PORT=$2; shift 2 ;;
      --admin) [[ $# -ge 2 ]] || fail "--admin needs a value."; ADMIN_USERNAME=$2; shift 2 ;;
      --yes|-y) ASSUME_YES=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) usage >&2; fail "Unknown option: $1" ;;
    esac
  done
}

TUI=""
detect_tui() {
  [[ -t 0 && -t 1 ]] || return 0
  if command -v whiptail >/dev/null 2>&1; then TUI=whiptail
  elif command -v dialog >/dev/null 2>&1; then TUI=dialog
  fi
}

# ask KIND TITLE TEXT DEFAULT: prints the answer; non-zero when cancelled
ask() {
  local kind=$1 title=$2 text=$3 default=${4:-} value
  if [[ -n "$TUI" ]]; then
    "$TUI" --title "$title" "--$kind" "$text" 10 72 "$default" 3>&1 1>&2 2>&3
    return
  fi
  if [[ "$kind" == passwordbox ]]; then
    read -r -s -p "$text: " value
    printf '\n' >&2
  else
    read -r -p "$text${default:+ [$default]}: " value
    value=${value:-$default}
  fi
  printf '%s' "$value"
}

notify() {
  if [[ -n "$TUI" ]]; then
    "$TUI" --msgbox "$1" 8 64
  else
    printf '%s\n' "$1" >&2
  fi
}

validate_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && ((10#$1 >= 1 && 10#$1 <= 65535))
}

validate_admin() {
  [[ "$1" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ && ${#1} -le 254 ]]
}

gather_config() {
  if ((ASSUME_YES)) || [[ ! -t 0 ]]; then
    return
  fi
  detect_tui
  local value password confirm

  value=$(ask inputbox "Install location" "Directory to install the web app into" "$INSTALL_DIR") ||
    fail "Cancelled."
  [[ -n "$value" ]] && INSTALL_DIR=$value

  while true; do
    value=$(ask inputbox "Port" "Port the web app will listen on" "$HOST_PORT") || fail "Cancelled."
    if validate_port "$value"; then
      HOST_PORT=$((10#$value))
      break
    fi
    notify "Enter a port between 1 and 65535."
  done

  while true; do
    value=$(ask inputbox "Admin account" \
      "Admin email/username (leave blank to skip creating an admin)" "$ADMIN_USERNAME") ||
      fail "Cancelled."
    if [[ -z "$value" ]]; then
      ADMIN_USERNAME=""
      ADMIN_PASSWORD=""
      break
    fi
    if ! validate_admin "$value"; then
      notify "The app signs in with an email-style name, e.g. admin@lander.local."
      continue
    fi
    ADMIN_USERNAME=$value
    password=$(ask passwordbox "Admin password" "Password for $ADMIN_USERNAME") || fail "Cancelled."
    confirm=$(ask passwordbox "Admin password" "Confirm password") || fail "Cancelled."
    if [[ -z "$password" || ${#password} -gt 128 ]]; then
      notify "Password must be 1-128 characters."
    elif [[ "$password" != "$confirm" ]]; then
      notify "Passwords do not match."
    else
      ADMIN_PASSWORD=$password
      break
    fi
  done
}

validate_config() {
  validate_port "$HOST_PORT" || fail "Invalid port: $HOST_PORT"
  HOST_PORT=$((10#$HOST_PORT))
  [[ -n "$INSTALL_DIR" ]] || fail "Install location must not be empty."
  case "$INSTALL_DIR" in
    "~") INSTALL_DIR=$HOME ;;
    "~/"*) INSTALL_DIR=$HOME/${INSTALL_DIR#"~/"} ;;
  esac
  mkdir -p -- "$INSTALL_DIR"
  INSTALL_DIR=$(cd -- "$INSTALL_DIR" && pwd)
  if [[ -n "$ADMIN_USERNAME" ]]; then
    validate_admin "$ADMIN_USERNAME" ||
      fail "Admin name must look like an email address (the app signs in with email)."
    [[ -n "$ADMIN_PASSWORD" && ${#ADMIN_PASSWORD} -le 128 ]] ||
      fail "Set INSTALL_ADMIN_PASSWORD (1-128 characters) to create an admin."
  fi
}

# Copies the app into INSTALL_DIR unless it is already running from there.
deploy_files() {
  [[ "$INSTALL_DIR" == "$PROJECT_ROOT" ]] && return
  if [[ -n "$(ls -A -- "$INSTALL_DIR")" && ! -f "$INSTALL_DIR/package.json" ]]; then
    fail "$INSTALL_DIR is not empty and does not contain an existing install."
  fi
  printf 'Copying application files to %s...\n' "$INSTALL_DIR"
  tar -C "$PROJECT_ROOT" \
    --exclude=./node_modules --exclude=./.next --exclude=./.git \
    --exclude=./.data --exclude=./.env.local -cf - . |
    tar -C "$INSTALL_DIR" -xf -
}

set_env_value() {
  local key=$1 value=$2 temp
  temp=$(mktemp)
  grep -v "^$key=" .env.local > "$temp" || true
  printf '%s=%s\n' "$key" "$value" >> "$temp"
  cat -- "$temp" > .env.local
  rm -f -- "$temp"
}

node_is_supported() {
  command -v node >/dev/null 2>&1 || return 1
  node -e '
    const [major, minor] = process.versions.node.split(".").map(Number);
    process.exit(major > 22 || (major === 22 && minor >= Number(process.argv[1])) ? 0 : 1);
  ' "$NODE_MINIMUM_MINOR"
}

install_node() {
  local system arch platform archive url temp_dir checksum_line
  system=$(uname -s)
  arch=$(uname -m)

  case "$system" in
    Darwin) platform=darwin ;;
    Linux) platform=linux ;;
    *) fail "Supported platforms are macOS and Linux; detected $system." ;;
  esac
  case "$arch" in
    x86_64|amd64) arch=x64 ;;
    aarch64|arm64) arch=arm64 ;;
    *) fail "Unsupported CPU architecture: $arch." ;;
  esac

  archive="node-v$NODE_VERSION-$platform-$arch.tar.gz"
  url="https://nodejs.org/dist/v$NODE_VERSION"
  temp_dir=$(mktemp -d)
  trap 'rm -rf -- "$temp_dir"' EXIT

  printf 'Downloading Node.js %s for %s/%s...\n' "$NODE_VERSION" "$platform" "$arch"
  curl --fail --location --silent --show-error \
    "$url/$archive" -o "$temp_dir/$archive"
  curl --fail --location --silent --show-error \
    "$url/SHASUMS256.txt" -o "$temp_dir/SHASUMS256.txt"

  checksum_line=$(
    awk -v archive="$archive" '$2 == archive { print; found = 1; exit } END { if (!found) exit 1 }' \
      "$temp_dir/SHASUMS256.txt"
  ) || fail "The official Node.js checksum was not found for $archive."
  printf '%s\n' "$checksum_line" > "$temp_dir/checksum.txt"
  if command -v shasum >/dev/null 2>&1; then
    (cd "$temp_dir" && shasum -a 256 -c checksum.txt)
  elif command -v sha256sum >/dev/null 2>&1; then
    (cd "$temp_dir" && sha256sum -c checksum.txt)
  else
    fail "A SHA-256 checksum tool is required to verify Node.js."
  fi

  mkdir -p -- "$(dirname -- "$NODE_HOME")"
  tar -xzf "$temp_dir/$archive" --strip-components=1 \
    -C "$(dirname -- "$NODE_HOME")"
  rm -rf -- "$temp_dir"
  trap - EXIT
  PATH="$NODE_HOME/bin:$PATH"
  export PATH
}

main() {
  parse_args "$@"
  gather_config
  validate_config

  local system
  system=$(uname -s)
  case "$system" in
    Darwin) ;;
    Linux) install_linux_tools ;;
    *) fail "Supported platforms are macOS and Linux; detected $system." ;;
  esac

  mkdir -p -- "$LOCAL_BIN"
  if ! node_is_supported || ! command -v npm >/dev/null 2>&1; then
    install_node
  fi

  PATH="$LOCAL_BIN:$PATH"
  export PATH
  if ! command -v pnpm >/dev/null 2>&1 ||
    [[ "$(pnpm --version)" != "$PNPM_VERSION" ]]; then
    printf 'Installing pnpm %s in %s...\n' "$PNPM_VERSION" "$LOCAL_BIN"
    npm install --global --prefix "$HOME/.local" "pnpm@$PNPM_VERSION"
  fi

  deploy_files
  cd "$INSTALL_DIR"
  if [[ ! -f .env.local ]]; then
    (umask 077 && : > .env.local)
  fi
  if ! grep -q '^AUTH_ENCRYPTION_KEY=' .env.local; then
    local encryption_key=${AUTH_ENCRYPTION_KEY:-}
    if [[ -z "$encryption_key" ]]; then
      encryption_key=$(node -e \
        'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')
    fi
    (umask 077 && printf 'AUTH_ENCRYPTION_KEY=%s\n' "$encryption_key" >> .env.local)
  fi
  set_env_value PORT "$HOST_PORT"
  chmod 600 .env.local

  printf 'Installing project dependencies from pnpm-lock.yaml...\n'
  pnpm install --frozen-lockfile
  printf 'Building Evil-Lander for production...\n'
  pnpm build

  if [[ -n "$ADMIN_USERNAME" ]]; then
    printf 'Creating admin user %s...\n' "$ADMIN_USERNAME"
    ADMIN_EMAIL=$ADMIN_USERNAME ADMIN_PASSWORD=$ADMIN_PASSWORD \
      node scripts/create-admin.mjs
  else
    printf 'Skipping admin creation; the first account to sign up becomes admin.\n'
  fi

  printf '\nInstallation complete.\n'
  printf 'Installed in: %s\n' "$INSTALL_DIR"
  printf 'Start development mode with: pnpm dev -p %s\n' "$HOST_PORT"
  printf 'Start production mode with: pnpm start -p %s\n' "$HOST_PORT"
  local node_bin_directory
  node_bin_directory=$(dirname -- "$(command -v node)")
  case ":$PATH:" in
    *":$node_bin_directory:"*) ;;
    *) printf 'If needed, add Node.js to PATH: export PATH="%s:$PATH"\n' "$node_bin_directory" ;;
  esac
  case ":$PATH:" in
    *":$LOCAL_BIN:"*) ;;
    *) printf 'Add pnpm to PATH: export PATH="%s:$PATH"\n' "$LOCAL_BIN" ;;
  esac
  if [[ "$system" == Linux ]]; then
    printf 'For a Linux systemd user service: %s/dashboard install && dashboard start\n' "$INSTALL_DIR"
  fi
  printf 'The app will be available at http://localhost:%s\n' "$HOST_PORT"
}

main "$@"
