# Razorpay Route Migration Script
# This script helps migrate from RazorpayX to Razorpay Route

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Razorpay Route Migration Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check current secrets
Write-Host "Step 1: Checking current Firebase secrets..." -ForegroundColor Yellow
Write-Host ""

$secrets = @(
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "RAZORPAYX_WEBHOOK_SECRET",
    "RAZORPAYX_ACCOUNT_NUMBER"
)

foreach ($secret in $secrets) {
    Write-Host "Checking $secret..." -NoNewline
    $result = firebase functions:secrets:access $secret 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅ EXISTS" -ForegroundColor Green
    } else {
        Write-Host " ❌ NOT FOUND" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 2: Confirm deletion of old secrets
Write-Host "Step 2: Remove RazorpayX secrets (no longer needed)" -ForegroundColor Yellow
Write-Host ""
Write-Host "The following secrets will be DELETED:" -ForegroundColor Red
Write-Host "  - RAZORPAYX_WEBHOOK_SECRET" -ForegroundColor Red
Write-Host "  - RAZORPAYX_ACCOUNT_NUMBER" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Do you want to proceed? (yes/no)"

if ($confirm -eq "yes") {
    Write-Host ""
    Write-Host "Deleting RAZORPAYX_WEBHOOK_SECRET..." -NoNewline
    firebase functions:secrets:destroy RAZORPAYX_WEBHOOK_SECRET --force 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅ DELETED" -ForegroundColor Green
    } else {
        Write-Host " ⚠️ ALREADY DELETED OR ERROR" -ForegroundColor Yellow
    }
    
    Write-Host "Deleting RAZORPAYX_ACCOUNT_NUMBER..." -NoNewline
    firebase functions:secrets:destroy RAZORPAYX_ACCOUNT_NUMBER --force 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅ DELETED" -ForegroundColor Green
    } else {
        Write-Host " ⚠️ ALREADY DELETED OR ERROR" -ForegroundColor Yellow
    }
} else {
    Write-Host "Skipped deletion." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 3: Verify required secrets
Write-Host "Step 3: Verify required secrets for Razorpay Route" -ForegroundColor Yellow
Write-Host ""
Write-Host "Required secrets:" -ForegroundColor Cyan
Write-Host "  ✓ RAZORPAY_KEY_ID" -ForegroundColor Green
Write-Host "  ✓ RAZORPAY_KEY_SECRET" -ForegroundColor Green
Write-Host "  ✓ RAZORPAY_WEBHOOK_SECRET" -ForegroundColor Green
Write-Host ""

$requiredSecrets = @("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET")
$allPresent = $true

foreach ($secret in $requiredSecrets) {
    $result = firebase functions:secrets:access $secret 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Missing: $secret" -ForegroundColor Red
        $allPresent = $false
    }
}

if ($allPresent) {
    Write-Host "✅ All required secrets are present!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️ Some secrets are missing. Please set them using:" -ForegroundColor Yellow
    Write-Host "   firebase functions:secrets:set RAZORPAY_KEY_ID" -ForegroundColor Cyan
    Write-Host "   firebase functions:secrets:set RAZORPAY_KEY_SECRET" -ForegroundColor Cyan
    Write-Host "   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 4: Deploy functions
Write-Host "Step 4: Deploy updated Cloud Functions" -ForegroundColor Yellow
Write-Host ""
Write-Host "Ready to deploy functions with Razorpay Route implementation." -ForegroundColor Cyan
Write-Host ""

$deploy = Read-Host "Deploy functions now? (yes/no)"

if ($deploy -eq "yes") {
    Write-Host ""
    Write-Host "Deploying functions..." -ForegroundColor Yellow
    firebase deploy --only functions
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Functions deployed successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Deployment failed. Please check the error above." -ForegroundColor Red
    }
} else {
    Write-Host "Skipped deployment." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To deploy later, run:" -ForegroundColor Cyan
    Write-Host "   firebase deploy --only functions" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Migration Script Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Enable Razorpay Route in your Razorpay Dashboard" -ForegroundColor Cyan
Write-Host "2. Enable Settlement Hold feature" -ForegroundColor Cyan
Write-Host "3. Test payment flow with a small amount" -ForegroundColor Cyan
Write-Host "4. Verify automatic 95/5 split in Razorpay Dashboard" -ForegroundColor Cyan
Write-Host "5. Test settlement release from owner dashboard" -ForegroundColor Cyan
Write-Host ""
Write-Host "For detailed instructions, see:" -ForegroundColor Yellow
Write-Host "   RAZORPAY_ROUTE_IMPLEMENTATION.md" -ForegroundColor Cyan
Write-Host ""
