# Google Cloud Build - Android APK/AAB

This project is configured to build Android applications using Google Cloud Build.

## Quick Start

### 1. One-Time Setup

Run the setup script to configure Google Cloud:

```powershell
cd c:\Users\ritik\OneDrive\Desktop\fpr
.\scripts\setup-cloud-build.ps1
```

This will:
- Enable required Google Cloud APIs
- Create a storage bucket for build artifacts
- Generate or use existing Android keystore
- Upload secrets to Secret Manager
- Grant necessary permissions

### 2. Build Commands

**Debug APK** (for testing):
```powershell
gcloud builds submit --config=cloudbuild.yaml --substitutions=_BUILD_TYPE=debug
```

**Release APK** (signed, for distribution):
```powershell
gcloud builds submit --config=cloudbuild.yaml --substitutions=_BUILD_TYPE=release-apk
```

**Release AAB** (for Google Play Store):
```powershell
gcloud builds submit --config=cloudbuild.yaml --substitutions=_BUILD_TYPE=release
```

### 3. Download Builds

```powershell
# List builds
gsutil ls gs://fpr-builds/builds/

# Download specific build
gsutil cp gs://fpr-builds/builds/BUILD_ID/app-release.aab ./
```

## Local Development

### Generate Native Code

```powershell
npm run prebuild
```

### Build Locally

```powershell
# Debug APK
npm run build:android:debug

# Release APK
npm run build:android:apk

# Release AAB
npm run build:android:aab
```

## Documentation

See [ANDROID_BUILD.md](./ANDROID_BUILD.md) for detailed documentation.

## Files

- `cloudbuild.yaml` - Cloud Build configuration
- `ANDROID_BUILD.md` - Comprehensive build guide
- `scripts/setup-cloud-build.ps1` - Automated setup script
- `package.json` - Build scripts
