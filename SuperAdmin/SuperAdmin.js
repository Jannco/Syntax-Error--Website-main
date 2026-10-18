
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";

import {
    getFirestore,
    collection,
    getDocs,
    deleteDoc,
    doc,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// =====================================================
// FIREBASE CONFIGURATION
// =====================================================

const firebaseConfig = {
    apiKey: "AIzaSyCEK9ungYl1PkiqgLkWJPCtNXAsQ3c6xxc",
    authDomain: "syntaxerror-data.firebaseapp.com",
    projectId: "syntaxerror-data",
    storageBucket: "syntaxerror-data.firebasestorage.app",
    messagingSenderId: "513961059475",
    appId: "1:513961059475:web:fbf6f471357465dbaad966"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// =====================================================
// HTML REFERENCES
// =====================================================

const table = document.getElementById("userTable");
const approvedTable = document.getElementById("approvedTable");

const logoutBtn = document.getElementById("logoutBtn");

const sectionModal = document.getElementById("sectionModal");
const sectionInput = document.getElementById("sectionInput");
const saveSectionBtn = document.getElementById("saveSectionBtn");
const cancelSectionBtn = document.getElementById("cancelSectionBtn");

const addBtn = document.querySelector(".add-btn");

const loadingOverlay = document.getElementById("loading-overlay");

const selectAllPending =
    document.getElementById("selectAllPending");

let usersData = [];

// =====================================================
// LOADING OVERLAY
// =====================================================

function toggleLoading(show) {
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? "flex" : "none";
    }
}

// =====================================================
// REGISTRATION DATE FORMAT
// =====================================================

function formatRegistrationDate(data) {

    const timestamp =
        data.createdAt ??
        data.registeredAt ??
        data.registrationDate ??
        data.dateRegistered ??
        data.timestamp ??
        null;

    if (!timestamp) {
        return "Not available";
    }

    try {

        let date;

        // Firestore Timestamp
        if (typeof timestamp.toDate === "function") {
            date = timestamp.toDate();
        }

        // Firestore Timestamp stored as an object
        else if (typeof timestamp.seconds === "number") {
            date = new Date(timestamp.seconds * 1000);
        }

        // Timestamp in milliseconds or Unix seconds
        else if (typeof timestamp === "number") {
            date = new Date(
                timestamp < 100000000000
                    ? timestamp * 1000
                    : timestamp
            );
        }

        // ISO date string
        else {
            date = new Date(timestamp);
        }

        if (isNaN(date.getTime())) {
            return "Not available";
        }

        return new Intl.DateTimeFormat("en-PH", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        }).format(date);

    } catch (error) {

        console.error("Date formatting error:", error);

        return "Not available";
    }
}

// =====================================================
// SELECT ALL PENDING USERS
// =====================================================

if (selectAllPending) {

    selectAllPending.addEventListener("change", () => {

        const checkboxes =
            document.querySelectorAll(".pendingCheck");

        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllPending.checked;
        });

    });

}

// Update Select All checkbox when individual users change
document.addEventListener("change", (event) => {

    if (!event.target.classList.contains("pendingCheck")) {
        return;
    }

    const checkboxes = [
        ...document.querySelectorAll(".pendingCheck")
    ];

    if (!selectAllPending) return;

    selectAllPending.checked =
        checkboxes.length > 0 &&
        checkboxes.every(checkbox => checkbox.checked);

    selectAllPending.indeterminate =
        checkboxes.some(checkbox => checkbox.checked) &&
        !checkboxes.every(checkbox => checkbox.checked);
});

// =====================================================
// LOAD PENDING USERS
// =====================================================

async function loadUsers() {

    if (!table) return;

    const snapshot = await getDocs(
        collection(db, "pendingUsers")
    );

    table.innerHTML = "";
    usersData = [];

    if (selectAllPending) {
        selectAllPending.checked = false;
        selectAllPending.indeterminate = false;
    }

    if (snapshot.empty) {

        table.innerHTML = `
            <tr>
                <td colspan="4"
                    style="
                        text-align:center;
                        padding:20px;
                        color:gray;
                    ">
                    No pending users found.
                </td>
            </tr>
        `;

        return;
    }

    snapshot.forEach(docSnap => {

        const data = docSnap.data();

        usersData.push({
            id: docSnap.id,
            ...data
        });

        const registrationDate =
            formatRegistrationDate(data);

        const row = document.createElement("tr");

        // Checkbox
        const checkboxCell = document.createElement("td");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "pendingCheck";
        checkbox.dataset.id = docSnap.id;

        checkboxCell.appendChild(checkbox);

        // Email
        const emailCell = document.createElement("td");
        emailCell.textContent = data.email || "No email";

        // Registration Date
        const dateCell = document.createElement("td");
        dateCell.textContent = registrationDate;

        // Status
        const statusCell = document.createElement("td");
        statusCell.textContent = data.status || "pending";

        row.appendChild(checkboxCell);
        row.appendChild(emailCell);
        row.appendChild(dateCell);
        row.appendChild(statusCell);

        table.appendChild(row);

    });

}

// =====================================================
// LOGOUT POPUP
// =====================================================

window.showLogoutPopup = function() {

    const popup = document.getElementById("logout-popup");

    if (popup) {
        popup.style.display = "flex";
    }

};

window.closeLogoutPopup = function() {

    const popup = document.getElementById("logout-popup");

    if (popup) {
        popup.style.display = "none";
    }

};

window.logoutUser = async function() {

    toggleLoading(true);

    try {

        await signOut(auth);

        window.location.href =
            "../Components/LogIn.html";

    } catch (error) {

        console.error("Logout Error:", error);

        alert("Sign out failed. Please try again.");

    } finally {

        toggleLoading(false);

    }

};

// =====================================================
// FETCH SECTIONS
// =====================================================

async function getSections() {

    const snapshot = await getDocs(
        collection(db, "sections")
    );

    const sections = [
        {
            id: null,
            name: "No Section"
        }
    ];

    snapshot.forEach(docSnap => {

        const data = docSnap.data();

        sections.push({
            id: docSnap.id,
            name: data.name
        });

    });

    return sections;
}

// =====================================================
// LOAD APPROVED USERS
// =====================================================

async function loadApprovedUsers() {

    if (!approvedTable) return;

    const snapshot = await getDocs(
        collection(db, "approvedUsers")
    );

    const sections = await getSections();

    approvedTable.innerHTML = "";

    if (snapshot.empty) {

        approvedTable.innerHTML = `
            <tr>
                <td colspan="4"
                    style="
                        text-align:center;
                        padding:20px;
                        color:gray;
                    ">
                    No approved users found.
                </td>
            </tr>
        `;

        return;
    }

    snapshot.forEach(docSnap => {

        const data = docSnap.data();

        const row = document.createElement("tr");

        // Checkbox
        const selectCell = document.createElement("td");

        const selectCheckbox = document.createElement("input");
        selectCheckbox.type = "checkbox";
        selectCheckbox.className = "approvedCheck";
        selectCheckbox.dataset.id = docSnap.id;

        selectCell.appendChild(selectCheckbox);

        // Email
        const emailCell = document.createElement("td");
        emailCell.textContent = data.email || "";

        // Sections
        const sectionCell = document.createElement("td");
        const sectionContainer = document.createElement("div");

        sectionContainer.className = "vertical-content";

        const assignedSections =
            Array.isArray(data.section)
                ? data.section
                : [];

        sections.forEach(section => {

            const label = document.createElement("label");
            const checkbox = document.createElement("input");

            checkbox.type = "checkbox";
            checkbox.value = section.name;

            checkbox.checked =
                assignedSections.includes(section.name);

            label.appendChild(checkbox);
            label.appendChild(
                document.createTextNode(section.name)
            );

            sectionContainer.appendChild(label);

        });

        sectionCell.appendChild(sectionContainer);

        // Save Button
        const saveCell = document.createElement("td");

        const saveButton = document.createElement("button");

        saveButton.className = "saveBtn";
        saveButton.dataset.id = docSnap.id;
        saveButton.textContent = "Save";

        saveCell.appendChild(saveButton);

        row.appendChild(selectCell);
        row.appendChild(emailCell);
        row.appendChild(sectionCell);
        row.appendChild(saveCell);

        approvedTable.appendChild(row);

    });

}

// =====================================================
// INITIALIZE DASHBOARD
// =====================================================

async function initializeDashboard() {

    toggleLoading(true);

    try {

        await Promise.all([
            loadUsers(),
            loadApprovedUsers()
        ]);

    } catch (error) {

        console.error("Initialization Error:", error);

        alert("Unable to load dashboard data.");

    } finally {

        toggleLoading(false);

    }

}

// =====================================================
// CONFIRMATION POPUP
// =====================================================

function showConfirm(message) {

    return new Promise(resolve => {

        const modal =
            document.getElementById("confirmModal");

        const text =
            document.getElementById("modalText");

        const yesBtn =
            document.getElementById("confirmYes");

        const noBtn =
            document.getElementById("confirmNo");

        // Use the existing action popup if available
        const actionPopup =
            document.getElementById("action-popup");

        if (
            modal &&
            text &&
            yesBtn &&
            noBtn
        ) {

            text.textContent = message;
            modal.classList.remove("hidden");

            yesBtn.onclick = () => {
                modal.classList.add("hidden");
                resolve(true);
            };

            noBtn.onclick = () => {
                modal.classList.add("hidden");
                resolve(false);
            };

            return;
        }

        if (actionPopup) {

            const actionText =
                document.getElementById("action-text");

            const actionTitle =
                document.getElementById("action-title");

            const confirmButton =
                actionPopup.querySelector(
                    "#confirm-action-btn"
                );

            const cancelButton =
                actionPopup.querySelector(
                    ".logout-btns button"
                );

            if (
                actionText &&
                confirmButton &&
                cancelButton
            ) {

                if (actionTitle) {
                    actionTitle.textContent =
                        "Confirm Action";
                }

                actionText.textContent = message;

                actionPopup.style.display = "flex";

                confirmButton.onclick = () => {
                    actionPopup.style.display = "none";
                    resolve(true);
                };

                cancelButton.onclick = () => {
                    actionPopup.style.display = "none";
                    resolve(false);
                };

                return;
            }

        }

        resolve(window.confirm(message));

    });

}

// =====================================================
// BULK APPROVE USERS
// =====================================================

document.getElementById("bulkApprove")
    ?.addEventListener("click", async () => {

        const ids = [
            ...document.querySelectorAll(
                ".pendingCheck:checked"
            )
        ].map(checkbox => checkbox.dataset.id);

        if (ids.length === 0) {
            alert("No users selected.");
            return;
        }

        const confirmed = await showConfirm(
            "Approve selected users and create their login accounts?"
        );

        if (!confirmed) return;

        toggleLoading(true);

        let approvedCount = 0;
        let failedCount = 0;

        for (const id of ids) {

            const user = usersData.find(
                item => item.id === id
            );

            if (!user) continue;

            try {

                await createUserWithEmailAndPassword(
                    auth,
                    user.email,
                    user.password
                );

                // Do not copy the password into approvedUsers.
                await setDoc(
                    doc(db, "approvedUsers", id),
                    {
                        email: user.email,
                        section: ["No Section"],
                        status: "approved",
                        createdAt:
                            user.createdAt ??
                            user.registeredAt ??
                            user.registrationDate ??
                            user.dateRegistered ??
                            user.timestamp ??
                            null
                    }
                );

                await deleteDoc(
                    doc(db, "pendingUsers", id)
                );

                approvedCount++;

            } catch (error) {

                if (
                    error.code ===
                    "auth/email-already-in-use"
                ) {

                    try {

                        await setDoc(
                            doc(db, "approvedUsers", id),
                            {
                                email: user.email,
                                section: ["No Section"],
                                status: "approved",
                                createdAt:
                                    user.createdAt ??
                                    user.registeredAt ??
                                    user.registrationDate ??
                                    user.dateRegistered ??
                                    user.timestamp ??
                                    null
                            }
                        );

                        await deleteDoc(
                            doc(db, "pendingUsers", id)
                        );

                        approvedCount++;

                    } catch (saveError) {

                        console.error(
                            "Approval save error:",
                            saveError
                        );

                        failedCount++;
                    }

                } else {

                    console.error(
                        "Approval error:",
                        error
                    );

                    failedCount++;
                }

            }

        }

        await initializeDashboard();

        alert(
            `Approval complete.\n` +
            `Approved: ${approvedCount}\n` +
            `Failed: ${failedCount}`
        );

    });

// =====================================================
// BULK REJECT USERS
// =====================================================

document.getElementById("bulkReject")
    ?.addEventListener("click", async () => {

        const ids = [
            ...document.querySelectorAll(
                ".pendingCheck:checked"
            )
        ].map(checkbox => checkbox.dataset.id);

        if (ids.length === 0) {
            alert("No users selected.");
            return;
        }

        const confirmed = await showConfirm(
            "Are you sure you want to reject the selected users?"
        );

        if (!confirmed) return;

        toggleLoading(true);

        let rejectedCount = 0;

        try {

            for (const id of ids) {

                await deleteDoc(
                    doc(db, "pendingUsers", id)
                );

                rejectedCount++;

            }

        } catch (error) {

            console.error("Rejection error:", error);

            alert("Some users could not be rejected.");

        } finally {

            await initializeDashboard();

        }

        if (rejectedCount > 0) {

            alert(
                `${rejectedCount} user(s) rejected successfully.`
            );

        }

    });

// =====================================================
// ADD SECTION
// =====================================================

if (addBtn && sectionModal && sectionInput) {

    addBtn.onclick = () => {

        sectionInput.value = "";
        sectionModal.classList.remove("hidden");

    };

}

if (cancelSectionBtn && sectionModal) {

    cancelSectionBtn.onclick = () => {

        sectionModal.classList.add("hidden");

    };

}

if (saveSectionBtn) {

    saveSectionBtn.onclick = async () => {

        if (!sectionInput) return;

        const name = sectionInput.value.trim();

        if (!name) {
            alert("Enter section name.");
            return;
        }

        toggleLoading(true);

        try {

            await setDoc(
                doc(collection(db, "sections")),
                { name }
            );

            if (sectionModal) {
                sectionModal.classList.add("hidden");
            }

            await initializeDashboard();

        } catch (error) {

            console.error("Section save error:", error);

            alert("Unable to save section.");

        } finally {

            toggleLoading(false);

        }

    };

}

// =====================================================
// SAVE USER SECTIONS
// =====================================================

document.addEventListener("click", async event => {

    if (
        !event.target.classList.contains("saveBtn")
    ) {
        return;
    }

    const button = event.target;

    const id = button.dataset.id;

    const checkboxes =
        button.closest("tr").querySelectorAll(
            ".vertical-content input[type='checkbox']"
        );

    const selected = [
        ...checkboxes
    ]
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    button.disabled = true;

    toggleLoading(true);

    try {

        await updateDoc(
            doc(db, "approvedUsers", id),
            {
                section: selected
            }
        );

        alert("Section updated successfully!");

    } catch (error) {

        console.error("Section update error:", error);

        alert("Unable to update section.");

    } finally {

        button.disabled = false;

        toggleLoading(false);

    }

});

// =====================================================
// THEME TOGGLE
// =====================================================

function initializeTheme() {

    const themeToggle =
        document.getElementById("themeToggle");

    const themeIcon =
        document.getElementById("themeIcon");

    const html = document.documentElement;

    const savedTheme =
        localStorage.getItem("theme") || "light";

    html.setAttribute("data-theme", savedTheme);

    function updateThemeIcon() {

        if (!themeIcon) return;

        const isDark =
            html.getAttribute("data-theme") === "dark";

        themeIcon.classList.toggle(
            "bi-sun",
            isDark
        );

        themeIcon.classList.toggle(
            "bi-moon",
            !isDark
        );

    }

    updateThemeIcon();

    if (themeToggle) {

        themeToggle.addEventListener("click", () => {

            const currentTheme =
                html.getAttribute("data-theme");

            const newTheme =
                currentTheme === "dark"
                    ? "light"
                    : "dark";

            html.setAttribute(
                "data-theme",
                newTheme
            );

            localStorage.setItem(
                "theme",
                newTheme
            );

            updateThemeIcon();

        });

    }

}

// =====================================================
// START DASHBOARD
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    initializeTheme();

    initializeDashboard();

});
