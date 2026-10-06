$ErrorActionPreference = "Stop"

$NodeVersion = "22.22.1"
$PnpmVersion = "12.9.1"
$MinimumNodeMinor = 13
$InstallRoot = Join-Path $env:LOCALAPPDATA "Evil-Lander"
$NodeHome = Join-Path $InstallRoot "node-v$NodeVersion"
$PnpmHome = Join-Path $InstallRoot "pnpm"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$InstallDir = $ProjectRoot
$HostPort = 3000
$AdminUsername = ""
$AdminPassword = $env:INSTALL_ADMIN_PASSWORD
$AssumeYes = $false

function Stop-Installer([string]$Message) {
    throw "Evil-Lander installer: $Message"
}

function Parse-Arguments {
    param([string[]]$Arguments)

    for ($i = 0; $i -lt $Arguments.Count; $i++) {
        $arg = $Arguments[$i]
        switch -regex ($arg) {
            "^--dir$" {
                if ($i + 1 -ge $Arguments.Count) {
                    Stop-Installer "--dir needs a value."
                }
                $script:InstallDir = $Arguments[++$i]
            }
            "^--port$" {
                if ($i + 1 -ge $Arguments.Count) {
                    Stop-Installer "--port needs a value."
                }
                $script:HostPort = [int]$Arguments[++$i]
            }
            "^--admin$" {
                if ($i + 1 -ge $Arguments.Count) {
                    Stop-Installer "--admin needs a value."
                }
                $script:AdminUsername = $Arguments[++$i]
            }
            "^--yes$|^-y$" {
                $script:AssumeYes = $true
            }
            "^-h$|^--help$" {
                Write-Host @"
Usage: powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 [options]

Runs an interactive installer unless --yes is given.

  --dir PATH         Install location of the web app (default: this checkout)
  --port PORT        Port the web app listens on (default: 3000)
  --admin USER       Admin email/username to create (empty skips creation)
  --yes              Do not prompt; use defaults and the options above
  -h, --help         Show this help

The admin password is read from INSTALL_ADMIN_PASSWORD or prompted for.
"@
                exit 0
            }
            default {
                Write-Error "Unknown option: $arg"
                exit 1
            }
        }
    }
}

function Validate-Port([int]$Port) {
    return $Port -ge 1 -and $Port -le 65535
}

function Validate-AdminEmail([string]$Email) {
    return $Email -match "^[^\s@]+@[^\s@]+\.[^\s@]+$" -and $Email.Length -le 254
}

function Gather-Config {
    if ($AssumeYes -or [System.Environment]::UserInteractive -eq $false) {
        return
    }

    # Install location
    $dir = Read-Host "Directory to install the web app into [$InstallDir]"
    if ($dir) { $script:InstallDir = $dir }

    # Port
    while ($true) {
        $port = Read-Host "Port the web app will listen on [$HostPort]"
        if (-not $port) { $port = $HostPort }
        if ([int]::TryParse($port, [ref]$null) -and (Validate-Port ([int]$port))) {
            $script:HostPort = [int]$port
            break
        }
        Write-Host "Enter a port between 1 and 65535." -ForegroundColor Red
    }

    # Admin account
    while ($true) {
        $admin = Read-Host "Admin email/username (leave blank to skip creating an admin) [$AdminUsername]"
        if (-not $admin -and $AdminUsername) { $admin = $AdminUsername }

        if (-not $admin) {
            $script:AdminUsername = ""
            $script:AdminPassword = ""
            break
        }

        if (-not (Validate-AdminEmail $admin)) {
            Write-Host "The app signs in with an email-style name, e.g. admin@lander.local." -ForegroundColor Red
            continue
        }

        $script:AdminUsername = $admin

        # Password with confirmation
        while ($true) {
            $pass1 = Read-Host "Password for $admin" -AsSecureString
            $pass2 = Read-Host "Confirm password" -AsSecureString

            $pass1_text = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($pass1))
            $pass2_text = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($pass2))

            if ($pass1_text.Length -eq 0 -or $pass1_text.Length -gt 128) {
                Write-Host "Password must be 1-128 characters." -ForegroundColor Red
            }
            elseif ($pass1_text -ne $pass2_text) {
                Write-Host "Passwords do not match." -ForegroundColor Red
            }
            else {
                $script:AdminPassword = $pass1_text
                [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode([Runtime.InteropServices.Marshal]::StringToCoTaskMemUnicode($pass1_text))
                [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode([Runtime.InteropServices.Marshal]::StringToCoTaskMemUnicode($pass2_text))
                break
            }
        }
        break
    }
}

function Validate-Config {
    if (-not (Validate-Port $HostPort)) {
        Stop-Installer "Invalid port: $HostPort"
    }
    if (-not $InstallDir) {
        Stop-Installer "Install location must not be empty."
    }
    $script:InstallDir = (Resolve-Path $InstallDir -ErrorAction Stop).Path
    if (Test-Path $InstallDir) {
        $existing = @(Get-ChildItem $InstallDir -ErrorAction SilentlyContinue)
        if ($existing.Count -gt 0 -and -not (Test-Path (Join-Path $InstallDir "package.json"))) {
            Stop-Installer "$InstallDir is not empty and does not contain an existing install."
        }
    }
    if ($AdminUsername) {
        if (-not (Validate-AdminEmail $AdminUsername)) {
            Stop-Installer "Admin name must look like an email address (the app signs in with email)."
        }
        if (-not $AdminPassword -or $AdminPassword.Length -gt 128) {
            Stop-Installer "Set INSTALL_ADMIN_PASSWORD (1-128 characters) to create an admin."
        }
    }
}

function Deploy-Files {
    if ($InstallDir -eq $ProjectRoot) {
        return
    }
    Write-Host "Copying application files to $InstallDir..."
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

    # Copy all files except node_modules, .next, .git, .data, .env.local
    Get-ChildItem $ProjectRoot | ForEach-Object {
        $exclude = @("node_modules", ".next", ".git", ".data", ".env.local")
        if ($exclude -notcontains $_.Name) {
            Copy-Item -Path $_.FullName -Destination (Join-Path $InstallDir $_.Name) -Recurse -Force
        }
    }
}

function Set-EnvValue([string]$Key, [string]$Value) {
    $envFile = Join-Path $InstallDir ".env.local"
    $content = ""
    if (Test-Path $envFile) {
        $content = Get-Content -LiteralPath $envFile -Raw
        $content = $content -replace "(?m)^$Key=.*`r?`n", ""
    }
    $content += "$Key=$Value`r`n"
    [IO.File]::WriteAllText($envFile, $content, [Text.UTF8Encoding]::new($false))
}

function Test-SupportedNode {
    $NodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $NpmCommand = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $NodeCommand -or -not $NpmCommand) {
        return $false
    }

    $VersionText = (& node -p "process.versions.node" 2>$null)
    if ($LASTEXITCODE -ne 0 -or $VersionText -notmatch "^(\d+)\.(\d+)\.") {
        return $false
    }
    $Major = [int]$Matches[1]
    $Minor = [int]$Matches[2]
    return ($Major -gt 22 -or ($Major -eq 22 -and $Minor -ge $MinimumNodeMinor))
}

function Install-Node {
    $SystemArchitecture = $env:PROCESSOR_ARCHITEW6432
    if (-not $SystemArchitecture) {
        $SystemArchitecture = $env:PROCESSOR_ARCHITECTURE
    }
    $Architecture = switch ($SystemArchitecture) {
        "AMD64" { "x64" }
        "ARM64" { "arm64" }
        default { Stop-Installer "Unsupported Windows architecture: $SystemArchitecture." }
    }
    $Archive = "node-v$NodeVersion-win-$Architecture.zip"
    $DownloadRoot = "https://nodejs.org/dist/v$NodeVersion"
    $TemporaryRoot = Join-Path $env:TEMP ("evil-lander-install-" + [guid]::NewGuid().ToString("N"))

    try {
        New-Item -ItemType Directory -Path $TemporaryRoot -Force | Out-Null
        Write-Host "Downloading Node.js $NodeVersion for Windows/$Architecture..."
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri "$DownloadRoot/$Archive" -OutFile (Join-Path $TemporaryRoot $Archive)
        Invoke-WebRequest -Uri "$DownloadRoot/SHASUMS256.txt" -OutFile (Join-Path $TemporaryRoot "SHASUMS256.txt")

        $ChecksumLine = Get-Content (Join-Path $TemporaryRoot "SHASUMS256.txt") |
            Where-Object { $_ -match "^\s*([0-9a-fA-F]{64})\s+\*?$([regex]::Escape($Archive))\s*$" } |
            Select-Object -First 1
        if (-not $ChecksumLine -or $ChecksumLine -notmatch "^\s*([0-9a-fA-F]{64})") {
            Stop-Installer "The official Node.js checksum was not found for $Archive."
        }
        $ExpectedHash = $Matches[1].ToLowerInvariant()
        $ActualHash = (Get-FileHash -LiteralPath (Join-Path $TemporaryRoot $Archive) -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($ActualHash -ne $ExpectedHash) {
            Stop-Installer "The Node.js download failed SHA-256 verification."
        }

        $ExtractRoot = Join-Path $TemporaryRoot "extracted"
        Expand-Archive -LiteralPath (Join-Path $TemporaryRoot $Archive) -DestinationPath $ExtractRoot
        $ExtractedNode = Join-Path $ExtractRoot "node-v$NodeVersion-win-$Architecture"
        if (-not (Test-Path (Join-Path $ExtractedNode "node.exe"))) {
            Stop-Installer "The verified Node.js archive did not contain node.exe."
        }
        New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
        Move-Item -LiteralPath $ExtractedNode -Destination $NodeHome
    }
    finally {
        if (Test-Path $TemporaryRoot) {
            Remove-Item -LiteralPath $TemporaryRoot -Recurse -Force
        }
    }
}

function Add-UserPath([string]$PathEntry) {
    $CurrentUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $Entries = @()
    if ($CurrentUserPath) {
        $Entries = @($CurrentUserPath -split ";" | Where-Object { $_ })
    }
    $AlreadyPresent = $Entries | Where-Object {
        [string]::Equals($_.TrimEnd("\"), $PathEntry.TrimEnd("\"), [StringComparison]::OrdinalIgnoreCase)
    }
    if (-not $AlreadyPresent) {
        $Entries += $PathEntry
        [Environment]::SetEnvironmentVariable("Path", ($Entries -join ";"), "User")
    }
}

try {
    Parse-Arguments $args
    Gather-Config
    Validate-Config

    if ($env:OS -ne "Windows_NT") {
        Stop-Installer "This installer must be run from Windows PowerShell."
    }
    if (-not (Test-SupportedNode) -and -not (Test-Path (Join-Path $NodeHome "node.exe"))) {
        Install-Node
        if (-not (Test-Path (Join-Path $NodeHome "node.exe"))) {
            Stop-Installer "Node.js installation did not complete."
        }
    }

    if (Test-Path (Join-Path $NodeHome "node.exe")) {
        $ExistingNodeDirectory = $NodeHome
    }
    else {
        $ExistingNodeDirectory = (Get-Command node).Source | Split-Path -Parent
    }
    $env:Path = "$ExistingNodeDirectory;$PnpmHome;$env:Path"

    $PnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    if (-not $PnpmCommand -or (& pnpm --version 2>$null) -ne $PnpmVersion) {
        Write-Host "Installing pnpm $PnpmVersion for the current Windows user..."
        New-Item -ItemType Directory -Path $PnpmHome -Force | Out-Null
        & npm install --global --prefix $PnpmHome "pnpm@$PnpmVersion"
        if ($LASTEXITCODE -ne 0) {
            Stop-Installer "Could not install pnpm $PnpmVersion."
        }
        $env:Path = "$PnpmHome;$env:Path"
    }

    Deploy-Files
    $EnvironmentFile = Join-Path $InstallDir ".env.local"
    if (-not (Test-Path $EnvironmentFile)) {
        New-Item -ItemType File -Path $EnvironmentFile | Out-Null
    }
    $EnvironmentContents = Get-Content -LiteralPath $EnvironmentFile -Raw
    if ($EnvironmentContents -notmatch "(?m)^AUTH_ENCRYPTION_KEY=") {
        $EncryptionKey = $env:AUTH_ENCRYPTION_KEY
        if (-not $EncryptionKey) {
            $EncryptionKey = (& node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
            if ($LASTEXITCODE -ne 0 -or -not $EncryptionKey) {
                Stop-Installer "Could not generate the private encryption key."
            }
        }
        [IO.File]::AppendAllText(
            $EnvironmentFile,
            "AUTH_ENCRYPTION_KEY=$EncryptionKey`r`n",
            [Text.UTF8Encoding]::new($false)
        )
    }
    Set-EnvValue "PORT" $HostPort.ToString()

    Push-Location $InstallDir
    try {
        Write-Host "Installing project dependencies from pnpm-lock.yaml..."
        & pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) {
            Stop-Installer "Dependency installation failed."
        }
        Write-Host "Building Evil-Lander for production..."
        & pnpm build
        if ($LASTEXITCODE -ne 0) {
            Stop-Installer "The production build failed."
        }

        if ($AdminUsername) {
            Write-Host "Creating admin user $AdminUsername..."
            $env:ADMIN_EMAIL = $AdminUsername
            $env:ADMIN_PASSWORD = $AdminPassword
            & node (Join-Path $ProjectRoot "scripts" "create-admin.mjs")
            if ($LASTEXITCODE -ne 0) {
                Stop-Installer "Could not create admin user."
            }
            Remove-Item env:ADMIN_EMAIL
            Remove-Item env:ADMIN_PASSWORD
        }
        else {
            Write-Host "Skipping admin creation; the first account to sign up becomes admin."
        }
    }
    finally {
        Pop-Location
    }

    Add-UserPath $ExistingNodeDirectory
    Add-UserPath $PnpmHome
    Write-Host ""
    Write-Host "Installation complete."
    Write-Host "Installed in: $InstallDir"
    Write-Host "Open a new PowerShell window, then run: pnpm start -p $HostPort"
    Write-Host "For development, run: pnpm dev -p $HostPort"
    Write-Host "Open http://localhost:$HostPort and sign up to create the first admin account (if not pre-created)."
    Write-Host "Runtime settings and the encryption key stay local and are excluded from Git."
}
catch {
    Write-Error $_
    exit 1
}
