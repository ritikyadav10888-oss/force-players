# Set Razorpay Test Keys in Firebase Functions
# Run this script to configure test keys for Razorpay Route testing

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setting Razorpay Test Keys" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test credentials
$TEST_KEY_ID = "rzp_test_S7hNQVFMSudblg"
$TEST_KEY_SECRET = "BbiWuz8TSlez1FUV4E1sz6o4"

Write-Host "🔑 Configuring Firebase Functions with Razorpay TEST keys..." -ForegroundColor Yellow
Write-Host ""

# Set RAZORPAY_KEY_ID
Write-Host "Setting RAZORPAY_KEY_ID..." -NoNewline
$TEST_KEY_ID | firebase functions:secrets:set RAZORPAY_KEY_ID 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✅ SUCCESS" -ForegroundColor Green
    Write-Host "   Value: $TEST_KEY_ID" -ForegroundColor Gray
} else {
    Write-Host " ❌ FAILED" -ForegroundColor Red
    Write-Host "   Please run manually: firebase functions:secrets:set RAZORPAY_KEY_ID" -ForegroundColor Yellow
}

Write-Host ""

# Set RAZORPAY_KEY_SECRET
Write-Host "Setting RAZORPAY_KEY_SECRET..." -NoNewline
$TEST_KEY_SECRET | firebase functions:secrets:set RAZORPAY_KEY_SECRET 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✅ SUCCESS" -ForegroundColor Green
    Write-Host "   Value: **********************" -ForegroundColor Gray
} else {
    Write-Host " ❌ FAILED" -ForegroundColor Red
    Write-Host "   Please run manually: firebase functions:secrets:set RAZORPAY_KEY_SECRET" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if RAZORPAY_WEBHOOK_SECRET exists
Write-Host "Checking RAZORPAY_WEBHOOK_SECRET..." -NoNewline
$webhookCheck = firebase functions:secrets:access RAZORPAY_WEBHOOK_SECRET 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✅ EXISTS" -ForegroundColor Green
} else {
    Write-Host " ⚠️ NOT SET" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⚠️ You need to set the webhook secret:" -ForegroundColor Yellow
    Write-Host "   1. Go to Razorpay Dashboard (Test Mode)" -ForegroundColor Cyan
    Write-Host "   2. Settings → Webhooks" -ForegroundColor Cyan
    Write-Host "   3. Copy the Webhook Secret" -ForegroundColor Cyan
    Write-Host "   4. Run: firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ask to deploy functions
Write-Host "📦 Ready to deploy functions with test keys?" -ForegroundColor Yellow
Write-Host ""
$deploy = Read-Host "Deploy functions now? (yes/no)"

if ($deploy -eq "yes") {
    Write-Host ""
    Write-Host "Deploying Cloud Functions..." -ForegroundColor Yellow
    firebase deploy --only functions
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Functions deployed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 Test mode is now active!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Restart your development server" -ForegroundColor Cyan
        Write-Host "2. Make a test payment with card: 4111 1111 1111 1111" -ForegroundColor Cyan
        Write-Host "3. Verify 95/5 split in Razorpay Dashboard (Test Mode)" -ForegroundColor Cyan
        Write-Host "4. Test settlement release" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ Deployment failed. Please check the error above." -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "Skipped deployment." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To deploy later, run:" -ForegroundColor Cyan
    Write-Host "   firebase deploy --only functions" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Client-side: .env file updated with test key" -ForegroundColor Green
Write-Host "✅ Server-side: Firebase secrets configured" -ForegroundColor Green
Write-Host ""
Write-Host "Test Key ID: $TEST_KEY_ID" -ForegroundColor Gray
Write-Host "Mode: TEST (No real money will be charged)" -ForegroundColor Gray
Write-Host ""
Write-Host "Test Cards:" -ForegroundColor Yellow
Write-Host "  Success: 4111 1111 1111 1111" -ForegroundColor Cyan
Write-Host "  Failure: 4000 0000 0000 0002" -ForegroundColor Cyan
Write-Host "  UPI:     success@razorpay" -ForegroundColor Cyan
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "  Full Guide: RAZORPAY_TEST_KEYS_GUIDE.md" -ForegroundColor Cyan
Write-Host "  Quick Ref:  TEST_KEYS_QUICK_REF.md" -ForegroundColor Cyan
Write-Host "  Testing:    RAZORPAY_ROUTE_TESTING.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
