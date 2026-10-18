console.log("Login.js loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    setPersistence,
    inMemoryPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCEK9ungYl1PkiqgLkWJPCtNXAsQ3c6xxc",
    authDomain: "syntaxerror-data.firebaseapp.com",
    projectId: "syntaxerror-data",
    storageBucket: "syntaxerror-data.firebasestorage.app",
    messagingSenderId: "513961059475",
    appId: "1:513961059475:web:fbf6f471357465dbaad966"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const email = document.getElementById("email");
const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const loginForm = document.getElementById("loginForm");
const rememberMe = document.getElementById("rememberMe");
const VERIFIED_KEY = "syntaxerror_verified_uid";
const DASHBOARD_URL = "../MainMenu/dashboard.html";
let otpExpiresAt = 0;
let loginInProgress = false;

// Resume only sessions that have successfully completed the email PIN step.
onAuthStateChanged(auth, async (user) => {
    if (loginInProgress || !user) return;
    const verifiedUid = localStorage.getItem(VERIFIED_KEY) || sessionStorage.getItem(VERIFIED_KEY);
    if (verifiedUid !== user.uid) return;
    try {
        const archived = await getDocs(query(collection(db, "archivedUsers"), where("email", "==", user.email)));
        if (!archived.empty) {
            localStorage.removeItem(VERIFIED_KEY);
            sessionStorage.removeItem(VERIFIED_KEY);
            await signOut(auth);
            showPopup("Your account has been archived. You cannot log in.");
            return;
        }
        window.location.replace(DASHBOARD_URL);
    } catch (error) {
        console.error("Unable to check remembered session:", error);
        // Do not redirect if the archive check cannot be completed.
    }
});
const popup = document.getElementById("popup");
const popupMessage = document.getElementById("popup-message");
const popupClose = document.getElementById("popup-close");

let generatedOtp = "";

function showPopup(message) {
    if (popup && popupMessage) {
        popup.style.display = "flex";
        popupMessage.textContent = message;
    } else {
        alert(message);
    }
}

popupClose?.addEventListener("click", () => {
    if (popup) popup.style.display = "none";
});

togglePassword?.addEventListener("click", function () {
    const isHidden = password.type === "password";
    password.type = isHidden ? "text" : "password";
    this.classList.toggle("bi-eye", isHidden);
    this.classList.toggle("bi-eye-slash", !isHidden);
});

function showError(input, message) {
    const inputGroup = input.closest(".input-group");
    inputGroup.classList.add("error");

    let errorTooltip = inputGroup.querySelector(".error-tooltip");
    if (!errorTooltip) {
        errorTooltip = document.createElement("div");
        errorTooltip.className = "error-tooltip";
        inputGroup.appendChild(errorTooltip);
    }

    errorTooltip.textContent = message;
    errorTooltip.style.display = "flex";
}

function hideErrors() {
    document.querySelectorAll(".input-group").forEach(group => {
        group.classList.remove("error");
    });
    document.querySelectorAll(".error-tooltip").forEach(e => {
        e.style.display = "none";
    });
}

[email, password].forEach(input => {
    input?.addEventListener("input", () => {
        input.parentElement.classList.remove("error");
        const tooltip = input.parentElement.querySelector(".error-tooltip");
        if (tooltip) tooltip.style.display = "none";
    });
});

loginForm?.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideErrors();

    const allowedDomain = /^[a-zA-Z0-9._%+-]+@caloocan\.sti\.edu\.ph$/;
    let hasError = false;

    if (!email.value.trim()) {
        showError(email, "Please fill out this field.");
        hasError = true;
    } else if (!allowedDomain.test(email.value)) {
        showError(email, "Invalid STI email.");
        hasError = true;
    }

    if (!password.value) {
        showError(password, "Please fill out this field.");
        hasError = true;
    }

    if (hasError) return;

    loginInProgress = true;
    try {
        // Do not persist an authenticated session until PIN verification succeeds.
        await setPersistence(auth, inMemoryPersistence);
        localStorage.removeItem(VERIFIED_KEY);
        sessionStorage.removeItem(VERIFIED_KEY);
        const archiveRef = collection(db, "archivedUsers");
        const q = query(archiveRef, where("email", "==", email.value));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            showPopup("Your account has been archived. You cannot log in.");
            return;
        }

        // Validate credentials before initiating OTP
        await signInWithEmailAndPassword(auth, email.value, password.value);
        
        // Credentials valid, initiate OTP
        await handleLoginAttempt(email.value);

    } catch (error) {
        await signOut(auth).catch(() => {});
        console.error("Login error:", error.code);
        switch (error.code) {
            case "auth/invalid-credential":
                const emailGroup = email.closest(".input-group");
                const passGroup = password.closest(".input-group");
                emailGroup.classList.add("error");
                passGroup.classList.add("error");
                showError(password, "Invalid email or password.");
                break;
            case "auth/too-many-requests":
                showPopup("Too many attempts. Try again later.");
                break;
            default:
                showPopup("Login failed. Please try again.");
        }
    } finally {
        loginInProgress = false;
    }
});

document.addEventListener("DOMContentLoaded", () => {
    let clickCount = 0;
    const logo = document.querySelector(".logo-container");

    logo?.addEventListener("click", () => {
        clickCount++;
        if (clickCount === 5) {
            window.location.href = "../SuperAdmin/SuperAdmim.html";
            clickCount = 0;
        }
    });
});

const reset = document.getElementById("forgotPasswordLink");

function toggleFeedbackPopup(show) {
    const popup = document.getElementById("emailFeedbackPopup");
    if (popup) popup.style.display = show ? "flex" : "none";
}

document.getElementById("closeFeedbackBtn")?.addEventListener("click", function() {
    toggleFeedbackPopup(false);
});

reset?.addEventListener("click", function(event) {
    event.preventDefault();
    const emailValue = document.getElementById("email").value;
    if (!emailValue) {
        alert("Please enter your email address.");
        return;
    }
    sendPasswordResetEmail(auth, emailValue)
        .then(() => {
            const forgotPopup = document.getElementById("forgotPopup");
            if (forgotPopup) forgotPopup.style.display = "none";
            toggleFeedbackPopup(true);
        })
        .catch((error) => {
            if (error.code === 'auth/user-not-found') {
                alert("Account not found. Please check the email address or sign up.");
            } else {
                alert("Error: " + error.message);
            }
        });
});

emailjs.init({ publicKey: "SZvtmcDCW3hy4qm5v" });

async function handleLoginAttempt(userEmail) {
    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    otpExpiresAt = Date.now() + 15 * 60 * 1000;
    try {
        await emailjs.send("service_ixe2e5j", "template_kvlen8d", {
            email: userEmail,
            passcode: generatedOtp,
            time: "15 minutes"
        });
     document.getElementById("otpPopup").style.display = "flex";
    } catch (error) {
        console.error("Email failed:", error);
        await signOut(auth).catch(() => {});
        generatedOtp = "";
        showPopup("Failed to send PIN. Please check your internet.");
    }
}

document.getElementById("verifyOtpBtn")?.addEventListener("click", async () => {
    const verifyButton = document.getElementById("verifyOtpBtn");
    const entered = document.getElementById("otpInput").value.trim();
    if (!generatedOtp || !auth.currentUser || Date.now() > otpExpiresAt) {
        alert("The PIN expired. Please sign in again.");
        await signOut(auth);
        document.getElementById("otpPopup").style.display = "none";
        return;
    }
    if (entered !== generatedOtp) {
        alert("Invalid PIN. Please try again.");
        return;
    }

    verifyButton.disabled = true;
    try {
        const shouldRemember = rememberMe?.checked === true;
        await setPersistence(auth, shouldRemember ? browserLocalPersistence : browserSessionPersistence);
        const storage = shouldRemember ? localStorage : sessionStorage;
        localStorage.removeItem(VERIFIED_KEY);
        sessionStorage.removeItem(VERIFIED_KEY);
        storage.setItem(VERIFIED_KEY, auth.currentUser.uid);
        generatedOtp = "";
        window.location.replace(DASHBOARD_URL);
    } catch (error) {
        console.error("Unable to finish login:", error);
        showPopup("Could not save your login session. Please try again.");
    } finally {
        verifyButton.disabled = false;
    }
});