import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "syntaxerror-data.firebaseapp.com",
    projectId: "syntaxerror-data",
    storageBucket: "syntaxerror-data.firebasestorage.app",
    messagingSenderId: "513961059475",
    appId: "1:513961059475:web:fbf6f471357465dbaad966"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
emailjs.init({ publicKey: "SZvtmcDCW3hy4qm5v" });

const emailInput = document.getElementById("email");
const pinInput = document.getElementById("pin");
const passBtn = document.getElementById("passBtn");
const pinBtn = document.getElementById("pinBtn");
const loader = document.getElementById("loader-overlay");

let pendingActions = [];
let currentAuthEmail = "";

// PRESERVED: Original handling functions remain untouched
async function handleAction(actionType) {
    const checkboxes = document.querySelectorAll('.user-checkbox:checked');
    if (checkboxes.length === 0) return alert("Select at least one user.");
    pendingActions = Array.from(checkboxes).map(cb => ({
        id: cb.dataset.id,
        data: JSON.parse(cb.dataset.user)
    }));
    document.getElementById("confirm-message").innerText = `Are you sure you want to ${actionType} these users?`;
    document.getElementById("action-confirm-popup").style.display = 'flex';
}

async function confirmAction(actionType) {
    for (const item of pendingActions) {
        if (actionType === 'approve') {
            await addDoc(collection(db, "approvedUsers"), {
                ...item.data,
                status: "approved",
                approvedAt: new Date()
            });
        }
        await deleteDoc(doc(db, "pendingUsers", item.id));
    }
    loadPendingUsers();
    document.getElementById("action-confirm-popup").style.display = 'none';
}

// Helpers for Inline UI Errors
const triggerError = (element) => {
    element.classList.add("error-input");
    setTimeout(() => element.classList.remove("error-input"), 2000);
};

const showError = (elementId, message) => {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    setTimeout(() => { errorEl.textContent = ""; }, 4000);
};

// 1. Identity Verification
passBtn.addEventListener("click", async () => {
    const emailVal = emailInput.value.trim();
    if (!emailVal) {
        triggerError(emailInput);
        showError("emailError", "Please enter your email.");
        return;
    }

    passBtn.disabled = true;
    passBtn.innerText = "Processing...";
    loader.style.display = "flex";

    try {
        const q = query(collection(db, "authorized_admins"), where("Email", "==", emailVal));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
            const userDoc = querySnapshot.docs[0];
            await updateDoc(doc(db, "authorized_admins", userDoc.id), { pin: randomPin });

            const expirationTime = new Date(Date.now() + 15 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            await emailjs.send("service_ixe2e5j", "template_kvlen8d", {
                email: emailVal,
                passcode: randomPin,
                time: expirationTime 
            });

            currentAuthEmail = emailVal;
            document.getElementById("passwordStep").style.display = "none";
            document.getElementById("pinStep").style.display = "block";
        } else {
            triggerError(emailInput);
            showError("emailError", "Access Denied: Email not authorized.");
        }
    } catch (error) {
        console.error("EmailJS Error:", error);
        showError("emailError", "Failed to send email. Try again.");
    } finally {
        loader.style.display = "none";
        passBtn.disabled = false;
        passBtn.innerText = "Verify Identity";
    }
});

// 2. PIN Finalization
pinBtn.addEventListener("click", async () => {
    const pinVal = pinInput.value.trim();
    if (!pinVal) {
        triggerError(pinInput);
        showError("pinError", "Please enter the PIN.");
        return;
    }

   
    pinBtn.disabled = true;
    pinBtn.innerText = "Validating...";
    loader.style.display = "flex"; 


    try {
        const q = query(collection(db, "authorized_admins"), where("Email", "==", currentAuthEmail), where("pin", "==", pinVal));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            window.location.href = "Dashboard.html";
        } else {
            triggerError(pinInput);
            showError("pinError", "Invalid PIN. Check your email again.");
        }
    } catch (error) {
        showError("pinError", "Validation failed.");
    } finally {
      
        loader.style.display = "none";
        pinBtn.disabled = false;
        pinBtn.innerText = "Finalize Access";
   
    }
});