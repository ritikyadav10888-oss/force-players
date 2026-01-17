const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
// Assuming environment is configured with GOOGLE_APPLICATION_CREDENTIALS or gcloud auth application-default login
// If not, this might fail unless run in emulator or with explicit key
try {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'force-player-register-ap-ade3a'
    });
} catch (e) {
    console.log('Default init failed, trying without args (for Cloud Shell/Environment)...');
    admin.initializeApp();
}

const db = admin.firestore();
const TEMPLATES_DIR = path.join(__dirname, '../email-templates');
const COLLECTION_NAME = 'email_templates';

async function uploadTemplates() {
    if (!fs.existsSync(TEMPLATES_DIR)) {
        console.error(`Templates directory not found at: ${TEMPLATES_DIR}`);
        return;
    }

    const files = fs.readdirSync(TEMPLATES_DIR);
    console.log(`Found ${files.length} files in ${TEMPLATES_DIR}`);

    for (const file of files) {
        if (path.extname(file) === '.html') {
            const templateName = path.basename(file, '.html');
            const filePath = path.join(TEMPLATES_DIR, file);
            const content = fs.readFileSync(filePath, 'utf8');

            console.log(`Uploading template: ${templateName}...`);

            try {
                // The extension expects the template document to have an 'html' field
                // It can also have 'subject', 'text', 'amp' fields.
                // We'll store the HTML content. Subject usually comes from the trigger data, 
                // but we can set a default subject if we parse it from title? 
                // For now just HTML.
                await db.collection(COLLECTION_NAME).doc(templateName).set({
                    html: content,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                console.log(`✅ Uploaded ${templateName}`);
            } catch (error) {
                console.error(`❌ Failed to upload ${templateName}:`, error);
            }
        }
    }
    console.log('All templates processed.');
}

uploadTemplates().catch(console.error);
