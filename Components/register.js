// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCEK9ungYl1PkiqgLkWJPCtNXAsQ3c6xxc",
    authDomain: "syntaxerror-data.firebaseapp.com",
    projectId: "syntaxerror-data",
    storageBucket: "syntaxerror-data.firebasestorage.app",
    messagingSenderId: "513961059475",
    appId: "1:513961059475:web:fbf6f471357465dbaad966"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const togglePassword = document.getElementById("togglePassword");
const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");
const signupForm = document.getElementById("signupForm");
const popup = document.getElementById("popup");
const popupMessage = document.getElementById("popup-message");

// Terms and Conditions Elements
const termsCheckbox = document.getElementById("termsCheckbox");
const termsError = document.getElementById("termsError");
const viewTerms = document.getElementById("viewTerms");
const termsModal = document.getElementById("termsModal");
const closeTerms = document.getElementById("closeTerms");

const emailPattern = /^[a-zA-Z0-9._%+-]+@caloocan\.sti\.edu\.ph$/;
const passwordPattern = /^.{8,}$/; 

// --- TERMS AND CONDITIONS MODAL LOGIC ---
viewTerms.addEventListener("click", (e) => {
    e.preventDefault();
    termsModal.style.display = "flex"; // Fixed: added quotes
});

closeTerms.addEventListener("click", () => {
    termsModal.style.display = "none"; // Fixed: added quotes
});

window.addEventListener("click", (e) => {
    if (e.target === termsModal) {
        termsModal.style.display = "none"; // Fixed: added quotes
    }
});

// --- PASSWORD TOGGLE ---
const setupToggle = (btn, input) => {
    if (!btn || !input) return;
    btn.addEventListener("click", () => {
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        btn.classList.toggle("bi-eye", isHidden);
        btn.classList.toggle("bi-eye-slash", !isHidden);
    });
};
setupToggle(togglePassword, password);
setupToggle(toggleConfirmPassword, confirmPassword);

// --- ERROR HANDLING ---
function showError(input, message) {
    const group = input.closest(".input-group");
    group.classList.add("error");
    
    let error = group.querySelector(".error-tooltip");
    if (!error) {
        error = document.createElement("div");
        error.className = "error-tooltip";
        group.appendChild(error);
    }
    error.textContent = message;
    error.style.display = "flex";
}

function hideErrors() {
    document.querySelectorAll(".input-group").forEach(group => group.classList.remove("error"));
    document.querySelectorAll(".error-tooltip").forEach(e => e.remove());
    if(termsError) termsError.style.display = "none";
}

// Clear error on input
[email, password, confirmPassword].forEach(input => {
    input.addEventListener("input", () => {
        const group = input.closest(".input-group");
        group.classList.remove("error");
        const tooltip = group.querySelector(".error-tooltip");
        if (tooltip) tooltip.remove();
    });
});

// --- SIGNUP LOGIC ---
signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideErrors();

    const emailValue = email.value.trim();
    const pass = password.value;
    const confirm = confirmPassword.value;
    let hasError = false;

    // Email Validation
    if (!emailValue) { 
        showError(email, "Email is required."); 
        hasError = true; 
    } else if (!emailPattern.test(emailValue)) { 
        showError(email, "Use @caloocan.sti.edu.ph email."); 
        hasError = true; 
    }

    // Password Validation (8 characters min)
    if (!pass) { 
        showError(password, "Password is required."); 
        hasError = true; 
    } else if (!passwordPattern.test(pass)) { 
        showError(password, "Password must be at least 8 characters."); 
        hasError = true; 
    }

    // Confirm Password
    if (!confirm) { 
        showError(confirmPassword, "Please confirm your password."); 
        hasError = true; 
    } else if (pass !== confirm) { 
        showError(confirmPassword, "Passwords do not match."); 
        hasError = true; 
    }

    // Terms Validation
    if (!termsCheckbox.checked) {
        termsError.style.display = "block";
        termsError.style.color = "#dc3545"; 
        termsError.style.fontSize = "12px";
        termsError.style.marginTop = "5px";
        hasError = true;
    }

    if (hasError) return;

    // --- CHECK FIREBASE FOR DUPLICATES ---
    try {
        const collections = ["approvedUsers", "pendingUsers", "archivedUsers"];
        let userExists = false;

        for (const colName of collections) {
            const q = query(collection(db, colName), where("email", "==", emailValue));
            const snap = await getDocs(q);
            if (!snap.empty) { userExists = true; break; }
        }

        if (userExists) {
            showError(email, "Account already exists or is pending.");
            return;
        }
    } catch (err) {
        console.error("Database check failed:", err);
        return;
    }

    // --- SHOW CONFIRMATION POPUP ---
    if (!popup) return console.error("Popup element missing in HTML");
    
    popup.style.display = "flex";
    popupMessage.textContent = "Are you sure you want to create this account?";

    // Reset buttons
    popup.querySelectorAll(".choice-btn").forEach(btn => btn.remove());
    const popupContent = popup.querySelector(".popup-content");

    const yesBtn = document.createElement("button");
    yesBtn.textContent = "Yes, Submit";
    yesBtn.className = "choice-btn yes-btn";

    const noBtn = document.createElement("button");
    noBtn.textContent = "No, Cancel";
    noBtn.className = "choice-btn no-btn";

    popupContent.appendChild(yesBtn);
    popupContent.appendChild(noBtn);

    // YES → SAVE TO FIRESTORE
    yesBtn.onclick = async () => {
        yesBtn.disabled = true;
        yesBtn.textContent = "Processing...";
        noBtn.style.display = "none";

        try {
            await addDoc(collection(db, "pendingUsers"), {
                email: emailValue,
                password: pass, 
                status: "pending",
                createdAt: serverTimestamp()
            });

            // SUCCESS UI
            popupMessage.innerHTML = `<i class="bi bi-check-circle-fill" style="color:#005bab; font-size:2rem; display:block; margin-bottom:10px;"></i>
                                      Request submitted!<br>Please wait for Admin approval.`;
            yesBtn.remove();
            
            const closeBtn = document.createElement("button");
            closeBtn.textContent = "Back to Login";
            closeBtn.className = "choice-btn yes-btn";
            closeBtn.onclick = () => window.location.href = "login.html";
            popupContent.appendChild(closeBtn);

        } catch (error) {
            popupMessage.textContent = "Error: " + error.message;
            yesBtn.disabled = false;
            yesBtn.textContent = "Try Again";
            noBtn.style.display = "inline-block";
        }
    };

    // NO → CLOSE
    noBtn.onclick = () => {
        popup.style.display = "none";
    };
});