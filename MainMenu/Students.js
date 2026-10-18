import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { 
    getFirestore, collection, getDocs, onSnapshot, query, where, writeBatch, doc, updateDoc, deleteDoc, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// 1. FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyCEK9ungYl1PkiqgLkWJPCtNXAsQ3c6xxc",
    authDomain: "syntaxerror-data.firebaseapp.com",
    projectId: "syntaxerror-data",
    storageBucket: "syntaxerror-data.firebasestorage.app",
    messagingSenderId: "513961059475",
    appId: "1:513961059475:web:fbf6f471357465dbaad966"
};

const mockStudent = {
    id: "2024-0512",
    name: "Alex Rivera",
    section: "BSCS-201",
    progress: 65,
    gameStats: [
        { level: "Variables", wrongs: 1, time: 95 },
        { level: "If-Else",   wrongs: 8, time: 420 },
        { level: "Loops",     wrongs: 4, time: 210 },
        { level: "Functions", wrongs: 0, time: 0 },
        { level: "Firestore", wrongs: 0, time: 0 }
    ],
    difficulty: [1, 9, 5, 0, 0] 
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const VERIFIED_KEY = "syntaxerror_verified_uid";
function hasVerifiedSession(user) {
    return user && (localStorage.getItem(VERIFIED_KEY) === user.uid ||
        sessionStorage.getItem(VERIFIED_KEY) === user.uid);
}


// Global Variables
let allStudents = [];
let currentUserSection = []; 
let sectionDocMapping = {};
let unsubscribeStudentUser = null;
let unsubscribeStudentSections = null;
const studentClassListeners = new Map();
const studentClassSnapshots = new Map();

function stopStudentRealtimeListeners() {
    if (unsubscribeStudentUser) { unsubscribeStudentUser(); unsubscribeStudentUser = null; }
    if (unsubscribeStudentSections) { unsubscribeStudentSections(); unsubscribeStudentSections = null; }
    studentClassListeners.forEach(stop => stop());
    studentClassListeners.clear();
    studentClassSnapshots.clear();
}

function renderRealtimeStudents() {
    allStudents = [...studentClassSnapshots.values()].flat();
    loadStudents(document.getElementById("section-select")?.value || "");
}
 
let difficultyChart;
let sectionPieChartInstance = null;
let overallColumnChartInstance = null;
let modalAttemptProgressChart = null;
let currentStudentForAttemptChart = null;
function getSubjectContentWrongs(studentDoc) {
    const subjectContent = studentDoc["Subject Content"] || studentDoc.subjectContent;
    const categoryAffected = {};

    if (!subjectContent || typeof subjectContent !== "object") {
        return categoryAffected;
    }

    // Iterate dynamically through all top-level categories in "Subject Content"
    for (const categoryKey in subjectContent) {
        const categoryData = subjectContent[categoryKey];
        if (typeof categoryData !== "object" || categoryData === null) continue;

        let hasError = false;

        // Recursive check to see if any leaf node has wrongAttempts > 0
        function checkForErrors(obj) {
            for (const key in obj) {
                const val = obj[key];
                if (typeof val === "object" && val !== null) {
                    if ("wrongAttempts" in val) {
                        if (Number(val.wrongAttempts || 0) > 0) {
                            hasError = true;
                        }
                    } else {
                        checkForErrors(val);
                    }
                }
            }
        }

        checkForErrors(categoryData);
        
        // Mark 1 if student faced an issue in this category, 0 otherwise
        categoryAffected[categoryKey] = hasError ? 1 : 0;
    }

    return categoryAffected;
}
function renderDashboardCharts(sectionStudents) {
    const conceptMapSection = {};
    const conceptMapOverall = {};
    // Class difficulty charts are retained; recommendations card was removed.
    // 1. Count affected students in selected section
    sectionStudents.forEach(s => {
        const affectedCategories = getSubjectContentWrongs(s);
        for (const [concept, count] of Object.entries(affectedCategories)) {
            conceptMapSection[concept] = (conceptMapSection[concept] || 0) + count;
        }
    });

    // 2. Count affected students across ALL sections
    allStudents.forEach(s => {
        const affectedCategories = getSubjectContentWrongs(s);
        for (const [concept, count] of Object.entries(affectedCategories)) {
            conceptMapOverall[concept] = (conceptMapOverall[concept] || 0) + count;
        }
    });

    let sectionLabels = Object.keys(conceptMapSection);
    let sectionValues = Object.values(conceptMapSection);

    if (sectionLabels.length === 0) {
        sectionLabels = ["No Data Available"];
        sectionValues = [0];
    }

    let overallLabels = Object.keys(conceptMapOverall);
    let overallValues = Object.values(conceptMapOverall);

    if (overallLabels.length === 0) {
        overallLabels = ["No Data Available"];
        overallValues = [0];
    }

    const colorPalette = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

    // 3. Render Section Pie Chart
    const pieCanvas = document.getElementById("sectionPieChart");
    if (pieCanvas) {
        const pieCtx = pieCanvas.getContext("2d");
        if (sectionPieChartInstance) sectionPieChartInstance.destroy();

        sectionPieChartInstance = new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: sectionLabels.map(l => l.toUpperCase()),
                datasets: [{
                    data: sectionValues,
                    backgroundColor: colorPalette.slice(0, sectionLabels.length)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.label}: ${context.raw} Student(s) Struggling`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 4. Render Overall Column Chart
    const colCanvas = document.getElementById("overallColumnChart");
    if (colCanvas) {
        const colCtx = colCanvas.getContext("2d");
        if (overallColumnChartInstance) overallColumnChartInstance.destroy();

        overallColumnChartInstance = new Chart(colCtx, {
            type: 'bar',
            data: {
                labels: overallLabels.map(l => l.toUpperCase()),
                datasets: [{
                    label: 'Students Facing Issues',
                    data: overallValues,
                    backgroundColor: '#3b82f6',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        ticks: { stepSize: 1 }, 
                        title: { display: true, text: 'Number of Students' } 
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}
// COURSE OUTLINE
const COURSE_OUTLINE = [
    { level: 1, module: "C# Basics", lesson: "Variables & Data Types" },
    { level: 2, module: "Control Flow", lesson: "If-Else Statements" },
    { level: 3, module: "Loops", lesson: "For & While Loops" },
    { level: 4, module: "Functions", lesson: "Methods & Parameters" },
    { level: 5, module: "Integration", lesson: "Firestore Integration" }
];

function formatBirthdayToPassword(dateStr) {
    if (!dateStr || dateStr === "No Birthday") return "";
    return String(dateStr).replace(/-/g, "");
}

// UI Helpers
const toggleLoading = (show) => {
    const loader = document.getElementById("loading-overlay");
    if(loader) loader.style.display = show ? "flex" : "none";
};

function renderStudentInsights(students) {
    const container = document.getElementById("student-analysis");
    if (!container) return;

    let struggling = students.filter(s => (s.progress || 0) < 50);

    container.innerHTML = struggling.map(s => {
        let weakestIndex = (s.difficulty || []).indexOf(Math.max(...(s.difficulty || [0])));
        let lesson = COURSE_OUTLINE[weakestIndex];

        return `
            <div class="lesson-alert">
                <strong>${s.name}</strong><br>
                Struggling with: ${lesson.module} → ${lesson.lesson}
            </div>
        `;
    }).join("") || "<p>All students performing well.</p>";
}

// 2. DATA INITIALIZATION
onAuthStateChanged(auth, async (user) => {
    if (!hasVerifiedSession(user)) {
        stopStudentRealtimeListeners();
        window.location.href = "../Login/Login.html";
        return;
    }
    toggleLoading(true);
    await getUserData(user);
    await fetchClassList();
    toggleLoading(false);
});

async function getUserData(user) {
    stopStudentRealtimeListeners();
    const select = document.getElementById("section-select");
    let sectionSnapshot = null;

    function syncAssignedSections() {
        if (!sectionSnapshot) return;
        const selected = select?.value || "";
        sectionDocMapping = {};
        if (select) select.innerHTML = '<option value="">-- All My Sections --</option>';
        sectionSnapshot.forEach(d => {
            const name = d.data().name;
            sectionDocMapping[name] = d.id;
            if (currentUserSection.includes(name) && select) {
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                select.appendChild(opt);
            }
        });
        if (select && [...select.options].some(opt => opt.value === selected)) select.value = selected;
        fetchClassList();
    }

    const q = query(collection(db, "approvedUsers"), where("email", "==", user.email));
    unsubscribeStudentUser = onSnapshot(q, snap => {
        currentUserSection = [];
        snap.forEach(d => { currentUserSection = d.data().section || []; });
        const display = document.getElementById("user-section");
        if (display) display.textContent = currentUserSection.join(", ");
        syncAssignedSections();
    }, error => console.error("Error listening for user sections:", error));

    unsubscribeStudentSections = onSnapshot(collection(db, "sections"), snap => {
        sectionSnapshot = snap;
        syncAssignedSections();
    }, error => console.error("Error listening for sections:", error));
}

async function fetchClassList() {
    const wanted = new Map();
    for (const sectionName of currentUserSection) {
        const id = sectionDocMapping[sectionName];
        if (id) wanted.set(id, sectionName);
    }
    studentClassListeners.forEach((stop, id) => {
        if (!wanted.has(id)) {
            stop();
            studentClassListeners.delete(id);
            studentClassSnapshots.delete(id);
        }
    });
    wanted.forEach((sectionName, docId) => {
        if (studentClassListeners.has(docId)) return;
        const stop = onSnapshot(collection(db, "sections", docId, "classList"), snap => {
            studentClassSnapshots.set(docId, snap.docs.map(sDoc => ({
                ...sDoc.data(), section: wanted.get(docId) || sectionName, parentDocId: docId
            })));
            renderRealtimeStudents();
        }, error => console.error("Class list listener error:", error));
        studentClassListeners.set(docId, stop);
    });
    studentClassSnapshots.forEach((students, id) => {
        const name = wanted.get(id);
        if (name) students.forEach(student => { student.section = name; });
    });
    renderRealtimeStudents();
}

// 3. TABLE LOADING & STAT UPDATES
function loadStudents(section) {
    const table = document.getElementById("students-table");
    const emptyState = document.getElementById("empty-state");
    const searchInput = document.getElementById("search-student");
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

    if(table) table.innerHTML = "";

    let filtered = allStudents.filter(s => {
        const matchesSection = (section === "" || s.section === section);
        const matchesSearch = !searchTerm || 
                              (s.name && s.name.toLowerCase().includes(searchTerm)) || 
                              (s.id && s.id.toString().toLowerCase().includes(searchTerm));
        return matchesSection && matchesSearch;
    });

    const getProgress = s => Math.min(100, Math.max(0, Number(s.progress) || 0));
    const progressFilter = document.getElementById("progress-filter")?.value || "all";
    filtered = filtered.filter(s => {
        const value = getProgress(s);
        return progressFilter === "all" ||
            (progressFilter === "complete" && value === 100) ||
            (progressFilter === "inprogress" && value > 0 && value < 100) ||
            (progressFilter === "notstarted" && value === 0);
    });
    const sort = document.getElementById("student-sort")?.value || "name";
    filtered.sort((a, b) => {
        if (sort === "progress-desc") return getProgress(b) - getProgress(a) || String(a.name || "").localeCompare(String(b.name || ""));
        if (sort === "progress-asc") return getProgress(a) - getProgress(b) || String(a.name || "").localeCompare(String(b.name || ""));
        if (sort === "online") return Number(b.isOnline === true || b.isOnline === "true") - Number(a.isOnline === true || a.isOnline === "true") || String(a.name || "").localeCompare(String(b.name || ""));
        return String(a.name || "").localeCompare(String(b.name || ""));
    });
    const displayText = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText("overview-total", filtered.length);
    setText("overview-average", filtered.length ? Math.round(filtered.reduce((n, s) => n + getProgress(s), 0) / filtered.length) + "%" : "0%");
    setText("overview-completed", filtered.filter(s => getProgress(s) === 100).length);
    setText("overview-in-progress", filtered.filter(s => getProgress(s) > 0 && getProgress(s) < 100).length);
    setText("table-results", `Showing ${filtered.length} of ${allStudents.length} students`);

    // Update Card Stats
    const totalStudentsEl = document.getElementById("card-total-students");
    if (totalStudentsEl) totalStudentsEl.textContent = filtered.length;
    
    // Calculate and display online students
    const onlineCount = filtered.filter(s => s.isOnline === true).length;
    const onlineCountEl = document.getElementById("online-count");
    if (onlineCountEl) onlineCountEl.textContent = onlineCount;

    let avgProg = filtered.length > 0 
        ? Math.round(filtered.reduce((acc, s) => acc + (s.progress || 0), 0) / filtered.length) 
        : 0;
    
    const avgScoreEl = document.getElementById("average-score");
    if (avgScoreEl) avgScoreEl.textContent = avgProg + "%";

    if (filtered.length === 0) {
        if(emptyState) emptyState.style.display = "block";
        if (table) table.innerHTML = `<tr><td colspan="5" class="no-students">No students match your current filters.</td></tr>`;
        renderDashboardCharts([]);
        return;
    } else {
        if(emptyState) emptyState.style.display = "none";
    }
    renderDashboardCharts(filtered);
    if(table) {
        table.innerHTML = filtered.map(s => {
            const isOnline = s.isOnline === true || s.isOnline === "true";
            const progress = getProgress(s);
            const progressLabel = progress === 100 ? "Completed" : progress > 0 ? "In progress" : "Not started";
            const progressClass = progress === 100 ? "is-complete" : progress > 0 ? "is-active" : "is-new";

            const statusBadge = isOnline 
                ? `<span style="background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
                     <span style="width: 8px; height: 8px; background: #22c55e; border-radius: 50%;"></span> Online
                   </span>`
                : `<span style="background: #f1f5f9; color: #64748b; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
                     <span style="width: 8px; height: 8px; background: #94a3b8; border-radius: 50%;"></span> Offline
                   </span>`;

            return `
            <tr>
                <td><strong>${displayText(s.id)}</strong></td>
                <td><div class="student-name-cell"><span class="student-avatar">${displayText(String(s.name || "?").trim().charAt(0).toUpperCase())}</span><span><strong>${displayText(s.name)}</strong><small>${displayText(s.section)}</small></span></div></td>
                <td style="padding: 15px;">
                    <div class="progress-label-row"><strong>${progress}%</strong><span class="progress-state ${progressClass}">${progressLabel}</span></div>
                    <div class="progress-track" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" aria-label="Student progress"><div class="progress-fill ${progressClass}" style="width:${progress}%"></div></div>
                </td>
                <td style="padding: 15px;">${statusBadge}</td>
                <td style="padding: 15px;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button onclick="viewStudent('${s.id}')" 
                                style="background: #3b82f6; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 14px;">
                            <i class="bi bi-eye"></i> Details
                        </button>
                        <button onclick="editStudent('${s.id}')" 
                                style="background:#f59e0b; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; display: flex; align-items: center; height: 35px;">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button onclick="archiveStudent('${s.id}')" 
                                style="background:#6b7280; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; display: flex; align-items: center; height: 35px;">
                            <i class="bi bi-archive"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join("");
    }
}

// 4. EDIT & ARCHIVE LOGIC
window.editStudent = function(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    const idInput = document.getElementById("edit-id-input");
    const nameInput = document.getElementById("edit-name-input");
    const bdayInput = document.getElementById("edit-birthday-input");
    const saveBtn = document.getElementById("save-edit-btn");
    
    idInput.value = student.id;
    nameInput.value = student.name;
    bdayInput.value = student.birthday || "";
    
    document.getElementById("edit-modal").style.display = "flex";
    saveBtn.disabled = false;
    saveBtn.innerText = "Save Changes";

    saveBtn.onclick = async () => {
        const newId = idInput.value.trim();
        const newName = nameInput.value.trim();
        const newBday = bdayInput.value;
        const newPassword = formatBirthdayToPassword(newBday);

        if (!newId || !newName) {
            alert("Student Number and Name are required!");
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";
        toggleLoading(true);

        try {
            const oldRef = doc(db, "sections", student.parentDocId, "classList", student.id);
            
            if (newId !== student.id) {
                const newRef = doc(db, "sections", student.parentDocId, "classList", newId);
                await setDoc(newRef, {
                    ...student,
                    id: newId,
                    name: newName,
                    birthday: newBday,
                    password: newPassword
                });
                await deleteDoc(oldRef);
            } else {
                await updateDoc(oldRef, { 
                    name: newName,
                    birthday: newBday,
                    password: newPassword
                });
            }
            
            closeEditModal();
            await fetchClassList(); 
            alert("Student record updated!");
        } catch (error) {
            console.error("Update error:", error);
            alert("Failed to update record.");
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = "Save Changes";
            toggleLoading(false);
        }
    };
};

window.closeEditModal = function() {
    document.getElementById("edit-modal").style.display = "none";
};

window.archiveStudent = function(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    const confirmModal = document.getElementById("confirm-modal");
    document.getElementById("confirm-title").textContent = `Archive ${student.name}?`;
    document.getElementById("confirm-message").textContent = `This student will be moved to the archive and removed from ${student.section}.`;
    confirmModal.style.display = "flex";

    document.getElementById("confirm-action-btn").onclick = async () => {
        const actionBtn = document.getElementById("confirm-action-btn");
        actionBtn.disabled = true;
        actionBtn.innerText = "Archiving...";
        
        await proceedWithArchive(student);
        
        actionBtn.disabled = false;
        actionBtn.innerText = "Confirm Archive";
        closeConfirmModal();
    };
};

async function proceedWithArchive(student) {
    toggleLoading(true);
    try {
        const archiveRef = doc(db, "archivedStudents", student.id);
        
        await setDoc(archiveRef, {
            ...student,
            archivedAt: serverTimestamp(),
            status: "archived"
        });

        const originalRef = doc(db, "sections", student.parentDocId, "classList", student.id);
        await deleteDoc(originalRef);

        alert(`${student.name} has been moved to the archive.`);
        await fetchClassList(); 
        
    } catch (error) {
        console.error("Archive Error:", error);
        alert("Failed to archive student. Please try again.");
    } finally {
        toggleLoading(false);
    }
}

window.closeConfirmModal = () => document.getElementById("confirm-modal").style.display = "none";
window.closeArchiveModal = () => document.getElementById("custom-archive-modal").style.display = "none";

// 5. INDIVIDUAL STUDENT VIEW 
let gapChart; 
let modalDifficultyChart;

function renderConceptBreakdown(studentData) {
    const container = document.getElementById("modal-concept-breakdown");
    if (!container) return;

    container.innerHTML = "";

    const subjectContent = studentData["Subject Content"] || studentData.subjectContent;

    if (!subjectContent) {
        container.innerHTML = `<p style="font-size: 0.85rem; color: #94a3b8;">No detailed topic attempt data found for this student.</p>`;
        return;
    }

    const categories = [];

    for (const catKey in subjectContent) {
        const categoryData = subjectContent[catKey];
        if (typeof categoryData !== "object" || categoryData === null) continue;

        let categoryTotalWrongs = 0;
        const subTopics = [];

        function extractLeafTopics(obj, prefix = "") {
            for (const key in obj) {
                const val = obj[key];
                if (typeof val === "object" && val !== null && !(val instanceof Date)) {
                    if ("wrongAttempts" in val) {
                        const wrongs = val.wrongAttempts || 0;
                        if (wrongs > 0) {
                            categoryTotalWrongs += wrongs;
                            subTopics.push({
                                name: prefix ? `${prefix} → ${key}` : key,
                                wrongs: wrongs
                            });
                        }
                    } else {
                        extractLeafTopics(val, prefix ? `${prefix} → ${key}` : key);
                    }
                }
            }
        }

        extractLeafTopics(categoryData);

        if (categoryTotalWrongs > 0 && subTopics.length > 0) {
            categories.push({
                title: catKey,
                totalWrongs: categoryTotalWrongs,
                subTopics: subTopics
            });
        }
    }

    if (categories.length === 0) {
        container.innerHTML = `<p style="font-size: 0.85rem; color: #10b981; font-weight: 500;">✨ No wrong attempts recorded across any concepts!</p>`;
        return;
    }

    categories.sort((a, b) => b.totalWrongs - a.totalWrongs);

    container.innerHTML = categories.map((cat, idx) => {
        const detailsId = `concept-detail-${idx}`;
        const btnId = `concept-btn-${idx}`;

        return `
            <div style="background: var(--card-bg, #ffffff); border: 1px solid var(--border, #e2e8f0); border-radius: 8px; padding: 10px 12px; margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-weight: 700; font-size: 0.9rem; text-transform: capitalize; color: var(--text-main, #1e293b);">
                            ${cat.title}
                        </span>
                        <div style="font-size: 0.75rem; color: #ef4444; font-weight: 600; margin-top: 2px;">
                            ${cat.totalWrongs} Total Wrong Attempt${cat.totalWrongs > 1 ? 's' : ''}
                        </div>
                    </div>
                    
                    <button id="${btnId}" onclick="toggleConceptDetail('${detailsId}', '${btnId}')" 
                            style="background: transparent; color: #3b82f6; border: 1px solid #3b82f6; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s ease;">
                        <span>View Details</span>
                        <i class="bi bi-chevron-down"></i>
                    </button>
                </div>

                <div id="${detailsId}" style="display: none; margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border, #e2e8f0); flex-direction: column; gap: 6px;">
                    ${cat.subTopics.map(sub => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: rgba(0,0,0,0.02); border-radius: 4px;">
                            <span style="font-size: 0.8rem; color: var(--text-muted, #64748b); font-weight: 500;">
                                - ${sub.name}
                            </span>
                            <span style="background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; padding: 1px 8px; border-radius: 10px; font-weight: 700; font-size: 0.75rem;">
                                ${sub.wrongs} wrong
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join("");
}

window.toggleConceptDetail = function(detailsId, btnId) {
    const detailsEl = document.getElementById(detailsId);
    const btnEl = document.getElementById(btnId);
    if (!detailsEl || !btnEl) return;

    const isHidden = detailsEl.style.display === "none";
    detailsEl.style.display = isHidden ? "flex" : "none";

    btnEl.innerHTML = isHidden 
        ? `<span>Hide Details</span> <i class="bi bi-chevron-up"></i>` 
        : `<span>View Details</span> <i class="bi bi-chevron-down"></i>`;
};

// Extract the real learning structure from Firestore.
// Structure used:
// Subject Content -> Main Subject/Category -> Subtopic -> wrongAttempts
function getStudentConceptDifficulty(studentData) {
    const subjectContent = studentData?.["Subject Content"] || studentData?.subjectContent;
    const categoryTotals = {};

    if (!subjectContent || typeof subjectContent !== "object") {
        return [];
    }

    // SUMMARY VIEW:
    // Only use the MAIN SUBJECT/CATEGORY as the chart item.
    // Do not show FirstAttempt, SecondAttempt, ThirdAttempt,
    // or individual subtopics such as integer, boolean, printing, etc.
    // All wrong attempts under the same main category are combined.
    for (const mainCategory in subjectContent) {
        const categoryData = subjectContent[mainCategory];
        if (typeof categoryData !== "object" || categoryData === null) continue;

        let totalWrongAttempts = 0;

        function collectWrongAttempts(obj) {
            for (const key in obj) {
                const value = obj[key];

                if (typeof value !== "object" || value === null || value instanceof Date) {
                    continue;
                }

                if (Object.prototype.hasOwnProperty.call(value, "wrongAttempts")) {
                    totalWrongAttempts += Math.max(0, Number(value.wrongAttempts) || 0);
                } else {
                    collectWrongAttempts(value);
                }
            }
        }

        collectWrongAttempts(categoryData);

        // One chart item per MAIN SUBJECT only.
        const score = Math.min(totalWrongAttempts, 10);

        let difficultyLabel = "Easy";
        if (score >= 7) {
            difficultyLabel = "Hard";
        } else if (score >= 4) {
            difficultyLabel = "Moderate";
        }

        categoryTotals[mainCategory] = {
            mainCategory,
            wrongAttempts: totalWrongAttempts,
            score,
            difficultyLabel
        };
    }

    return Object.values(categoryTotals);
}

function getDifficultyColor(score) {
    if (score >= 7) return "#ef4444";
    if (score >= 4) return "#f59e0b";
    return "#10b981";
}


// ================================================================
// STUDENT ATTEMPT PROGRESS CHART
// Shows ONLY main subjects in the dropdown, while the chart uses
// FirstAttemp / SecondAttemp / ThirdAttemp data underneath that subject.
// This is separate from the existing Concept Difficulty chart.
// ================================================================
function normalizeAttemptKey(key) {
    return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getAttemptNumber(key) {
    const normalized = normalizeAttemptKey(key);
    if (normalized === "firstattemp" || normalized === "firstattempt") return 1;
    if (normalized === "secondattemp" || normalized === "secondattempt") return 2;
    if (normalized === "thirdattemp" || normalized === "thirdattempt") return 3;
    return 0;
}

function sumWrongAttemptsDeep(obj) {
    let total = 0;
    if (!obj || typeof obj !== "object") return 0;

    for (const key in obj) {
        const value = obj[key];
        if (typeof value !== "object" || value === null || value instanceof Date) continue;

        if (Object.prototype.hasOwnProperty.call(value, "wrongAttempts")) {
            total += Math.max(0, Number(value.wrongAttempts) || 0);
        }

        // Continue searching because an attempt can contain multiple activities.
        total += sumWrongAttemptsDeep(value);
    }

    return total;
}

function formatMainSubjectName(subject) {
    return String(subject || "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
}

function getStudentMainSubjects(studentData) {
    const subjectContent = studentData?.["Subject Content"] || studentData?.subjectContent;
    if (!subjectContent || typeof subjectContent !== "object") return [];

    return Object.keys(subjectContent).filter(key => {
        return subjectContent[key] && typeof subjectContent[key] === "object" && !Array.isArray(subjectContent[key]);
    });
}

function getMainSubjectAttemptData(studentData, mainSubject) {
    const subjectContent = studentData?.["Subject Content"] || studentData?.subjectContent;
    const subjectData = subjectContent?.[mainSubject];

    const attempts = {
        1: { wrongAttempts: 0, found: false },
        2: { wrongAttempts: 0, found: false },
        3: { wrongAttempts: 0, found: false }
    };

    if (!subjectData || typeof subjectData !== "object") return attempts;

    function walk(obj) {
        if (!obj || typeof obj !== "object" || obj instanceof Date) return;

        for (const key in obj) {
            const value = obj[key];
            if (!value || typeof value !== "object" || value instanceof Date) continue;

            const attemptNumber = getAttemptNumber(key);
            if (attemptNumber > 0) {
                attempts[attemptNumber].found = true;
                attempts[attemptNumber].wrongAttempts += sumWrongAttemptsDeep(value);
                // Do not walk this same attempt again or its wrongAttempts would be double-counted.
                continue;
            }

            walk(value);
        }
    }

    walk(subjectData);
    return attempts;
}

function updateAttemptProgressSummary(attempts) {
    const values = [1, 2, 3].map(n => attempts[n]?.found ? attempts[n].wrongAttempts : null);
    const ids = ["first-attempt-wrongs", "second-attempt-wrongs", "third-attempt-wrongs"];

    ids.forEach((id, index) => {
        const el = document.getElementById(id);
        if (el) el.textContent = values[index] === null ? "--" : values[index];
    });

    const message = document.getElementById("attempt-improvement-summary");
    if (!message) return;

    message.classList.remove("is-improving", "is-increasing", "is-neutral");

    const recorded = values.filter(v => v !== null);
    if (recorded.length < 2) {
        message.textContent = recorded.length === 0
            ? "No attempt data has been recorded for this subject yet."
            : "Only one attempt is recorded, so improvement cannot be compared yet.";
        message.classList.add("is-neutral");
        return;
    }

    const first = values.find(v => v !== null);
    const latest = [...values].reverse().find(v => v !== null);

    if (first === null || latest === null) return;

    if (latest < first) {
        const improvement = first > 0 ? Math.round(((first - latest) / first) * 100) : 0;
        message.textContent = `Improvement: wrong attempts decreased by ${improvement}% (${first} → ${latest}).`;
        message.classList.add("is-improving");
    } else if (latest > first) {
        const increase = first > 0 ? Math.round(((latest - first) / first) * 100) : 0;
        message.textContent = `Wrong attempts increased by ${increase}% (${first} → ${latest}).`;
        message.classList.add("is-increasing");
    } else {
        message.textContent = `No change in wrong attempts (${first} → ${latest}).`;
        message.classList.add("is-neutral");
    }
}

function renderStudentAttemptProgressChart(studentData, selectedSubject = "") {
    const canvas = document.getElementById("attemptProgressChart");
    const select = document.getElementById("attempt-subject-select");
    if (!canvas || !select) return;

    currentStudentForAttemptChart = studentData;

    if (modalAttemptProgressChart instanceof Chart) {
        modalAttemptProgressChart.destroy();
        modalAttemptProgressChart = null;
    }

    const subjects = getStudentMainSubjects(studentData);
    const previousValue = selectedSubject || select.value;

    select.innerHTML = `<option value="">Select a subject...</option>`;
    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = formatMainSubjectName(subject);
        select.appendChild(option);
    });

    const subjectToUse = subjects.includes(previousValue) ? previousValue : (subjects[0] || "");
    select.value = subjectToUse;

    if (!subjectToUse) {
        updateAttemptProgressSummary({
            1: { found: false, wrongAttempts: 0 },
            2: { found: false, wrongAttempts: 0 },
            3: { found: false, wrongAttempts: 0 }
        });
        return;
    }

    const attempts = getMainSubjectAttemptData(studentData, subjectToUse);
    updateAttemptProgressSummary(attempts);

    const values = [1, 2, 3].map(number => attempts[number].found ? attempts[number].wrongAttempts : null);
    const labels = ["1st Attempt", "2nd Attempt", "3rd Attempt"];

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const theme = document.documentElement.getAttribute("data-theme") || "light";
    const isDark = theme === "dark";
    const chartTextColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--text-muted").trim() || (isDark ? "#8b949e" : "#64748b");
    const chartGridColor = isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.18)";
    const chartBorderColor = isDark ? "#007aff" : "#3b82f6";
    const chartFillColor = isDark ? "rgba(0, 122, 255, 0.14)" : "rgba(59, 130, 246, 0.12)";

    modalAttemptProgressChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Wrong Attempts",
                data: values,
                borderColor: chartBorderColor,
                backgroundColor: chartFillColor,
                pointBackgroundColor: chartBorderColor,
                pointBorderColor: isDark ? "#161a22" : "#ffffff",
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                borderWidth: 3,
                tension: 0.25,
                fill: true,
                spanGaps: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: items => items.length ? labels[items[0].dataIndex] : "",
                        label: context => {
                            const value = context.raw;
                            return value === null || value === undefined
                                ? " No data recorded"
                                : ` Wrong Attempts: ${value}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Wrong Attempts", color: chartTextColor },
                    ticks: { color: chartTextColor, stepSize: 1 },
                    grid: { color: chartGridColor }
                },
                x: {
                    ticks: { color: chartTextColor },
                    grid: { display: false }
                }
            }
        }
    });
}

function setupAttemptProgressDropdown() {
    const select = document.getElementById("attempt-subject-select");
    if (!select || select.dataset.bound === "true") return;

    select.dataset.bound = "true";
    select.addEventListener("change", function() {
        if (currentStudentForAttemptChart) {
            renderStudentAttemptProgressChart(currentStudentForAttemptChart, this.value);
        }
    });
}

function renderConceptDifficultyChart(studentData) {
    const canvas = document.getElementById("modalDifficultyChart");
    if (!canvas) return null;

    if (window.modalDifficultyChart instanceof Chart) {
        window.modalDifficultyChart.destroy();
    }

    const concepts = getStudentConceptDifficulty(studentData);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    if (concepts.length === 0) {
        const parent = canvas.parentElement;
        if (parent) {
            canvas.style.display = "none";
            let message = parent.querySelector(".student-concept-empty");
            if (!message) {
                message = document.createElement("div");
                message.className = "student-concept-empty";
                message.style.cssText = "min-height:260px;display:flex;align-items:center;justify-content:center;text-align:center;color:#94a3b8;padding:20px;";
                parent.appendChild(message);
            }
            message.textContent = "No detailed concept difficulty data is available for this student yet.";
        }
        return null;
    }

    canvas.style.display = "block";
    canvas.parentElement?.querySelector(".student-concept-empty")?.remove();

    // SUMMARY CHART: one bar for each MAIN SUBJECT only.
    const labels = concepts.map(item =>
        String(item.mainCategory).replace(/_/g, " ")
    );

    const values = concepts.map(item => item.score);
    const backgroundColors = values.map(getDifficultyColor);

    // Keep the summary compact even when Firebase contains many attempts/subtopics.
    const chartBox = canvas.parentElement;
    if (chartBox) {
        chartBox.style.minHeight = `${Math.max(260, concepts.length * 70)}px`;
    }

    window.modalDifficultyChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Difficulty",
                data: values,
                borderRadius: 6,
                borderSkipped: false,
                backgroundColor: backgroundColors,
                barThickness: 24
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "nearest",
                intersect: true
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(items) {
                            if (!items.length) return "";
                            const concept = concepts[items[0].dataIndex];
                            return String(concept.mainCategory).replace(/_/g, " ");
                        },
                        label: function(context) {
                            const concept = concepts[context.dataIndex];
                            return [
                                ` Difficulty: ${concept.difficultyLabel}`,
                                ` Wrong Attempts: ${concept.wrongAttempts}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: "Difficulty Score"
                    },
                    grid: {
                        color: "rgba(148, 163, 184, 0.18)"
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        autoSkip: false,
                        padding: 8,
                        font: function(context) {
                            return {
                                size: 12,
                                weight: Array.isArray(context.tick?.label) ? 500 : 400
                            };
                        }
                    }
                }
            }
        }
    });

    return concepts;
}


// Topic ranking uses only the selected student — never the classwide dashboard.
function renderStudentTopicRanking(student) {
    const list = document.getElementById("student-topic-ranking-list");
    if (!list) return;

    const topics = getStudentConceptDifficulty(student)
        .sort((a, b) => b.wrongAttempts - a.wrongAttempts ||
            String(a.mainCategory).localeCompare(String(b.mainCategory)));

    list.replaceChildren();
    if (!topics.length) {
        const empty = document.createElement("p");
        empty.className = "student-topic-ranking-empty";
        empty.textContent = "No topic difficulty records are available for this student yet.";
        list.appendChild(empty);
        return;
    }

    // The 0–10 difficulty score is the same capped wrong-attempt score used in
    // the student concept chart. Raw attempt counts remain visible for clarity.
    topics.forEach((topic, index) => {
        const item = document.createElement("article");
        item.className = "student-topic-ranking-item";
        const row = document.createElement("div");
        row.className = "student-topic-ranking-row";
        const rank = document.createElement("span");
        rank.className = "student-topic-ranking-index";
        rank.textContent = String(index + 1);
        const name = document.createElement("span");
        name.className = "student-topic-ranking-name";
        name.textContent = formatMainSubjectName(topic.mainCategory);
        const count = document.createElement("span");
        count.className = "student-topic-ranking-count";
        count.textContent = `${topic.score}/10`;
        count.style.color = getDifficultyColor(topic.score);
        row.append(rank, name, count);
        const track = document.createElement("div");
        track.className = "student-topic-ranking-track";
        track.setAttribute("role", "meter");
        track.setAttribute("aria-label", `${name.textContent} difficulty`);
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "10");
        track.setAttribute("aria-valuenow", String(topic.score));
        const fill = document.createElement("div");
        fill.className = "student-topic-ranking-fill";
        fill.style.width = `${topic.score * 10}%`;
        fill.style.backgroundColor = getDifficultyColor(topic.score);
        track.appendChild(fill);
        const foot = document.createElement("div");
        foot.className = "student-topic-ranking-foot";
        const level = document.createElement("span");
        level.textContent = topic.difficultyLabel;
        const wrongs = document.createElement("span");
        wrongs.textContent = `${topic.wrongAttempts} recorded wrong attempt${topic.wrongAttempts === 1 ? "" : "s"}`;
        foot.append(level, wrongs);
        item.append(row, track, foot);
        list.appendChild(item);
    });
}

window.viewStudent = function(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById("student-details-modal").style.display = "flex";
    document.getElementById("modal-student-name").textContent = student.name;
    document.getElementById("modal-student-id").textContent = student.id;
    
    const birthdayText = student.birthday ? student.birthday : "No Birthday Saved";
    document.getElementById("modal-student-birthday").textContent = `Birthday: ${birthdayText}`;
    
    document.getElementById("modal-progress").textContent = (student.progress || 0) + "%";
    document.getElementById("modal-idle").textContent = (student.idleTime || "0") + "m";
    renderConceptBreakdown(student);

    // NEW: populate the main-subject dropdown and attempt improvement chart.
    setupAttemptProgressDropdown();
    renderStudentAttemptProgressChart(student);

    // Use the actual Firebase Subject Content hierarchy for the difficulty view.
    const concepts = renderConceptDifficultyChart(student) || [];
    renderStudentTopicRanking(student);

    const hardestConcept = concepts.length > 0
        ? concepts.reduce((hardest, current) => {
            return current.score > hardest.score ? current : hardest;
        }, concepts[0])
        : null;

    const highest = hardestConcept ? hardestConcept.score : 0;
    // Since the chart is a MAIN SUBJECT summary, the weakest item is also
    // reported as the main subject only (no attempt/subtopic path).
    const weakestTopic = hardestConcept
        ? String(hardestConcept.mainCategory).replace(/_/g, " ")
        : "--";

    document.getElementById("modal-difficulty").textContent = `${highest}/10`;
    document.getElementById("modal-weakest-topic").textContent = weakestTopic;

    const statusBox = document.getElementById("status-card");
    const statusTitle = document.getElementById("modal-status-title");
    const perfText = document.getElementById("modal-performance-text");
    const analysisBox = document.getElementById("modal-analysis-content");

    if (highest >= 7) {
        if (statusBox) {
            statusBox.style.borderLeft = "6px solid #ef4444";
            statusBox.style.background = "#fef2f2";
        }
        if (statusTitle) statusTitle.textContent = "Critical Intervention";
        if (perfText) {
            perfText.textContent = "At Risk";
            perfText.className = "text-red";
        }
        if (analysisBox) {
            analysisBox.innerHTML = `
                <div style="border-left: 4px solid #ef4444; padding: 10px; background: #fef2f2;">
                    <strong style="color: #b91c1c;">Gap Detected: ${weakestTopic}</strong>
                    <p style="font-size: 0.85rem; margin-top: 5px; color: #b91c1c;">
                        Repeated incorrect attempts were recorded in ${weakestTopic}.
                    </p>
                </div>`;
        }
    } else {
        if (statusBox) {
            statusBox.style.borderLeft = "6px solid #10b981";
            statusBox.style.background = "#f0fdf4";
        }
        if (statusTitle) statusTitle.textContent = "Good Progress (C# Mastery)";
        if (perfText) {
            perfText.textContent = "On Track";
            perfText.className = "text-green";
        }
        if (analysisBox) {
            analysisBox.innerHTML = `
                <div style="border-left: 4px solid #10b981; padding: 10px; background: #f0fdf4;">
                    <strong style="color: #15803d;">Performance: On Track</strong>
                    <p style="font-size: 0.85rem; margin-top: 5px; color: #15803d;">
                        Student demonstrates strong understanding across the recorded concepts.
                    </p>
                </div>`;
        }
    }
};

window.closeStudentModal = function(){
    document.getElementById("student-details-modal").style.display = "none";
    if (modalAttemptProgressChart instanceof Chart) {
        modalAttemptProgressChart.destroy();
        modalAttemptProgressChart = null;
    }
    currentStudentForAttemptChart = null;
};
function renderGapChart(data) {
    const ctx = document.getElementById("gapChart")?.getContext("2d");
    if (!ctx) return;
    if (gapChart) gapChart.destroy();

    gapChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ["Variables", "Control Flow", "Loops", "Functions", "Firestore"],
            datasets: [{
                label: 'Difficulty Level',
                data: data,
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderColor: '#ef4444',
                pointBackgroundColor: '#ef4444',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 10,
                    ticks: { display: false }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function calculateDifficulty(wrongs, timeInSeconds) {
    let score = (wrongs * 0.5) + (timeInSeconds / 60);
    return Math.min(Math.round(score), 10);
}

function renderGapConclusion(student, difficulty) {
    const container = document.getElementById("student-analysis");
    if (!container) return;

    const maxVal = Math.max(...difficulty);
    const gapIndex = difficulty.indexOf(maxVal);
    const topic = COURSE_OUTLINE[gapIndex];
    
    const levelStats = student.gameStats ? student.gameStats[`level${gapIndex + 1}`] : null;

    let detailNote = "";
    if (levelStats) {
        detailNote = `caused by <b>${levelStats.wrongs} incorrect attempts</b> and <b>${Math.round(levelStats.time / 60)} minutes</b> spent on this level.`;
    }

    let statement = "";
    if (maxVal > 7) {
        statement = `<strong>Critical Gap:</strong> ${student.name} is stuck on ${topic.lesson}. ${detailNote}`;
    } else if (maxVal > 0) {
        statement = `<strong>Minor Struggle:</strong> ${student.name} completed ${topic.lesson}, but showed some hesitation ${detailNote}`;
    } else {
        statement = `<strong>Perfect Run:</strong> No errors or delays recorded for current levels.`;
    }

    container.innerHTML = `
        <div style="padding: 15px; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px;">
            ${statement}
        </div>
    `;
}

function renderStudentChart(student) {
    const ctx = document.getElementById("difficultyChart")?.getContext("2d");
    if (!ctx) return;

    if (difficultyChart) difficultyChart.destroy();

    const difficulty = student.difficulty || [0,0,0,0,0];

    const labels = [
        "Variables & Data Types",
        "If-Else Statements",
        "Loops",
        "Functions",
        "Firestore"
    ];

    difficultyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Difficulty Level',
                data: difficulty,
                borderRadius: 10,
                borderSkipped: false,
                backgroundColor: difficulty.map(v => {
                    if (v >= 7) return '#ef4444';
                    if (v >= 4) return '#f59e0b';
                    return '#10b981';
                })
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            if (value >= 7) return `Hard Difficulty (${value}/10)`;
                            if (value >= 4) return `Moderate Difficulty (${value}/10)`;
                            return `Easy Difficulty (${value}/10)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    ticks: { stepSize: 1 },
                    title: { display: true, text: "Difficulty Score" }
                }
            }
        }
    });

    renderAdvancedAnalysis(student);
}
window.downloadExcelTemplate = function () {
    try {
        const templateRows = [{
            "Student Number": "",
            "Full Name": "",
            "Student Email": "",
            "Birthday (mm/dd/yyyy)": ""
        }];

        const ws = XLSX.utils.json_to_sheet(templateRows, {
            header: [
                "Student Number",
                "Full Name",
                "Student Email",
                "Birthday"
            ]
        });

        ws["!cols"] = [
            { wch: 20 },
            { wch: 32 },
            { wch: 38 },
            { wch: 16 }
        ];

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            ws,
            "Class List Template"
        );

        XLSX.writeFile(
            workbook,
            "Student_Class_List_Template.xlsx"
        );

    } catch (error) {
        console.error("Template download error:", error);
        alert("Unable to download the Excel template.");
    }
};


window.openAddStudentModal = function () {

    const sectionSelect =
        document.getElementById("section-select");

    const selectedSection =
        sectionSelect ? sectionSelect.value : "";

    if (!selectedSection) {

        alert(
            "Please select a section first before adding a student manually."
        );

        if (sectionSelect) {
            sectionSelect.focus();
        }

        return;
    }

    document.getElementById(
        "add-student-section-name"
    ).textContent = selectedSection;

    document.getElementById(
        "add-student-id"
    ).value = "";

    document.getElementById(
        "add-student-surname"
    ).value = "";

    document.getElementById(
        "add-student-first-name"
    ).value = "";

    document.getElementById(
        "add-student-last-name"
    ).value = "";

    document.getElementById(
        "add-student-email"
    ).value = "";

    document.getElementById(
        "add-student-birthday"
    ).value = "";

    const saveBtn =
        document.getElementById("save-add-student-btn");

    saveBtn.disabled = false;

    saveBtn.innerHTML =
        '<i class="bi bi-person-check"></i> Add Student';

    document.getElementById(
        "add-student-modal"
    ).style.display = "flex";

    setTimeout(() => {

        document
            .getElementById("add-student-id")
            ?.focus();

    }, 50);
};


window.closeAddStudentModal = function () {

    const modal =
        document.getElementById("add-student-modal");

    if (modal) {
        modal.style.display = "none";
    }
};


window.saveManualStudent = async function () {

    const sectionSelect =
        document.getElementById("section-select");

    const selectedSectionName =
        sectionSelect ? sectionSelect.value : "";

    const parentDocId =
        sectionDocMapping[selectedSectionName];

    const id =
        document.getElementById("add-student-id")
            .value
            .trim();

    const surname =
        document.getElementById("add-student-surname")
            .value
            .trim();

    const firstName =
        document.getElementById("add-student-first-name")
            .value
            .trim();

    const lastName =
        document.getElementById("add-student-last-name")
            .value
            .trim();

    const email =
        document.getElementById("add-student-email")
            .value
            .trim();

    const birthday =
        document.getElementById("add-student-birthday")
            .value;


    if (!selectedSectionName || !parentDocId) {

        alert("Please select a valid section first.");

        return;
    }


    if (
        !id ||
        !surname ||
        !firstName ||
        !lastName ||
        !email ||
        !birthday
    ) {

        alert("Please complete all student fields.");

        return;
    }


    const emailInput =
        document.getElementById("add-student-email");

    if (
        emailInput &&
        !emailInput.checkValidity()
    ) {

        alert(
            "Please enter a valid student email address."
        );

        emailInput.focus();

        return;
    }


    if (!/^\d+$/.test(id)) {

        alert(
            "Student Number must contain numbers only."
        );

        document
            .getElementById("add-student-id")
            .focus();

        return;
    }


    const fullName =
        `${surname}, ${firstName} ${lastName}`
            .replace(/\s+/g, " ")
            .trim();


    const saveBtn =
        document.getElementById(
            "save-add-student-btn"
        );

    saveBtn.disabled = true;

    saveBtn.innerHTML =
        '<i class="bi bi-hourglass-split"></i> Adding...';

    toggleLoading(true);


    try {

        const selectedSectionStudents =
            allStudents.filter(
                s => s.section === selectedSectionName
            );


        if (
            selectedSectionStudents.some(
                s => String(s.id) === id
            )
        ) {

            alert(
                `Student Number ${id} already exists in ${selectedSectionName}.`
            );

            return;
        }


        /*
         * Check archived students as well.
         */
        try {

            const archiveSnap =
                await getDocs(
                    collection(
                        db,
                        "archivedStudents"
                    )
                );

            if (
                archiveSnap.docs.some(
                    d => String(d.id) === id
                )
            ) {

                alert(
                    `Student Number ${id} already exists in the archive.`
                );

                return;
            }

        } catch (archiveError) {

            console.warn(
                "Could not check archived students:",
                archiveError
            );
        }


        /*
         * Create the student inside:
         *
         * sections
         *   └── selected section
         *       └── classList
         *           └── student number
         */
        const studentRef =
            doc(
                db,
                "sections",
                parentDocId,
                "classList",
                id
            );


        /*
         * Birthday becomes the initial password.
         *
         * Example:
         * 2005-01-14
         *
         * becomes:
         * 20050114
         */
        const studentPassword =
            formatBirthdayToPassword(
                birthday
            );


        await setDoc(
            studentRef,
            {
                id: id,

                name: fullName,

                email: email,

                birthday: birthday,

                password: studentPassword,

                progress: 0,

                idleTime: "0m",

                difficulty: [
                    0,
                    0,
                    0,
                    0,
                    0
                ],

                attempts: []
            }
        );


        /*
         * Close modal after successful save.
         */
        closeAddStudentModal();


        /*
         * Refresh the student data.
         */
        await fetchClassList();


        /*
         * Keep the teacher on the section
         * they were working with.
         */
        const refreshedSectionSelect =
            document.getElementById(
                "section-select"
            );


        if (refreshedSectionSelect) {

            refreshedSectionSelect.value =
                selectedSectionName;

            loadStudents(
                selectedSectionName
            );
        }


        alert(
            `Student ${fullName} was added successfully to ${selectedSectionName}.`
        );


    } catch (error) {

        console.error(
            "Manual student add error:",
            error
        );

        alert(
            "Failed to add the student. Please check your connection and try again."
        );


    } finally {

        saveBtn.disabled = false;

        saveBtn.innerHTML =
            '<i class="bi bi-person-check"></i> Add Student';

        toggleLoading(false);
    }
};
function renderAdvancedAnalysis(student) {
    const container = document.getElementById("student-analysis");
    if (!container) return;

    const difficulty = student.difficulty || [0,0,0,0,0];

    const topics = [
        {
            lesson: "Variables & Data Types",
            explanation: "Student struggles in understanding variable declaration, assigning values, and identifying proper data types."
        },
        {
            lesson: "If-Else Statements",
            explanation: "Student struggles in understanding decision making and logical conditions."
        },
        {
            lesson: "Loops",
            explanation: "Student struggles in repetition logic and controlling loop execution."
        },
        {
            lesson: "Functions",
            explanation: "Student struggles in method creation, parameters, and code organization."
        },
        {
            lesson: "Firestore",
            explanation: "Student struggles in database integration and backend communication."
        }
    ];

    const highest = Math.max(...difficulty);
    const weakestIndex = difficulty.indexOf(highest);
    const weakestTopic = topics[weakestIndex];

    let level = "";
    let recommendation = "";
    let severityColor = "";

    if (highest >= 7) {
        level = "Critical Learning Gap";
        severityColor = "#ef4444";
        recommendation = "Teacher should reteach this lesson step-by-step with visual demonstrations and guided coding exercises.";
    } else if (highest >= 4) {
        level = "Moderate Difficulty";
        severityColor = "#f59e0b";
        recommendation = "Student understands some concepts but still needs additional practice and reinforcement activities.";
    } else {
        level = "Good Understanding";
        severityColor = "#10b981";
        recommendation = "Student shows good understanding and may proceed to more advanced challenges.";
    }

    let wrongs = 0;
    let timeSpent = 0;

    if (student.gameStats && student.gameStats[weakestIndex]) {
        wrongs = student.gameStats[weakestIndex].wrongs || 0;
        timeSpent = student.gameStats[weakestIndex].time || 0;
    }

    let teacherInsight = "";
    if (wrongs >= 5) {
        teacherInsight = "The student repeatedly made incorrect attempts, indicating confusion with the lesson logic rather than simple syntax errors.";
    } else if (timeSpent >= 300) {
        teacherInsight = "The student spent a long time solving the activity, suggesting hesitation and lack of confidence.";
    } else {
        teacherInsight = "The student was able to continue with manageable difficulty.";
    }

    container.innerHTML = `
        <div style="background:white; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:18px; box-shadow:0 4px 15px rgba(0,0,0,0.08);">
            <div style="padding:15px; border-left:6px solid ${severityColor}; background:#f8fafc; border-radius:8px;">
                <h3 style="margin:0; color:${severityColor};">${level}</h3>
                <p style="margin-top:10px; line-height:1.6;">
                    <strong>${student.name}</strong> is currently struggling most in <strong>${weakestTopic.lesson}</strong>.
                </p>
                <p style="line-height:1.6;">${weakestTopic.explanation}</p>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:15px;">
                <div style="background:#f1f5f9; padding:15px; border-radius:10px;">
                    <h4>Wrong Attempts</h4>
                    <div style="font-size:28px; font-weight:bold; color:#ef4444;">${wrongs}</div>
                </div>
                <div style="background:#f1f5f9; padding:15px; border-radius:10px;">
                    <h4>Time Spent</h4>
                    <div style="font-size:28px; font-weight:bold; color:#3b82f6;">${Math.round(timeSpent / 60)} mins</div>
                </div>
                <div style="background:#f1f5f9; padding:15px; border-radius:10px;">
                    <h4>Difficulty Score</h4>
                    <div style="font-size:28px; font-weight:bold; color:#f59e0b;">${highest}/10</div>
                </div>
            </div>

            <div style="background:#eff6ff; padding:18px; border-radius:10px; border-left:5px solid #3b82f6;">
                <h4 style="margin-top:0;">Teacher Insight</h4>
                <p style="line-height:1.7;">${teacherInsight}</p>
            </div>

            <div style="background:#f0fdf4; padding:18px; border-radius:10px; border-left:5px solid #10b981;">
                <h4 style="margin-top:0;">Suggested Intervention</h4>
                <p style="line-height:1.7;">${recommendation}</p>
            </div>
        </div>
    `;
}

// 6. EXCEL IMPORT LOGIC
window.updateFileName = function(input) {
    const label = document.getElementById("file-name-text"); 
    if (input.files.length > 0) {
        const name = input.files[0].name;
        if(label) {
            label.textContent = name;
            label.style.fontWeight = "600";
        }
    }
};

function excelDateToJSDate(value) {
    if (typeof value === "number") {
        const date = new Date((value - 25569) * 86400 * 1000);
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(date.getUTCDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    if (typeof value === "string") {
        const raw = value.trim();
        const parts = raw.split(/[\/\-\.]/);

        if (parts.length === 3) {
            let [day, month, year] = parts;
            day = day.padStart(2, "0");
            month = month.padStart(2, "0");

            if (year.length === 2) {
                year = "20" + year;
            }
            return `${year}-${month}-${day}`;
        }
    }
    return "";
}

window.importExcel = async function () {
    const input = document.getElementById("excel-input");
    const sectionSelect = document.getElementById("section-select");
    const label = document.getElementById("file-name-text");

    if (!input.files.length) return alert("Please choose a file first!");
    if (!sectionSelect.value) return alert("Please select a section before importing!");

    const selectedSectionName = sectionSelect.value;
    const parentDocId = sectionDocMapping[selectedSectionName];

    const reader = new FileReader();
    reader.onload = async (e) => {
        toggleLoading(true);
        try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            const batch = writeBatch(db);

            const allExistingIds = new Set(allStudents.map(s => String(s.id)));

            try {
                const archiveSnap = await getDocs(collection(db, "archivedStudents"));
                archiveSnap.forEach(doc => {
                    allExistingIds.add(String(doc.id));
                });
                console.log(`✅ Found ${archiveSnap.size} archived students - preventing duplicates`);
            } catch (archiveError) {
                console.warn("Could not check archive collection:", archiveError);
            }

            let addedCount = 0;
            let skippedCount = 0;
            let skippedActiveCount = 0;
            let skippedArchiveCount = 0;

            data.forEach(row => {
                const values = Object.values(row);

                const sId = String(values[0] || "").trim();
                const sName = values[1] || "Unknown";
                const sEmail = values[2] || "No Email";
                const rawBirthday = values[3];

                const sBirthday = excelDateToJSDate(rawBirthday);
                const sPassword = formatBirthdayToPassword(sBirthday);

                if (!sId) return;

                if (!allExistingIds.has(sId)) {
                    const studentRef = doc(db, "sections", parentDocId, "classList", sId);

                    batch.set(studentRef, {
                        id: sId,
                        name: sName,
                        email: sEmail,
                        birthday: sBirthday,
                        password: sPassword,
                        progress: 0,
                        idleTime: "0m",
                        difficulty: [0, 0, 0, 0, 0],
                        attempts: []
                    });

                    addedCount++;
                    allExistingIds.add(sId);
                } else {
                    skippedCount++;
                    const isActive = allStudents.some(s => s.id === sId);
                    if (isActive) {
                        skippedActiveCount++;
                    } else {
                        skippedArchiveCount++;
                    }
                }
            });

            if (addedCount > 0) {
                await batch.commit();
                alert(`Import Complete!\n` +
                      `Added: ${addedCount} new students\n` +
                      `Skipped Active: ${skippedActiveCount}\n` +
                      `Skipped Archived: ${skippedArchiveCount}`);
                await fetchClassList();
            } else {
                alert(`No new students found.\n` +
                      `Active duplicates: ${skippedActiveCount}\n` +
                      `Archived duplicates: ${skippedArchiveCount}`);
            }

            input.value = "";
            if (label) {
                label.textContent = "Choose File";
                label.style.fontWeight = "normal";
            }

        } catch (err) {
            console.error(err);
            alert("Error reading Excel file.");
        } finally {
            toggleLoading(false);
        }
    };

    reader.readAsArrayBuffer(input.files[0]);
};

window.handlePasswordReset = function() {
    const modal = document.getElementById("reset-password-modal");
    const sectionDrop = document.getElementById("reset-section-select");
    const searchInput = document.getElementById("reset-search-input");
    const studentDrop = document.getElementById("reset-student-select");
    
    document.getElementById("reset-step-1").style.display = "block";
    document.getElementById("reset-step-2").style.display = "none";
    searchInput.value = "";
    
    sectionDrop.innerHTML = '<option value="">-- Select Section --</option>';
    currentUserSection.forEach(sec => {
        const opt = document.createElement("option");
        opt.value = sec;
        opt.textContent = sec;
        sectionDrop.appendChild(opt);
    });

    const filterResetList = () => {
        const selectedSec = sectionDrop.value;
        const term = searchInput.value.toLowerCase();
        
        studentDrop.innerHTML = '';
        
        if (!selectedSec) {
            studentDrop.innerHTML = '<option disabled>Please select a section first...</option>';
            return;
        }

        const filtered = allStudents.filter(s => {
            const matchesSection = s.section === selectedSec;
            const matchesSearch = s.name.toLowerCase().includes(term) || 
                                  s.id.toString().includes(term);
            return matchesSection && matchesSearch;
        });

        if (filtered.length === 0) {
            studentDrop.innerHTML = '<option disabled>No students found...</option>';
        } else {
            filtered.sort((a,b) => a.name.localeCompare(b.name)).forEach(s => {
                const opt = document.createElement("option");
                opt.value = s.id;
                opt.textContent = `${s.name} (${s.id})`;
                studentDrop.appendChild(opt);
            });
        }
    };

    sectionDrop.onchange = filterResetList;
    searchInput.oninput = filterResetList;

    modal.style.display = "flex";
};

window.closeResetModal = () => {
    document.getElementById("reset-password-modal").style.display = "none";
};

window.confirmResetSelection = function() {
    const studentId = document.getElementById("reset-student-select").value;
    
    if (!studentId) {
        alert("Please select a student from the list!");
        return;
    }

    const student = allStudents.find(s => s.id === studentId);
    
    document.getElementById("reset-step-1").style.display = "none";
    document.getElementById("reset-step-2").style.display = "block";
    document.getElementById("reset-confirm-text").innerHTML = 
        `<i class="bi bi-exclamation-triangle"></i> You are about to reset the password for <b>${student.name}</b>. This action cannot be undone.`;

    document.getElementById("final-reset-btn").onclick = () => saveNewPassword(student);
};

window.backToStep1 = () => {
    document.getElementById("reset-step-1").style.display = "block";
    document.getElementById("reset-step-2").style.display = "none";
};

async function saveNewPassword(student) {
    const newPass = document.getElementById("new-password-input").value.trim();
    if (newPass.length < 4) {
        alert("Password must be at least 4 characters long.");
        return;
    }

    toggleLoading(true);
    try {
        const studentRef = doc(db, "sections", student.parentDocId, "classList", student.id);
        
        await updateDoc(studentRef, {
            password: newPass
        });

        alert(`Success! Password for ${student.name} has been updated.`);
        closeResetModal();
        await fetchClassList();
    } catch (error) {
        console.error("Firestore Update Error:", error);
        alert("Failed to update password. Please check your connection.");
    } finally {
        toggleLoading(false);
    }
}

// Event Listeners
document.getElementById("excel-input")?.addEventListener("change", function() {
    updateFileName(this);
});

document.getElementById("section-select")?.addEventListener("change", (e) => loadStudents(e.target.value));
document.getElementById("search-student")?.addEventListener("input", () => {
    const sec = document.getElementById("section-select").value;
    loadStudents(sec);
});

// 7. LESSON GAP ANALYSIS ENGINE
function generateInstructorSummary(students) {
    if (!students || students.length === 0) {
        return "No student data available for analysis.";
    }

    let avgProgress = students.reduce((acc, s) => acc + (s.progress || 0), 0) / students.length;

    let avgIdle = students.reduce((acc, s) => {
        let time = parseInt((s.idleTime || "0").replace("m", ""));
        return acc + (isNaN(time) ? 0 : time);
    }, 0) / students.length;

    let difficultyTotals = [0, 0, 0, 0, 0];

    students.forEach(s => {
        (s.difficulty || [0,0,0,0,0]).forEach((val, i) => {
            difficultyTotals[i] += val;
        });
    });

    let difficultyAvg = difficultyTotals.map(d => d / students.length);

    let maxDifficulty = Math.max(...difficultyAvg);
    let hardestLevelIndex = difficultyAvg.indexOf(maxDifficulty);
    let hardestLevel = `Level ${hardestLevelIndex + 1}`;

    let roadblock = "";
    let reason = "";
    let recommendation = "";

    if (maxDifficulty >= 7) {
        roadblock = `${hardestLevel} - Complex Logic & Problem Solving`;
        reason = `Students show high difficulty (${maxDifficulty.toFixed(1)}/10) at ${hardestLevel}, indicating they struggle when tasks require combining multiple concepts.`;
        recommendation = `Break the problem into smaller steps and guide students through each step before coding. Encourage them to explain their logic before writing code.`;
    } else if (avgProgress < 50) {
        roadblock = `Early Programming Concepts (Variables / Output)`;
        reason = `Average progress is only ${Math.round(avgProgress)}%, suggesting students are not confidently completing even basic tasks.`;
        recommendation = `Reinforce fundamentals using simple examples and repetition. Use guided exercises before independent tasks.`;
    } else if (avgIdle > 10) {
        roadblock = `Code Understanding & Debugging`;
        reason = `High idle time (~${Math.round(avgIdle)} minutes) suggests students are getting stuck and unsure how to proceed.`;
        recommendation = `Introduce step-by-step tracing. Ask students to predict outputs before running their code.`;
    } else {
        roadblock = `Applying Concepts Independently`;
        reason = `Students perform well initially but show difficulty as tasks become less guided.`;
        recommendation = `Provide scaffolded challenges that gradually reduce hints to build independence.`;
    }

    return `
        <strong>📌 Identified Roadblock:</strong><br>
        ${roadblock}
        <br><br>

        <strong>📊 Why This is Happening:</strong><br>
        ${reason}
        <br><br>

        <strong>✅ Teaching Recommendation:</strong><br>
        ${recommendation}
    `;
}

// 8. UPDATE UI WITH SUMMARY
function updateInstructorSummary(filteredStudents) {
    const container = document.getElementById("instructor-summary-content");
    if (!container) return;

    const summary = generateInstructorSummary(filteredStudents);
    container.innerHTML = summary;
}

window.logoutUser = async () => {
    stopStudentRealtimeListeners();
    try {
        await signOut(auth);
        localStorage.removeItem(VERIFIED_KEY);
        sessionStorage.removeItem(VERIFIED_KEY);
        window.location.href = '../index.html'; 
    } catch (error) {
        console.error("Logout error", error);
    }
};

window.closeLogoutPopup = () => {
    document.getElementById("logout-popup").style.display = "none";
};

window.showLogoutPopup = () => {
    document.getElementById("logout-popup").style.display = "flex";
};

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeToggleBtn = document.getElementById("theme-toggle");
    if (themeToggleBtn) {
        const icon = themeToggleBtn.querySelector("i");
        if (icon) {
            icon.className = (theme === "dark") ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
        }
    }

    // Refresh the attempt chart colors when the dashboard theme changes.
    const attemptSelect = document.getElementById("attempt-subject-select");
    const attemptCanvas = document.getElementById("attemptProgressChart");
    if (attemptSelect && attemptCanvas && currentStudentForAttemptChart) {
        renderStudentAttemptProgressChart(currentStudentForAttemptChart, attemptSelect.value);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('dashboard-theme') || 'light';
    applyTheme(savedTheme);

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('dashboard-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            localStorage.setItezzm('dashboard-theme', newTheme);
            applyTheme(newTheme);
        });
    }
});

window.addEventListener('storage', (event) => {
    if (event.key === 'dashboard-theme') {
        const newTheme = event.newValue;
        applyTheme(newTheme);
    }
});

// Additional presentation controls: use the existing section/search filtering pipeline.
document.getElementById("progress-filter")?.addEventListener("change", () => loadStudents(document.getElementById("section-select")?.value || ""));
document.getElementById("student-sort")?.addEventListener("change", () => loadStudents(document.getElementById("section-select")?.value || ""));
