const admin = require('firebase-admin');
const path = require('path');

/**
 * INSTRUCTIONS:
 * 1. Go to Firebase Console > Project Settings > Service Accounts
 * 2. Click "Generate New Private Key"
 * 3. Save the file as "serviceAccountKey.json" in this "scripts" folder
 * 4. Add the UIDs of the users you want to make Owners to the array below
 * 5. Run this script: node scripts/setAdminClaims.js
 */

try {
    const serviceAccount = require("./serviceAccountKey.json");

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

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
    if (e.code === 'MODULE_NOT_FOUND') {
        console.error("❌ Error: serviceAccountKey.json not found in scripts folder.");
        console.error("Please download it from Firebase Console and place it here.");
    } else {
        console.error("❌ An error occurred:", e.message);
    }
    process.exit(1);
}
