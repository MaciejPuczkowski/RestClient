# Installation script for HTTP Client Extension

# Get the Cursor extensions directory path
$extensionsDir = "$env:USERPROFILE\.cursor\extensions"
$extensionName = "cursor-http-client"
$extensionPath = Join-Path $extensionsDir $extensionName

Write-Host "Installing HTTP Client Extension for Cursor..." -ForegroundColor Cyan

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

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Build the extension
Write-Host "Building extension..." -ForegroundColor Yellow
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

# Create extensions directory if it doesn't exist
if (-not (Test-Path $extensionsDir)) {
    Write-Host "Creating extensions directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $extensionsDir | Out-Null
}

# Remove existing extension if present
if (Test-Path $extensionPath) {
    Write-Host "Removing existing installation..." -ForegroundColor Yellow
    Remove-Item -Path $extensionPath -Recurse -Force
}

# Create extension directory
New-Item -ItemType Directory -Path $extensionPath | Out-Null

# Extract VSIX package
Write-Host "Installing extension..." -ForegroundColor Yellow
Expand-Archive -Path $vsixFile.FullName -DestinationPath $extensionPath -Force

Write-Host "Installation completed successfully!" -ForegroundColor Green
Write-Host "Please restart Cursor to activate the extension." -ForegroundColor Cyan

# Clean up VSIX file
Remove-Item $vsixFile.FullName

# Optional: Show installation path
Write-Host "`nInstallation path: $extensionPath" -ForegroundColor Gray

Write-Host "`nVerifying installation..."
$requiredFiles = @(
    "package.json",
    "language-configuration.json",
    "dist\extension.js",
    "syntaxes\http.tmLanguage.json"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    $path = Join-Path $extensionPath $file
    if (-not (Test-Path $path)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "Warning: The following files are missing:" -ForegroundColor Yellow
    foreach ($file in $missingFiles) {
        Write-Host "- $file" -ForegroundColor Yellow
    }
    Write-Host "Installation may not work correctly." -ForegroundColor Yellow
} else {
    Write-Host "All required files are present." -ForegroundColor Green
}

Write-Host "`nInstallation complete!"
Write-Host "Please follow these steps:" -ForegroundColor Cyan
Write-Host "1. Close all instances of Cursor"
Write-Host "2. Open Cursor"
Write-Host "3. Create a new file with .http extension"
Write-Host "4. Press F1 and type 'HTTP Client'"
Write-Host "5. You should see 'Run HTTP Request' and 'Switch Environment' commands"
Write-Host "`nIf commands are not visible:"
Write-Host "1. Press F1 and type 'Developer: Open Extension Logs'"
Write-Host "2. Check for any error messages"
Write-Host "3. Try running 'Developer: Reload Window' from the command palette" 