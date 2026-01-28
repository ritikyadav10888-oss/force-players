const admin = require('firebase-admin');
const path = require('path');

/**
 * INSTRUCTIONS:
 * 1. Go to Firebase Console > Project Settings > Service Accounts
 * 2. Click "Generate New Private Key"
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS to point to the downloaded JSON key file
 * 4. Add the UIDs of the users you want to make Owners to the array below
 * 5. Run this script: node scripts/setAdminClaims.js
 */

try {
    // SECURITY: Do not load service account keys from a file committed to the repo.
    // Use Application Default Credentials (ADC) instead.
    // - Windows PowerShell example:
    //   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\serviceAccountKey.json"
    // - Or run `gcloud auth application-default login`
    admin.initializeApp({ credential: admin.credential.applicationDefault() });

    const setOwnerRole = async (uid) => {
        try {
            await admin.auth().setCustomUserClaims(uid, { role: 'owner' });
            console.log(`✅ Successfully set owner role for UID: ${uid}`);

            // Verification step
            const user = await admin.auth().getUser(uid);
            console.log(`Current Claims for ${user.email}:`, user.customClaims);
        } catch (error) {
            console.error(`❌ Error setting claims for UID ${uid}:`, error.message);
        }
    };

    // --- CONFIGURE UIDs HERE ---
    const ownerUIDs = [
        '5P1nPyKU95Tldv1RzbDaPnYuiz53',
        'HvqLtyRkogf4J1FckjlFr1oncM23'
    ];

    // Safety check removed as UIDs are now provided


    Promise.all(ownerUIDs.map(uid => setOwnerRole(uid)))
        .then(() => {
            console.log("All updates completed.");
            process.exit(0);
        });

} catch (e) {
    console.error("❌ An error occurred:", e.message);
    console.error("Tip: set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON or run `gcloud auth application-default login`.");
    process.exit(1);
}
