# Build script for HTTP Client Extension
$ErrorActionPreference = "Stop"

Write-Host "Building HTTP Client Extension..." -ForegroundColor Cyan

# Ensure we're in the correct directory with the required files
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Please run this script from the extension's root directory." -ForegroundColor Red
    exit 1
}

# Check if vsce is installed globally
if (-not (Get-Command vsce -ErrorAction SilentlyContinue)) {
    Write-Host "Installing vsce globally..." -ForegroundColor Yellow
    npm install -g @vscode/vsce
}

# Clean previous builds
Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
}
if (Test-Path "*.vsix") {
    Remove-Item -Path "*.vsix" -Force
}

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Run TypeScript compilation
Write-Host "Compiling TypeScript..." -ForegroundColor Yellow
npm run compile

# Ensure build was successful
if (-not (Test-Path "dist\extension.js")) {
    Write-Host "Error: Build failed. Please check for build errors." -ForegroundColor Red
    exit 1
}

# Create VSIX package
Write-Host "Creating VSIX package..." -ForegroundColor Yellow
vsce package

# Find the created VSIX file
$vsixFile = Get-ChildItem -Filter "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $vsixFile) {
    Write-Host "Error: VSIX package creation failed." -ForegroundColor Red
    exit 1
}

Write-Host "`nBuild completed successfully!" -ForegroundColor Green
Write-Host "VSIX package created: $($vsixFile.Name)" -ForegroundColor Cyan

# Verify required files in the VSIX
Write-Host "`nVerifying package contents..."
$requiredFiles = @(
    "package.json",
    "language-configuration.json",
    "dist/extension.js",
    "syntaxes/http.tmLanguage.json"
)

# Create a temporary directory for verification
$tempDir = Join-Path $env:TEMP "vsix-verify"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Extract VSIX for verification
Expand-Archive -Path $vsixFile.FullName -DestinationPath $tempDir -Force

$missingFiles = @()
foreach ($file in $requiredFiles) {
    $path = Join-Path $tempDir "extension" $file
    if (-not (Test-Path $path)) {
        $missingFiles += $file
    }
}

# Clean up temp directory
Remove-Item -Path $tempDir -Recurse -Force

if ($missingFiles.Count -gt 0) {
    Write-Host "`nWarning: The following files are missing from the package:" -ForegroundColor Yellow
    foreach ($file in $missingFiles) {
        Write-Host "- $file" -ForegroundColor Yellow
    }
    Write-Host "Package may not work correctly." -ForegroundColor Yellow
} else {
    Write-Host "All required files are present in the package." -ForegroundColor Green
}

Write-Host "`nTo install the extension:"
Write-Host "1. Open Cursor"
Write-Host "2. Press Ctrl+Shift+P"
Write-Host "3. Type 'Extensions: Install from VSIX'"
Write-Host "4. Select the generated $($vsixFile.Name) file" 