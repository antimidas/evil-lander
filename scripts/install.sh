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
  rm -f -- "$temp_dir"
  trap - EXIT
  PATH="$NODE_HOME/bin:$PATH"
  export PATH
}

main() {
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

  cd "$PROJECT_ROOT"
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
  chmod 600 .env.local

  printf 'Installing project dependencies from pnpm-lock.yaml...\n'
  pnpm install --frozen-lockfile
  printf 'Building Evil-Lander for production...\n'
  pnpm build

  printf '\nInstallation complete.\n'
  printf 'Start development mode with: pnpm dev\n'
  printf 'Start production mode with: pnpm start\n'
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
    printf 'For a Linux systemd user service: ./dashboard install && dashboard start\n'
  fi
  printf 'The app will be available at http://localhost:3000\n'
}

main "$@"
