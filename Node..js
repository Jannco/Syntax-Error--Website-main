const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.onCreateApprovedUser = functions.firestore
    .document('approvedUsers/{userId}')
    .onCreate(async (snap, context) => {
        const userData = snap.data();
        
        try {
            const userRecord = await admin.auth().createUser({
                email: userData.email,
                password: userData.password, 
                emailVerified: false,
                disabled: false
            });
            
            console.log("Successfully created new user:", userRecord.uid);
            return null;
        } catch (error) {
            console.error("Error creating new user:", error);
            return null;
        }
    });