# backup-config.ps1
# Creates a timestamped local backup of all critical configuration files

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backups\config_$timestamp"

# Create backup directory
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Write-Host "--- Creating Configuration Backup in: $backupDir ---" -ForegroundColor Cyan

# List of critical files to backup
$filesToBackup = @(
    "firestore.rules",
    "storage.rules",
    "firestore.indexes.json",
    "firebase.json",
    ".firebaserc",
    "app.config.js",
    "package.json",
    "functions\package.json",
    "functions\index.js",
    "src\services\RazorpayService.js",
    ".env"
)

foreach ($file in $filesToBackup) {
    if (Test-Path $file) {
        $destFile = Join-Path $backupDir $file
        $destDir = Split-Path $destFile -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        }
        Copy-Item $file -Destination $destFile
        Write-Host "  [OK] Backed up: $file"
    } else {
        Write-Host "  [SKIP] Not Found: $file" -ForegroundColor Yellow
    }
}

# Also export Firestore Indexes using CLI if available
try {
    Write-Host "--- Exporting Firestore Indexes... ---"
    firebase firestore:indexes > "$backupDir\firestore.indexes.deployed.json" 2>$null
    Write-Host "  [OK] Backed up: Live Firestore Indexes"
} catch {
    Write-Host "  [ERR] Could not export live indexes" -ForegroundColor Red
}

Write-Host "`n--- Backup Completed Successfully! ---" -ForegroundColor Green
Write-Host "Location: $(Resolve-Path $backupDir)"
