# Android Build Guide for Google Cloud Build

This guide explains how to build Android APK and AAB files for your Force Player Register app using Google Cloud Build.

## Overview

The build process uses:
- **Expo Prebuild** - Generates native Android code from your Expo project
- **Gradle** - Native Android build tool
- **Google Cloud Build** - Automated CI/CD platform
- **Secret Manager** - Securely stores your signing keystore

## Build Types

| Type | Command | Output | Use Case |
|------|---------|--------|----------|
| Debug APK | `_BUILD_TYPE=debug` | `app-debug.apk` | Local testing, debugging |
| Release APK | `_BUILD_TYPE=release-apk` | `app-release.apk` | Direct distribution, testing |
| Release AAB | `_BUILD_TYPE=release` | `app-release.aab` | Google Play Store upload |

---

## Prerequisites

### 1. Generate Android Keystore

If you don't have a keystore, generate one:

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore fpr-release.keystore -alias fpr-key -keyalg RSA -keysize 2048 -validity 10000
```

**Important**: Save these values securely:
- Keystore password
- Key alias: `fpr-key`
- Key password

### 2. Install Dependencies

```powershell
cd c:\Users\ritik\OneDrive\Desktop\fpr
npm install
```

### 3. Set Up Google Cloud

```powershell
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable storage-api.googleapis.com
```

---

## Local Build (Testing)

### Step 1: Generate Native Code

```powershell
npm run prebuild
```

This creates the `android/` folder with native Android code.

### Step 2: Build Locally

**Debug APK:**
```powershell
npm run build:android:debug
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

**Release APK (requires keystore setup):**
```powershell
npm run build:android:apk
```

**Release AAB (requires keystore setup):**
```powershell
npm run build:android:aab
```

### Step 3: Install APK on Device

```powershell
# Via ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or copy the APK to your device and install manually
```

---

## Cloud Build Setup

### Step 1: Create Storage Bucket

```powershell
gsutil mb gs://fpr-builds
```

### Step 2: Upload Keystore to Secret Manager

```powershell
# Upload keystore file
gcloud secrets create ANDROID_KEYSTORE --data-file=fpr-release.keystore

# Create keystore password secret (you'll be prompted to enter it)
echo "YOUR_KEYSTORE_PASSWORD" | gcloud secrets create KEYSTORE_PASSWORD --data-file=-

# Create key alias secret
echo "fpr-key" | gcloud secrets create KEY_ALIAS --data-file=-

# Create key password secret
echo "YOUR_KEY_PASSWORD" | gcloud secrets create KEY_PASSWORD --data-file=-
```

### Step 3: Grant Cloud Build Access to Secrets

```powershell
# Get your Cloud Build service account
$PROJECT_ID = gcloud config get-value project
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$SERVICE_ACCOUNT = "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Grant access to secrets
gcloud secrets add-iam-policy-binding ANDROID_KEYSTORE --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding KEYSTORE_PASSWORD --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding KEY_ALIAS --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding KEY_PASSWORD --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
```

---

## Triggering Cloud Builds

### Debug APK Build

```powershell
cd c:\Users\ritik\OneDrive\Desktop\fpr
gcloud builds submit --config=cloudbuild.yaml --substitutions=_BUILD_TYPE=debug,_BUCKET_NAME=fpr-builds
```

### Release APK Build

```powershell
gcloud builds submit --config=cloudbuild.yaml --substitutions=_BUILD_TYPE=release-apk,_BUCKET_NAME=fpr-builds
```

### Release AAB Build (for Play Store)

```powershell
gcloud builds submit --config=cloudbuild.yaml --substitutions=_BUILD_TYPE=release,_BUCKET_NAME=fpr-builds
```

---

## Downloading Build Artifacts

### List Available Builds

```powershell
gsutil ls gs://fpr-builds/builds/
```

### Download Specific Build

```powershell
# Find your build ID from the list above
gsutil ls gs://fpr-builds/builds/YOUR_BUILD_ID/

# Download the APK or AAB
gsutil cp gs://fpr-builds/builds/YOUR_BUILD_ID/app-release.aab ./
```

---

## Automated Builds (Optional)

### Set Up Build Trigger

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click **Create Trigger**
3. Configure:
   - **Name**: `android-release-build`
   - **Event**: Push to branch
   - **Source**: Connect your repository
   - **Branch**: `^main$`
   - **Configuration**: Cloud Build configuration file
   - **Location**: `cloudbuild.yaml`
   - **Substitution variables**:
     - `_BUILD_TYPE`: `release`
     - `_BUCKET_NAME`: `fpr-builds`

Now every push to `main` will trigger an automatic build!

---

## Troubleshooting

### Build Fails with "SDK not found"

The Docker image includes Android SDK. If it fails, try updating the image in `cloudbuild.yaml`:
```yaml
- name: 'mingc/android-build-box:latest'
```

### Keystore Errors

Verify secrets are accessible:
```powershell
gcloud secrets versions access latest --secret=ANDROID_KEYSTORE > test-keystore.jks
```

### Gradle Build Fails

Check the build logs:
```powershell
gcloud builds log YOUR_BUILD_ID
```

### APK Won't Install

- Ensure you've uninstalled previous versions
- Check that the APK is signed correctly
- Verify device architecture matches (arm64-v8a, armeabi-v7a)

---

## Version Management

Update version in `app.config.js`:

```javascript
export default {
  expo: {
    version: "1.0.1",  // User-facing version
    android: {
      versionCode: 2,  // Increment for each release
      // ...
    }
  }
}
```

---

## Next Steps

1. **Test locally** - Build and test APK on your device
2. **Set up Cloud Build** - Upload keystore and configure secrets
3. **Trigger test build** - Build debug APK on Cloud Build
4. **Build release** - Create signed AAB for Play Store
5. **Upload to Play Console** - Submit your app

For Firebase Functions deployment, see the main project README.
