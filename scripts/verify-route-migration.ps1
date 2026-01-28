# Razorpay Route Verification Script
# Verifies that the migration to Razorpay Route is complete and correct

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Razorpay Route Verification Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allChecks = @()

# Check 1: Verify no RazorpayX references in code
Write-Host "Check 1: Verifying no RazorpayX references in code..." -ForegroundColor Yellow
$razorpayxRefs = Select-String -Path "functions\index.js" -Pattern "razorpayx|razorpayXCall|processPayout|createPayoutTransaction|syncPayoutStatus" -CaseSensitive:$false

if ($razorpayxRefs) {
    Write-Host "❌ FAILED: Found RazorpayX references in code" -ForegroundColor Red
    $razorpayxRefs | ForEach-Object { Write-Host "   Line $($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Red }
    $allChecks += $false
} else {
    Write-Host "✅ PASSED: No RazorpayX references found" -ForegroundColor Green
    $allChecks += $true
}

Write-Host ""

# Check 2: Verify new Route functions exist
Write-Host "Check 2: Verifying new Route functions exist..." -ForegroundColor Yellow
$requiredFunctions = @(
    "createLinkedAccount",
    "createPaymentWithRoute",
    "releaseSettlement"
)

$allFunctionsExist = $true
foreach ($func in $requiredFunctions) {
    $found = Select-String -Path "functions\index.js" -Pattern $func -Quiet
    if ($found) {
        Write-Host "✅ Found: $func" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $func" -ForegroundColor Red
        $allFunctionsExist = $false
    }
}

$allChecks += $allFunctionsExist
Write-Host ""

# Check 3: Verify webhook handles transfer events
Write-Host "Check 3: Verifying webhook handles transfer events..." -ForegroundColor Yellow
$transferEvents = Select-String -Path "functions\index.js" -Pattern "transfer\." -Quiet

if ($transferEvents) {
    Write-Host "✅ PASSED: Webhook handles transfer events" -ForegroundColor Green
    $allChecks += $true
} else {
    Write-Host "❌ FAILED: Webhook does not handle transfer events" -ForegroundColor Red
    $allChecks += $false
}

Write-Host ""

# Check 4: Verify client-side uses createPaymentWithRoute
Write-Host "Check 4: Verifying client-side uses createPaymentWithRoute..." -ForegroundColor Yellow
$clientRoute = Select-String -Path "src\services\RazorpayService.js" -Pattern "createPaymentWithRoute" -Quiet

if ($clientRoute) {
    Write-Host "✅ PASSED: Client uses createPaymentWithRoute" -ForegroundColor Green
    $allChecks += $true
} else {
    Write-Host "❌ FAILED: Client does not use createPaymentWithRoute" -ForegroundColor Red
    $allChecks += $false
}

Write-Host ""

# Check 5: Verify Firebase secrets
Write-Host "Check 5: Verifying Firebase secrets..." -ForegroundColor Yellow

$requiredSecrets = @("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET")
$oldSecrets = @("RAZORPAYX_WEBHOOK_SECRET", "RAZORPAYX_ACCOUNT_NUMBER")

$secretsCorrect = $true

# Check required secrets exist
foreach ($secret in $requiredSecrets) {
    $result = firebase functions:secrets:access $secret 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Present: $secret" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $secret" -ForegroundColor Red
        $secretsCorrect = $false
    }
}

# Check old secrets are removed
foreach ($secret in $oldSecrets) {
    $result = firebase functions:secrets:access $secret 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✅ Removed: $secret" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Still exists: $secret (should be removed)" -ForegroundColor Yellow
        $secretsCorrect = $false
    }
}

$allChecks += $secretsCorrect
Write-Host ""

# Check 6: Verify functions are deployed
Write-Host "Check 6: Checking if functions are deployed..." -ForegroundColor Yellow
Write-Host "⚠️ Manual verification required" -ForegroundColor Yellow
Write-Host "   Run: firebase functions:list" -ForegroundColor Cyan
Write-Host "   Verify these functions exist:" -ForegroundColor Cyan
Write-Host "     - createOrganizer" -ForegroundColor Cyan
Write-Host "     - createPaymentWithRoute" -ForegroundColor Cyan
Write-Host "     - releaseSettlement" -ForegroundColor Cyan
Write-Host "     - razorpayWebhook" -ForegroundColor Cyan
Write-Host "     - verifyPayment" -ForegroundColor Cyan
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passedChecks = ($allChecks | Where-Object { $_ -eq $true }).Count
$totalChecks = $allChecks.Count

Write-Host "Passed: $passedChecks / $totalChecks checks" -ForegroundColor $(if ($passedChecks -eq $totalChecks) { "Green" } else { "Yellow" })
Write-Host ""

if ($passedChecks -eq $totalChecks) {
    Write-Host "✅ All automated checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Deploy functions: firebase deploy --only functions" -ForegroundColor Cyan
    Write-Host "2. Test payment flow with a small amount" -ForegroundColor Cyan
    Write-Host "3. Verify 95/5 split in Razorpay Dashboard" -ForegroundColor Cyan
    Write-Host "4. Test settlement release" -ForegroundColor Cyan
} else {
    Write-Host "⚠️ Some checks failed. Please review the errors above." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "For help, see: RAZORPAY_ROUTE_IMPLEMENTATION.md" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
