const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function checkEmailStatus() {
    console.log("Checking last 5 emails in 'mail' collection...");
    try {
        const snapshot = await db.collection('mail')
            // .orderBy('delivery.startTime', 'desc') // Sometimes delivery field is missing if not picked up
            // .orderBy('createdAt', 'desc') // We rely on insertion
            .limit(5)
            .get();

        if (snapshot.empty) {
            console.log("No documents found in 'mail' collection.");
            return;
        }

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log("\n------------------------------------------------");
            console.log(`ID: ${doc.id}`);
            console.log(`To: ${data.to}`);

            if (data.delivery) {
                console.log(`Status: ${data.delivery.state}`);
                if (data.delivery.state === 'ERROR') {
                    console.error(`Error: ${data.delivery.error}`);
                }
                if (data.delivery.info) {
                    console.log(`Info: ${JSON.stringify(data.delivery.info)}`);
                }
            } else {
                console.log("Status: PENDING (Not picked up by extension yet)");
            }
        });

    } catch (error) {
        console.error("Error fetching mails:", error);
    }
}

checkEmailStatus();
