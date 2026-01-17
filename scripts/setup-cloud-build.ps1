# Quick Setup Script for Google Cloud Build - Android

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Android Build Setup for Cloud Build" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is installed
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: gcloud CLI is not installed!" -ForegroundColor Red
    Write-Host "Please install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Get project ID
Write-Host "Step 1: Setting up Google Cloud Project" -ForegroundColor Green
$PROJECT_ID = gcloud config get-value project 2>$null

if ([string]::IsNullOrEmpty($PROJECT_ID)) {
    Write-Host "No project configured. Please enter your Google Cloud Project ID:" -ForegroundColor Yellow
    $PROJECT_ID = Read-Host "Project ID"
    gcloud config set project $PROJECT_ID
}

Write-Host "Using project: $PROJECT_ID" -ForegroundColor Cyan
Write-Host ""

# Enable required APIs
Write-Host "Step 2: Enabling required APIs..." -ForegroundColor Green
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable storage-api.googleapis.com
Write-Host "APIs enabled successfully!" -ForegroundColor Cyan
Write-Host ""

# Create storage bucket
Write-Host "Step 3: Creating storage bucket..." -ForegroundColor Green
$BUCKET_NAME = "fpr-builds"
$bucketExists = gsutil ls gs://$BUCKET_NAME 2>$null

if ($bucketExists) {
    Write-Host "Bucket gs://$BUCKET_NAME already exists" -ForegroundColor Yellow
} else {
    gsutil mb gs://$BUCKET_NAME
    Write-Host "Bucket gs://$BUCKET_NAME created successfully!" -ForegroundColor Cyan
}
Write-Host ""

# Check for keystore
Write-Host "Step 4: Android Keystore Setup" -ForegroundColor Green
$KEYSTORE_PATH = "fpr-release.keystore"

if (Test-Path $KEYSTORE_PATH) {
    Write-Host "Found existing keystore: $KEYSTORE_PATH" -ForegroundColor Cyan
} else {
    Write-Host "No keystore found. Generating new keystore..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please provide the following information:" -ForegroundColor Yellow
    
    $KEYSTORE_PASSWORD = Read-Host "Enter keystore password" -AsSecureString
    $KEY_PASSWORD = Read-Host "Enter key password" -AsSecureString
    
    # Convert SecureString to plain text for keytool
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($KEYSTORE_PASSWORD)
    $KEYSTORE_PASSWORD_PLAIN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    
    $BSTR2 = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($KEY_PASSWORD)
    $KEY_PASSWORD_PLAIN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR2)
    
    keytool -genkeypair -v -storetype PKCS12 -keystore $KEYSTORE_PATH -alias fpr-key -keyalg RSA -keysize 2048 -validity 10000 -storepass $KEYSTORE_PASSWORD_PLAIN -keypass $KEY_PASSWORD_PLAIN -dname "CN=Force Player Register, OU=Development, O=FPR, L=City, S=State, C=IN"
    
    Write-Host "Keystore generated successfully!" -ForegroundColor Cyan
}
Write-Host ""

# Upload secrets
Write-Host "Step 5: Uploading secrets to Secret Manager..." -ForegroundColor Green

# Upload keystore
Write-Host "Uploading keystore..." -ForegroundColor Yellow
gcloud secrets create ANDROID_KEYSTORE --data-file=$KEYSTORE_PATH 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Secret ANDROID_KEYSTORE already exists, updating..." -ForegroundColor Yellow
    gcloud secrets versions add ANDROID_KEYSTORE --data-file=$KEYSTORE_PATH
}

# Get passwords
Write-Host ""
Write-Host "Please enter your keystore credentials:" -ForegroundColor Yellow
$KEYSTORE_PASSWORD = Read-Host "Keystore password"
$KEY_PASSWORD = Read-Host "Key password"
$KEY_ALIAS = "fpr-key"

# Upload password secrets
echo $KEYSTORE_PASSWORD | gcloud secrets create KEYSTORE_PASSWORD --data-file=- 2>$null
if ($LASTEXITCODE -ne 0) {
    echo $KEYSTORE_PASSWORD | gcloud secrets versions add KEYSTORE_PASSWORD --data-file=-
}

echo $KEY_PASSWORD | gcloud secrets create KEY_PASSWORD --data-file=- 2>$null
if ($LASTEXITCODE -ne 0) {
    echo $KEY_PASSWORD | gcloud secrets versions add KEY_PASSWORD --data-file=-
}

echo $KEY_ALIAS | gcloud secrets create KEY_ALIAS --data-file=- 2>$null
if ($LASTEXITCODE -ne 0) {
    echo $KEY_ALIAS | gcloud secrets versions add KEY_ALIAS --data-file=-
}

Write-Host "Secrets uploaded successfully!" -ForegroundColor Cyan
Write-Host ""

# Grant permissions
Write-Host "Step 6: Granting Cloud Build access to secrets..." -ForegroundColor Green
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$SERVICE_ACCOUNT = "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud secrets add-iam-policy-binding ANDROID_KEYSTORE --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor" 2>$null
gcloud secrets add-iam-policy-binding KEYSTORE_PASSWORD --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor" 2>$null
gcloud secrets add-iam-policy-binding KEY_ALIAS --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor" 2>$null
gcloud secrets add-iam-policy-binding KEY_PASSWORD --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor" 2>$null

Write-Host "Permissions granted successfully!" -ForegroundColor Cyan
Write-Host ""

# Summary
Write-Host "==================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test local build: npm run prebuild" -ForegroundColor White
Write-Host "2. Trigger Cloud Build:" -ForegroundColor White
Write-Host "   gcloud builds submit --config=cloudbuild.yaml --substitutions=_BUILD_TYPE=debug" -ForegroundColor Cyan
Write-Host ""
Write-Host "For more information, see ANDROID_BUILD.md" -ForegroundColor Yellow
