// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    setDoc, 
    deleteDoc, 
    doc, 
    updateDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signOut,
    sendPasswordResetEmail // Added for password reset functionality
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// Firebase Config
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

// --- ELEMENTS ---
const approvedTable = document.getElementById("approvedTable");
const removeUsersBtn = document.getElementById("removeUsersBtn");
const openArchiveBtn = document.getElementById("openArchiveBtn");
const addSectionBtn = document.getElementById("addSectionBtn");
const editSectionBtn = document.getElementById("editSection");
const removeSectionBtn = document.getElementById("archiveSectiom"); 
const archiveSectionBtn = document.getElementById("archiveSec"); 
const sectionModal = document.getElementById("sectionModal");
const sectionInput = document.getElementById("sectionInput");
const saveSectionBtn = document.getElementById("saveSectionBtn");
const cancelSectionBtn = document.getElementById("cancelSectionBtn");
const loadingOverlay = document.getElementById("loading-overlay");
const resetPasswordBtn = document.getElementById("resetPasswordBtn"); // New Element

// --- LOADING HELPER ---
const toggleLoading = (show) => {
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? "flex" : "none";
    }
};

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
         window.location.href = '../Components/LogIn.html';
    } catch (error) {
        console.error("Logout Error:", error);
        alert("Sign out failed. Please try again.");
    } finally {
        toggleLoading(false);
    }
};

// --- MODALS ---

// 1. Remove Section Modal
const deleteSectionModal = document.createElement("div");
deleteSectionModal.className = "modal hidden";
deleteSectionModal.innerHTML = `
    <div class="modal-box">
        <h3>Remove Sections</h3>
        <p style="font-size:0.8rem; color:gray; margin-bottom:10px;">Archiving sections unassigns them from users.</p>
        <div id="deleteSectionList"></div>
        <div class="modal-actions">
            <button id="confirmDeleteSections" class="approve">Remove Selected</button>
            <button id="cancelDeleteSections" class="reject">Cancel</button>
        </div>
    </div>
`;
document.body.appendChild(deleteSectionModal);
const deleteSectionList = deleteSectionModal.querySelector("#deleteSectionList");
const confirmDeleteSections = deleteSectionModal.querySelector("#confirmDeleteSections");
const cancelDeleteSections = deleteSectionModal.querySelector("#cancelDeleteSections");

// 2. Archive View Modal
const viewArchiveModal = document.createElement("div");
viewArchiveModal.className = "modal hidden";
viewArchiveModal.innerHTML = `
    <div class="modal-box">
        <h3 id="archiveModalTitle">Archived Items</h3>
        <p id="archiveMessage" style="font-size:0.85rem; color:#d9534f; margin-bottom:10px; font-weight:bold;"></p>
        <div id="dynamicArchiveList" style="margin: 15px 0; max-height: 250px; overflow-y: auto;"></div>
        <div class="modal-actions">
            <button id="closeArchiveView" class="reject">Close</button>
        </div>
    </div>
`;
document.body.appendChild(viewArchiveModal);
const dynamicArchiveList = viewArchiveModal.querySelector("#dynamicArchiveList");
const archiveModalTitle = viewArchiveModal.querySelector("#archiveModalTitle");
const archiveMessage = viewArchiveModal.querySelector("#archiveMessage");
const closeArchiveView = viewArchiveModal.querySelector("#closeArchiveView");

// 3. Edit Section Modal
const editSectionModal = document.createElement("div");
editSectionModal.className = "modal hidden";
editSectionModal.innerHTML = `
    <div class="modal-box">
        <h3>Edit Section</h3>
        <div id="editSectionList"></div>
        <div class="modal-actions">
            <button id="confirmEditSections" class="approve">Save Changes</button>
            <button id="cancelEditSections" class="reject">Cancel</button>
        </div>
    </div>
`;
document.body.appendChild(editSectionModal);
const editSectionList = editSectionModal.querySelector("#editSectionList");
const confirmEditSections = editSectionModal.querySelector("#confirmEditSections");
const cancelEditSections = editSectionModal.querySelector("#cancelEditSections");

let sections = [{ id: null, name: "No Section" }];

// --- UTILS ---
async function showCustomConfirm(message) {
    return new Promise(resolve => {
        const modal = document.createElement("div");
        modal.className = "custom-confirm";
        modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999";
        modal.innerHTML = `
            <div class="modal-box" style="background:white;padding:20px;border-radius:10px;min-width:300px;text-align:center;">
                <p>${message}</p>
                <div style="margin-top:15px; display:flex; justify-content:center; gap:10px;">
                    <button class="approve yesBtn">Yes</button>
                    <button class="reject noBtn">No</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector(".yesBtn").onclick = () => { document.body.removeChild(modal); resolve(true); };
        modal.querySelector(".noBtn").onclick = () => { document.body.removeChild(modal); resolve(false); };
    });
}

async function loadSections() {
    const snapshot = await getDocs(collection(db, "sections"));
    sections = [{ id: null, name: "No Section" }];
    snapshot.forEach(docSnap => sections.push({ id: docSnap.id, name: docSnap.data().name }));
}

// --- USER ARCHIVE ---
openArchiveBtn?.addEventListener("click", async () => {
    archiveModalTitle.textContent = "Archived Users";
    archiveMessage.textContent = "Users must be restored to re-enable their login access.";
    dynamicArchiveList.innerHTML = "Loading...";
    viewArchiveModal.classList.remove("hidden");

    const snapshot = await getDocs(collection(db, "archivedUsers"));
    dynamicArchiveList.innerHTML = "";

    if (snapshot.empty) {
        dynamicArchiveList.innerHTML = "<p style='text-align:center;'>No archived users.</p>";
        return;
    }

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const div = document.createElement("div");
        div.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;";
        div.innerHTML = `
            <div>
                <strong>${data.email}</strong>
                <small style="display:block; color:gray;">Section: ${(data.section || []).join(", ")}</small>
            </div>
            <button class="approve restore-user-btn" data-id="${docSnap.id}">Restore & Auth</button>
        `;
        dynamicArchiveList.appendChild(div);
    });

    dynamicArchiveList.querySelectorAll(".restore-user-btn").forEach(btn => {
        btn.onclick = async () => {
            const docId = btn.dataset.id;
            const snap = await getDoc(doc(db, "archivedUsers", docId));
            const userData = snap.data();

            const confirm = await showCustomConfirm(`Restore ${userData.email} and re-create Authentication account?`);
            if (!confirm) return;

            toggleLoading(true);
            try {
                await createUserWithEmailAndPassword(auth, userData.email, userData.password);
                await setDoc(doc(db, "approvedUsers", docId), userData);
                await deleteDoc(doc(db, "archivedUsers", docId));

                alert("User successfully restored and authenticated!");
                viewArchiveModal.classList.add("hidden");
                await initializeDashboard();
            } catch (error) {
                if (error.code === "auth/email-already-in-use") {
                    await setDoc(doc(db, "approvedUsers", docId), userData);
                    await deleteDoc(doc(db, "archivedUsers", docId));
                    await initializeDashboard();
                } else {
                    alert("Auth Error: " + error.message);
                }
            } finally {
                toggleLoading(false);
            }
        };
    });
});

// --- SECTION ARCHIVE ---
archiveSectionBtn?.addEventListener("click", async () => {
    archiveModalTitle.textContent = "Archived Sections";
    archiveMessage.textContent = "Items will be permanently deleted if not restored within 7 days.";
    dynamicArchiveList.innerHTML = "Loading...";
    viewArchiveModal.classList.remove("hidden");
    
    const snapshot = await getDocs(collection(db, "archivedSections"));
    dynamicArchiveList.innerHTML = "";

    if (snapshot.empty) {
        dynamicArchiveList.innerHTML = "<p style='text-align:center;'>Archive is empty</p>";
        return;
    }

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const div = document.createElement("div");
        div.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;";
        div.innerHTML = `<span>${data.name}</span><button class="approve restore-sec-btn" data-id="${docSnap.id}" data-name="${data.name}">Restore</button>`;
        dynamicArchiveList.appendChild(div);
    });

    dynamicArchiveList.querySelectorAll(".restore-sec-btn").forEach(btn => {
        btn.onclick = async () => {
            if (await showCustomConfirm(`Restore section "${btn.dataset.name}"?`)) {
                toggleLoading(true);
                await setDoc(doc(collection(db, "sections")), { name: btn.dataset.name });
                await deleteDoc(doc(db, "archivedSections", btn.dataset.id));
                viewArchiveModal.classList.add("hidden");
                await initializeDashboard();
                toggleLoading(false);
            }
        };
    });
});

closeArchiveView?.addEventListener("click", () => viewArchiveModal.classList.add("hidden"));

// --- SECTION MANAGEMENT ---
addSectionBtn?.addEventListener("click", () => {
    sectionInput.value = "";
    sectionModal.classList.remove("hidden");
});

saveSectionBtn?.addEventListener("click", async () => {
    const name = sectionInput.value.trim();
    if (!name) return alert("Enter section name");

    const isDuplicate = sections.some(s => s.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) return alert(`The section "${name}" already exists!`);

    toggleLoading(true);
    await setDoc(doc(collection(db, "sections")), { name });
    sectionModal.classList.add("hidden");
    await initializeDashboard();
    toggleLoading(false);
});

editSectionBtn?.addEventListener("click", async () => {
    toggleLoading(true);
    await loadSections();
    toggleLoading(false);
    editSectionList.innerHTML = "";
    sections.filter(s => s.id).forEach(sec => {
        const label = document.createElement("label");
        label.style.cssText = "display:flex; align-items:center; margin-bottom:8px;";
        label.innerHTML = `
            <input type="radio" name="editSectionRadio" value="${sec.id}" data-name="${sec.name}" style="margin-right:10px;">
            <span class="name-display">${sec.name}</span>
            <input type="text" class="edit-input" value="${sec.name}" style="display:none; flex:1; padding:5px;">
        `;
        const radio = label.querySelector('input[type="radio"]');
        radio.addEventListener("change", () => {
            editSectionList.querySelectorAll(".edit-input").forEach(i => i.style.display = "none");
            editSectionList.querySelectorAll(".name-display").forEach(s => s.style.display = "block");
            label.querySelector(".edit-input").style.display = "block";
            label.querySelector(".name-display").style.display = "none";
        });
        editSectionList.appendChild(label);
    });
    editSectionModal.classList.remove("hidden");
});

confirmEditSections?.addEventListener("click", async () => {
    const selected = editSectionList.querySelector("input[type='radio']:checked");
    if (!selected) return alert("Select a section");

    const newName = selected.parentElement.querySelector(".edit-input").value.trim();
    const oldName = selected.dataset.name;
    const sectionId = selected.value;

    if (!newName) return alert("Enter name");
    if (newName === oldName) return editSectionModal.classList.add("hidden");

    const isDuplicate = sections.some(s => s.id !== sectionId && s.name.toLowerCase() === newName.toLowerCase());
    if (isDuplicate) return alert(`Cannot rename to "${newName}" because that section already exists.`);

    toggleLoading(true);
    try {
        await updateDoc(doc(db, "sections", sectionId), { name: newName });
        const usersSnapshot = await getDocs(collection(db, "approvedUsers"));
        const updatePromises = usersSnapshot.docs.map(async (userDoc) => {
            const userData = userDoc.data();
            let userSections = userData.section || [];
            if (userSections.includes(oldName)) {
                const updatedSections = userSections.map(s => s === oldName ? newName : s);
                return updateDoc(doc(db, "approvedUsers", userDoc.id), { section: updatedSections });
            }
        });
        await Promise.all(updatePromises);
        editSectionModal.classList.add("hidden");
        await initializeDashboard();
    } catch (error) {
        console.error("Error:", error);
    } finally {
        toggleLoading(false);
    }
});

removeSectionBtn?.addEventListener("click", async () => {
    toggleLoading(true);
    await loadSections();
    toggleLoading(false);
    deleteSectionList.innerHTML = "";
    sections.filter(s => s.id).forEach(sec => {
        const label = document.createElement("label");
        label.style.display = "block";
        label.innerHTML = `<input type="checkbox" value="${sec.id}" data-name="${sec.name}"> ${sec.name}`;
        deleteSectionList.appendChild(label);
    });
    deleteSectionModal.classList.remove("hidden");
});

confirmDeleteSections?.addEventListener("click", async () => {
    const selected = Array.from(deleteSectionList.querySelectorAll("input:checked"));
    if (!selected.length || !(await showCustomConfirm(`Archive ${selected.length} sections?`))) return;

    toggleLoading(true);
    for (const cb of selected) {
        await setDoc(doc(collection(db, "archivedSections")), { name: cb.dataset.name, archivedAt: new Date().toISOString() });
        await deleteDoc(doc(db, "sections", cb.value));

        const usersSnapshot = await getDocs(collection(db, "approvedUsers"));
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            let userSections = userData.section || [];
            if (userSections.includes(cb.dataset.name)) {
                const updated = userSections.filter(s => s !== cb.dataset.name);
                await updateDoc(doc(db, "approvedUsers", userDoc.id), { section: updated.length ? updated : ["No Section"] });
            }
        }
    }
    deleteSectionModal.classList.add("hidden");
    await initializeDashboard();
    toggleLoading(false);
});

// --- PASSWORD RESET LOGIC ---
// Global to hold admin data for the modal
let allAdmins = [];

window.openAdminResetModal = async function() {
    const modal = document.getElementById("admin-reset-modal");
    const searchInput = document.getElementById("admin-search-input");
    const listSelect = document.getElementById("admin-list-select");

    // Reset UI
    document.getElementById("admin-step-1").style.display = "block";
    document.getElementById("admin-step-2").style.display = "none";
    searchInput.value = "";
    modal.style.display = "flex";

    toggleLoading(true);
    try {
        // Fetch all approved admins
        const snap = await getDocs(collection(db, "approvedUsers"));
        allAdmins = [];
        snap.forEach(doc => {
            allAdmins.push({ docId: doc.id, ...doc.data() });
        });

        renderAdminList(""); // Initial render
    } catch (error) {
        console.error("Error fetching admins:", error);
        alert("Failed to load admin list.");
    } finally {
        toggleLoading(false);
    }

    // Live search listener
    searchInput.oninput = (e) => renderAdminList(e.target.value.toLowerCase());
};

function renderAdminList(term) {
    const listSelect = document.getElementById("admin-list-select");
    listSelect.innerHTML = "";

    // Filter ONLY by email now
    const filtered = allAdmins.filter(a => 
        a.email && a.email.toLowerCase().includes(term)
    );

    if (filtered.length === 0) {
        listSelect.innerHTML = '<option disabled>No matching emails found...</option>';
    } else {
        filtered.forEach(admin => {
            const opt = document.createElement("option");
            opt.value = admin.docId;
            // Display only the email in the list
            opt.textContent = admin.email;
            listSelect.appendChild(opt);
        });
    }
}

window.confirmAdminSelection = function() {
    const docId = document.getElementById("admin-list-select").value;
    if (!docId) return alert("Please select an email from the list!");

    const admin = allAdmins.find(a => a.docId === docId);
    
    document.getElementById("admin-step-1").style.display = "none";
    document.getElementById("admin-step-2").style.display = "block";
    
    // Warning text now uses only the email
    document.getElementById("admin-confirm-text").innerHTML = 
        `You are changing the password for the account: <strong>${admin.email}</strong>. This will affect their login access immediately.`;

    document.getElementById("final-admin-reset-btn").onclick = () => saveAdminPassword(admin);
};

window.closeAdminResetModal = () => document.getElementById("admin-reset-modal").style.display = "none";

window.confirmAdminSelection = function() {
    const docId = document.getElementById("admin-list-select").value;
    if (!docId) return alert("Please select an admin account!");

    const admin = allAdmins.find(a => a.docId === docId);
    
    document.getElementById("admin-step-1").style.display = "none";
    document.getElementById("admin-step-2").style.display = "block";
    document.getElementById("admin-confirm-text").innerHTML = 
        `You are changing the password for <strong>${admin.name}</strong> (${admin.email}). This will affect their login access to the dashboard.`;

    document.getElementById("final-admin-reset-btn").onclick = () => saveAdminPassword(admin);
};

window.backToAdminStep1 = () => {
    document.getElementById("admin-step-1").style.display = "block";
    document.getElementById("admin-step-2").style.display = "none";
};

async function saveAdminPassword(admin) {
    const newPass = document.getElementById("admin-new-pass").value.trim();
    if (newPass.length < 6) return alert("Security Requirement: Admin passwords must be at least 6 characters.");

    toggleLoading(true);
    try {
        const adminRef = doc(db, "approvedUsers", admin.docId);
        await updateDoc(adminRef, {
            password: newPass
        });

        alert(`Successfully updated password for ${admin.name}.`);
        closeAdminResetModal();
    } catch (error) {
        console.error("Admin Update Error:", error);
        alert("Permission denied or connection error.");
    } finally {
        toggleLoading(false);
    }
}

// --- INITIALIZATION ---
async function initializeDashboard() {
    toggleLoading(true);
    await loadSections();
    await loadApprovedUsers();
    toggleLoading(false);
}

// --- USER TABLE & ARCHIVE LOGIC ---
async function loadApprovedUsers() {
    const snapshot = await getDocs(collection(db, "approvedUsers"));
    approvedTable.innerHTML = "";
    
    if (snapshot.empty) {
        approvedTable.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:gray;">No approved users found.</td></tr>`;
        return;
    }

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const row = document.createElement("tr");
        const multiSelect = createMultiSelect(data.section || []);
        row.innerHTML = `
            <td><input type="checkbox" class="approvedCheck" data-id="${docSnap.id}"></td>
            <td>${data.email}</td>
            <td class="select-col"></td>
            <td><button class="saveBtn" data-id="${docSnap.id}">Save</button></td>
        `;
        row.querySelector(".select-col").appendChild(multiSelect);
        approvedTable.appendChild(row);
    });

    document.querySelectorAll(".saveBtn").forEach(btn => btn.addEventListener("click", async () => {
        toggleLoading(true);
        const container = btn.closest("tr").querySelector(".multi-select-container");
        const selected = Array.from(container.querySelectorAll("input:checked")).map(c => c.value);
        await updateDoc(doc(db, "approvedUsers", btn.dataset.id), { section: selected.length ? selected : ["No Section"] });
        toggleLoading(false);
        alert("Updated!");
    }));
}

removeUsersBtn?.addEventListener("click", async () => {
    const selected = document.querySelectorAll(".approvedCheck:checked");
    if (!selected.length || !(await showCustomConfirm("Archive selected users?"))) return;

    toggleLoading(true);
    for (const cb of selected) {
        const id = cb.dataset.id;
        const userSnap = await getDoc(doc(db, "approvedUsers", id));
        await setDoc(doc(collection(db, "archivedUsers")), { ...userSnap.data(), archivedAt: new Date().toISOString() });
        await deleteDoc(doc(db, "approvedUsers", id));
    }
    await initializeDashboard();
    toggleLoading(false);
});

// --- MULTI-SELECT HELPER ---
function createMultiSelect(selectedSections = []) {
    const container = document.createElement("div");
    container.className = "multi-select-container";
    const input = document.createElement("div");
    input.className = "multi-select-input";
    input.textContent = selectedSections.length ? selectedSections.join(", ") : "No Section";
    const dropdown = document.createElement("div");
    dropdown.className = "multi-select-dropdown";

    sections.forEach(sec => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = sec.name;
        if (selectedSections.includes(sec.name)) checkbox.checked = true;
        
        checkbox.addEventListener("change", () => {
            const all = Array.from(dropdown.querySelectorAll("input"));
            if (sec.name === "No Section" && checkbox.checked) {
                all.forEach(cb => { if (cb.value !== "No Section") cb.checked = false; });
            } else if (sec.name !== "No Section" && checkbox.checked) {
                const noSec = all.find(cb => cb.value === "No Section");
                if (noSec) noSec.checked = false;
            }
            const checked = all.filter(c => c.checked).map(c => c.value);
            input.textContent = checked.length ? checked.join(", ") : "No Section";
        });
        label.append(checkbox, " ", sec.name);
        dropdown.appendChild(label);
    });

    input.onclick = (e) => { 
        e.stopPropagation(); 
        document.querySelectorAll(".multi-select-container").forEach(c => { if (c !== container) c.classList.remove("active"); });
        container.classList.toggle("active"); 
    };
    container.append(input, dropdown);
    return container;
}const themeToggle = document.getElementById('themeToggle');

// 1. Immediate execution: Set theme and icon before the page finishes rendering
(function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const html = document.documentElement;

    // 2. Set the initial icon based on the saved theme
    const currentTheme = html.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        themeIcon.classList.remove('bi-moon');
        themeIcon.classList.add('bi-sun');
    } else {
        themeIcon.classList.remove('bi-sun');
        themeIcon.classList.add('bi-moon');
    }

    // 3. Handle the toggle click
    themeToggle.addEventListener('click', () => {
        const isDark = html.getAttribute('data-theme') === 'dark';
        
        if (isDark) {
            // Switching to Light
            html.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeIcon.classList.remove('bi-sun');
            themeIcon.classList.add('bi-moon');
        } else {
            // Switching to Dark
            html.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeIcon.classList.remove('bi-moon');
            themeIcon.classList.add('bi-sun');
        }
    });
});
// INITIAL LOAD
initializeDashboard();

// Cleanup for Cancel Buttons
cancelEditSections?.addEventListener("click", () => editSectionModal.classList.add("hidden"));
cancelDeleteSections?.addEventListener("click", () => deleteSectionModal.classList.add("hidden"));
cancelSectionBtn?.addEventListener("click", () => sectionModal.classList.add("hidden"));