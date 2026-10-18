import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { 
    getFirestore, collection, getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
// Fixed: Added getAuth to the imports
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// ----------------------------
// CONFIG & INITIALIZATION
// ----------------------------
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
// Fixed: Initialized the auth instance
const auth = getAuth(app); 

let allStudents = [];
let difficultyChart;

const toggleLoading = (show) => {
    const loader = document.getElementById("loading-overlay");
    if(loader) loader.style.display = show ? "flex" : "none";
};

window.showLogoutPopup = function() {
    const popup = document.getElementById("logout-popup");
    if (popup) {
        popup.style.display = "flex";
    }
};

// 2. Hide the Popup (Stay button)
window.closeLogoutPopup = function() {
    const popup = document.getElementById("logout-popup");
    if (popup) {
        popup.style.display = "none";
    }
};

// 3. Execute Logout
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

// ----------------------------
// 1. DATA FETCHING
// ----------------------------
async function fetchAllDatabaseContent() {
    toggleLoading(true); 
    allStudents = [];
    const sectionSelect = document.getElementById("section-select");
    
    if (sectionSelect) sectionSelect.innerHTML = '<option value="">-- All Sections --</option>';

    try {
        const sectionsSnap = await getDocs(collection(db, "sections"));
        
        const fetchPromises = sectionsSnap.docs.map(async (sectionDoc) => {
            const sectionName = sectionDoc.data().name || sectionDoc.id;
            
            if (sectionSelect) {
                const opt = document.createElement("option");
                opt.value = sectionName;
                opt.textContent = sectionName;
                sectionSelect.appendChild(opt);
            }

            const classSnap = await getDocs(collection(db, "sections", sectionDoc.id, "classList"));
            classSnap.forEach(studentDoc => {
                allStudents.push({
                    ...studentDoc.data(),
                    sectionName: sectionName,
                    firebaseId: studentDoc.id
                });
            });
        });

        await Promise.all(fetchPromises);
        renderTable(""); 
        
    } catch (error) {
        console.error("Database Fetch Error:", error);
    } finally {
        toggleLoading(false); 
    }
}

// ----------------------------
// 2. RENDERING LOGIC (Updated with Empty State UI)
// ----------------------------
function renderTable(filterSection) {
    const tableBody = document.getElementById("students-table");
    const searchTerm = document.getElementById("search-student")?.value.toLowerCase() || "";

    if (!tableBody) return;

    // 1. Filter the data
    let filtered = allStudents.filter(s => {
        const matchesSection = !filterSection || s.sectionName === filterSection;
        const matchesSearch = !searchTerm || 
                              (s.name && s.name.toLowerCase().includes(searchTerm)) || 
                              (s.id && s.id.toString().includes(searchTerm));
        return matchesSection && matchesSearch;
    });

    // 2. Sort alphabetically by name
    filtered.sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // Update Totals
    document.getElementById("card-total-students").textContent = filtered.length;
    let avg = filtered.length > 0 ? Math.round(filtered.reduce((acc, s) => acc + (s.progress || 0), 0) / filtered.length) : 0;
    document.getElementById("average-score").textContent = avg + "%";

    // 3. UI logic: Handle Empty State vs Table rows
    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <div style="font-size: 2rem; margin-bottom: 10px;"><i class="bi bi-inbox"></i></div>
                    <h4>No Students Found</h4>
                    <p>Try adjusting your search or section filter.</p>
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = filtered.map(s => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 15px; font-weight: 600;">${s.id || "---"}</td>
                <td style="padding: 15px;">${s.name || "Unknown"}</td>
                <td style="padding: 15px;"><span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 20px;">${s.sectionName}</span></td>
                <td style="padding: 15px;">
                    <div style="width: 100px; background: #e2e8f0; height: 6px; border-radius: 10px;">
                        <div style="width: ${s.progress || 0}%; background: #3b82f6; height: 100%; border-radius: 10px;"></div>
                    </div>
                    <small style="color: #64748b;">${s.progress || 0}%</small>
                </td>
                <td style="padding: 15px;">
                    <button onclick="viewAnalysis('${s.firebaseId}')" style="background: #3b82f6; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
                        Details
                    </button>
                </td>
            </tr>
        `).join("");
    }
}
// ----------------------------
// 3. STUDENT-SPECIFIC SUMMARY (Firestore-based)
// ----------------------------
const safeText = value => String(value ?? "--").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numberOrNull = value => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const topicColor = value => value >= 7 ? '#ef4444' : value >= 4 ? '#f59e0b' : '#10b981';
function studentTopics(student) {
    const content = student['Subject Content'] || student.subjectContent;
    if (content && typeof content === 'object' && !Array.isArray(content)) {
        return Object.entries(content).filter(([,v]) => v && typeof v === 'object').map(([name, value]) => {
            let wrongs = 0, found = false;
            function collect(node) {
                if (!node || typeof node !== 'object') return;
                if (Object.prototype.hasOwnProperty.call(node, 'wrongAttempts')) {
                    const n = numberOrNull(node.wrongAttempts);
                    if (n !== null && n >= 0) { wrongs += n; found = true; }
                    return;
                }
                Object.values(node).forEach(collect);
            }
            collect(value);
            return found ? {name:name.replace(/_/g,' '), wrongs, score:Math.min(10, wrongs)} : null;
        }).filter(Boolean).sort((a,b)=> b.wrongs-a.wrongs || a.name.localeCompare(b.name));
    }
    // Legacy fallback only if real Subject Content is absent.
    if (Array.isArray(student.difficulty)) return student.difficulty.map((v,i)=> {
        const n = numberOrNull(v);
        return n===null ? null : {name:`Level ${i+1}`,wrongs:null,score:Math.max(0,Math.min(10,n))};
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
    return [];
}
function renderTopicSummary(topics) {
    const list = document.getElementById('summary-topic-list');
    list.replaceChildren();
    if (!topics.length) { list.textContent='No topic difficulty records available yet.'; return; }
    topics.forEach((topic, index) => {
        const item = document.createElement('div'); item.className='summary-topic';
        const heading=document.createElement('div'); heading.className='summary-topic-head';
        const name=document.createElement('span'); name.textContent=`${index+1}. ${topic.name}`;
        const score=document.createElement('strong'); score.textContent=`${topic.score}/10`; score.style.color=topicColor(topic.score);
        heading.append(name,score);
        const track=document.createElement('div'); track.className='summary-track';
        const fill=document.createElement('div'); fill.style.width=`${topic.score*10}%`; fill.style.backgroundColor=topicColor(topic.score);
        track.append(fill);
        const note=document.createElement('small'); note.textContent=topic.wrongs===null ? 'Legacy level score' : `${topic.wrongs} recorded wrong attempts`;
        item.append(heading,track,note); list.append(item);
    });
}
window.viewAnalysis = function(firebaseId) {
    const student = allStudents.find(s=>String(s.firebaseId)===String(firebaseId));
    if (!student) return;
    const panel=document.getElementById('analysis-section');
    panel.style.display='flex';
    document.body.classList.add('summary-modal-open');
    document.getElementById('summary-description').textContent=`${student.name || 'Student'} · ${student.sectionName || 'No Section'}`;
    const profile=document.getElementById('student-details-content');
    const fields=[['Full Name',student.name],['Student Number',student.id],['Section',student.sectionName],['Idle Time',student.idleTime ?? 'Not recorded']];
    profile.innerHTML=fields.map(([label,value])=>`<div class="summary-profile-field"><span>${label}</span><strong>${safeText(value)}</strong></div>`).join('');
    const progress=numberOrNull(student.progress);
    const progressValue=progress===null?null:Math.max(0,Math.min(100,progress));
    document.getElementById('summary-progress').textContent=progressValue===null?'--':`${Math.round(progressValue)}%`;
    document.getElementById('summary-progress-fill').style.width=`${progressValue??0}%`;
    const topics=studentTopics(student);
    renderTopicSummary(topics);
    const highest=topics.length?Math.max(...topics.map(t=>t.score)):null;
    const totals=topics.filter(t=>t.wrongs!==null);
    const wrongs=totals.length?totals.reduce((sum,t)=>sum+t.wrongs,0):null;
    document.getElementById('summary-difficulty').textContent=highest===null?'--':`${highest}/10`;
    document.getElementById('summary-wrongs').textContent=wrongs===null?'--':String(wrongs);
    const insight=document.getElementById('summary-insight-content');
    if (!topics.length) insight.textContent='No attempt records available yet. More data will appear after the student completes learning activities.';
    else {
        const hardest=topics[0];
        const progressPhrase=progressValue===null?'Game progress is not yet recorded.':`Game progress: ${Math.round(progressValue)}%.`;
        insight.innerHTML=`<p><strong>Highest recorded difficulty:</strong> ${safeText(hardest.name)} (${hardest.score}/10).</p><p>${progressPhrase}</p><p>This summary reflects recorded errors and does not directly measure understanding.</p>`;
    }
    renderChart(topics);
    panel.focus({preventScroll:true});
};
function renderChart(topics) {
    const canvas=document.getElementById('difficultyChart');
    if (!canvas) return;
    if (difficultyChart) { difficultyChart.destroy(); difficultyChart=null; }
    document.getElementById('summary-chart-empty').hidden=topics.length>0;
    canvas.hidden=topics.length===0;
    if (!topics.length || typeof Chart==='undefined') return;
    difficultyChart=new Chart(canvas.getContext('2d'),{
        type:'bar',
        data:{labels:topics.map(t=>t.name),datasets:[{label:'Difficulty Score',data:topics.map(t=>t.score),backgroundColor:topics.map(t=>topicColor(t.score)),borderRadius:5}]},
        options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:(ctx)=>topics[ctx.dataIndex].wrongs===null?'Legacy score':`${topics[ctx.dataIndex].wrongs} recorded wrong attempts`}}},scales:{x:{beginAtZero:true,max:10,ticks:{stepSize:2}},y:{ticks:{autoSkip:false}}}}
    });
}
function closeStudentSummary() {
    const panel = document.getElementById('analysis-section');
    if (!panel || panel.style.display === 'none') return;
    panel.style.display = 'none';
    document.body.classList.remove('summary-modal-open');
}
document.getElementById('close-analysis')?.addEventListener('click', closeStudentSummary);
document.getElementById('analysis-section')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeStudentSummary();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeStudentSummary();
});

// ----------------------------
// 4. INITIALIZE & EVENTS
// ----------------------------
fetchAllDatabaseContent();

document.getElementById("section-select")?.addEventListener("change", (e) => renderTable(e.target.value));
document.getElementById("search-student")?.addEventListener("input", () => {
    const sel = document.getElementById("section-select").value;
    renderTable(sel);
});

// Fixed: Added event listener to trigger the logout popup
document.getElementById("logout-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.showLogoutPopup();
});