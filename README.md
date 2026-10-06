# Evil-Lander

Evil-Lander is a self-hosted homelab dashboard with a customizable public landing page, multiple personal dashboards, draggable and resizable widgets, website embeds, and Home Assistant controls.

## Features

- Public landing page with optional admin-managed logo and movable welcome text.
- Account signup and login. The first account created is the admin; later accounts are regular users.
- Multiple dashboards with tabs and dedicated iframe dashboards.
- Desktop shortcuts and frosted-glass widgets that can be moved and resized. Widgets can collapse to desktop icons.
- Markdown, links, buttons, images, clock, calendar, weather, and website embeds.
- Home Assistant entity, light, fan, thermostat, and dashboard cards.
- Theme presets, a live theme preview, custom colors, and local wallpaper uploads.

## Install on macOS or Linux

Requirements: macOS or a glibc-based Linux distribution, an internet connection, and a user account with write access to its home directory. The installer downloads a checksum-verified Node.js release when Node.js 22.13 or newer with npm is not already available. It installs the pinned pnpm release, project dependencies, generates a private Home Assistant encryption key in `.env.local` if one is not already set, and builds the production app.

Clone the repository and run the installer:

```bash
git clone https://github.com/3evils/evil-lander.git
cd evil-lander
./scripts/install.sh
```

If you fork the project, replace `3evils` with your GitHub account or organization.

The installer supports:

- macOS on Apple Silicon and Intel.
- glibc-based Linux on x86-64 and ARM64, using `apt`, `dnf`, or `pacman` when system download/checksum tools are missing.

It installs Node.js under `~/.local/share/evil-lander` only when the current Node.js is older than 22.13 or npm is missing. pnpm is installed under `~/.local` only if the pinned project version is not already available. On Linux, missing system tools are installed through the detected package manager and may require `sudo`. If `~/.local/bin` is not already on your shell's `PATH`, add it before running `pnpm` or `dashboard` commands:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

If the installer downloaded a private Node.js copy, it prints an additional `PATH` command for that Node.js installation. Run the printed commands in your shell before starting the app.

Run the app in development mode:

```bash
pnpm dev
```

Or run the production build created by the installer:

```bash
pnpm start
```

Open [http://localhost:3000](http://localhost:3000). Sign up to create the first account, which receives the admin role.

### Install without cloning

If you already have this project directory, run:

```bash
./scripts/install.sh
```

The script is safe to rerun. It uses the checked-in `pnpm-lock.yaml` to install the exact dependency versions.

## Configuration

The installer creates `.env.local` with a random 256-bit `AUTH_ENCRYPTION_KEY` if the file does not already contain one. The key is required to securely store the Home Assistant access token.

- Keep `.env.local` private and do not commit it.
- Back up the key somewhere secure. Saved Home Assistant credentials cannot be decrypted if the key is lost or changed.
- `AUTH_DB_PATH` optionally changes the SQLite database path. By default, account and dashboard data is stored in `.data/auth.sqlite`.
- Store `.data` on persistent storage. The SQLite setup is intended for a single app server, not multiple independently running instances.

The first account is the admin. The admin can configure the Home Assistant URL and long-lived access token from **Home Assistant settings** in dashboard edit mode. The token is encrypted at rest and is not returned to the browser.

### Linux systemd service

On Linux with a user systemd manager, install and start the production service after running the installer:

```bash
./dashboard install
dashboard start
```

Manage it with:

```bash
dashboard status
dashboard logs
dashboard restart
dashboard stop
```

The user service starts with the user's systemd session. To enable it at boot before login, enable lingering for your user:

```bash
sudo loginctl enable-linger "$USER"
```

### macOS production mode

Run the production server in the foreground:

```bash
pnpm start
```

Stop it with `Ctrl+C`. For development, use `pnpm dev`.

## Usage

The public home page does not open the login dialog automatically. Use **Log in** to sign in or create an account. Admins can use **Customize landing page** to upload a logo, add welcome text, and drag either item into place.

Use **Edit dashboard** and **Add object** to create content. For supported content cards, select either an expanded desktop widget or a desktop icon that opens a modal. Drag widget title bars to move widgets, use the lower-right grip to resize them, and use the title-bar collapse control to reduce a widget to an icon. Changes to dashboard object positions and sizes are saved to the server.

Themes are selected in dashboard edit mode. Presets include Midnight, Ocean, Forest, Sunset, Rose, Dracula, Nord, Cyberpunk, Slate, AMOLED, and Cloud. Custom colors can be selected visually; wallpaper images can be selected from a URL or uploaded from the device. Uploaded wallpapers are stored in browser IndexedDB; the practical limit depends on browser storage available on that device. Themes and wallpaper uploads are local to the account's browser/device.

## Home Assistant and embeds

Use a public HTTPS URL for Home Assistant when it is behind a reverse proxy, and enable WebSocket support on the proxy. If embedding Home Assistant, configure its trusted reverse proxies and framing settings carefully. Disabling `X-Frame-Options` allows other sites to frame Home Assistant; only do so if that is an acceptable security tradeoff. Prefer HTTPS for both Evil-Lander and embedded services.

Some websites intentionally block iframe embedding. Those sites cannot be made embeddable by the dashboard; use their desktop shortcut to open them directly instead.

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Quality checks:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

## Project stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- SQLite via Node.js built-in `node:sqlite`
- pnpm 12
