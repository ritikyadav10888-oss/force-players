# Backup and Disaster Recovery Guide

This project uses Firebase (Firestore, Storage, Auth, Functions). Below are the procedures for backing up each component.

## 1. Automated Firestore Data Backup (Recommended)

To backup your live database to Google Cloud Storage:

```powershell
# Get your project ID
$PROJECT_ID = "force-player-register-ap-ade3a"
$BUCKET_NAME = "gs://${PROJECT_ID}-backups"
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

# Create bucket if it doesn't exist (First time only)
# gcloud storage buckets create $BUCKET_NAME --location=asia-south1

# Export Firestore
gcloud firestore export $BUCKET_NAME/firestore_backup_$TIMESTAMP
```

## 2. Configuration & Rules Backup (Local)

Run the included backup script to save a copy of your current rules, indexes, and environment configurations:

```powershell
.\scripts\backup-config.ps1
```

## 3. Storage Assets Backup

To copy all files from Firebase Storage to your local machine:

```powershell
gsutil -m cp -r gs://force-player-register-ap-ade3a.appspot.com ./backups/storage/
```

## 4. Environment Secrets

Keep a secure offline copy of your `.env` and Firebase secrets. 
You can view current Firebase secrets with:

```powershell
firebase functions:secrets:get RAZORPAY_KEY_ID
firebase functions:secrets:get RAZORPAY_KEY_SECRET
```

---
*Last Backup Check: 2026-01-30*
