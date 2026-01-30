# Set Razorpay Live Keys in Firebase Functions
# Run this script to configure production keys for going live

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setting Razorpay Live Keys" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Live credentials
$LIVE_KEY_ID = "rzp_live_S4UFro656NZEhB"

Write-Host "Configuring Firebase Functions with Razorpay LIVE keys..." -ForegroundColor Yellow
Write-Host ""

# Set RAZORPAY_KEY_ID
Write-Host "Setting RAZORPAY_KEY_ID..." -NoNewline
$LIVE_KEY_ID | firebase functions:secrets:set RAZORPAY_KEY_ID 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host " SUCCESS" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host ""

# Prompt for Secret
Write-Host "Please enter your Razorpay LIVE Secret Key:" -ForegroundColor Yellow
$LIVE_KEY_SECRET = Read-Host "Secret Key"

if ($LIVE_KEY_SECRET) {
    Write-Host "Setting RAZORPAY_KEY_SECRET..." -NoNewline
    $LIVE_KEY_SECRET | firebase functions:secrets:set RAZORPAY_KEY_SECRET 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " SUCCESS" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if RAZORPAY_WEBHOOK_SECRET exists
Write-Host "Checking RAZORPAY_WEBHOOK_SECRET..." -NoNewline
$webhookCheck = firebase functions:secrets:access RAZORPAY_WEBHOOK_SECRET 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host " EXISTS" -ForegroundColor Green
} else {
    Write-Host " NOT SET" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You need to set the LIVE webhook secret manually:" -ForegroundColor Yellow
    Write-Host "1. Go to Razorpay Dashboard (Live Mode)" -ForegroundColor Cyan
    Write-Host "2. Settings -> Webhooks" -ForegroundColor Cyan
    Write-Host "3. Run: firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ask to deploy functions
Write-Host "Ready to deploy functions with live keys?" -ForegroundColor Red
Write-Host ""
$deploy = Read-Host "Deploy functions now? (yes/no)"

if ($deploy -eq "yes") {
    Write-Host ""
    Write-Host "Deploying Cloud Functions..." -ForegroundColor Yellow
    firebase deploy --only functions
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Functions deployed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "PRODUCTION IS NOW LIVE!" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "Deployment failed. Please check the error above." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Live Key ID: $LIVE_KEY_ID" -ForegroundColor Gray
Write-Host "Mode: LIVE" -ForegroundColor Red
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
