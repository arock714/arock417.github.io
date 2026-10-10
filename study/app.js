// --- SUPABASE DATABASE CONFIGURATION ---
const SUPABASE_URL = "https://xkwdguskmvschpmkkwxs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrd2RndXNrbXZzY2hwbWtrd3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NDE3MjksImV4cCI6MjEwNzIxNzcyOX0.hlVk4ZK4BBJD6IG0W8-IxwxhlB5jMMHVLNNRHyxg0HE"; // <-- Paste your anon key here

// Default Fallback Data (Guarantees content is never blank)
const DEFAULT_DATA = {
    projects: [
        { id: "1", name: "Flight Dynamics & Controls", totalHours: 24.5 },
        { id: "2", name: "Orbital Mechanics", totalHours: 18.0 },
        { id: "3", name: "NASA USLI Payload Development", totalHours: 42.0 },
        { id: "4", name: "SolidWorks Modeling", totalHours: 12.0 }
    ],
    exams: [
        { name: "Flight Dynamics Midterm", date: "2026-10-28T14:00:00" },
        { name: "Orbital Mechanics Exam 1", date: "2026-11-12T09:30:00" },
        { name: "Structures & Materials Final", date: "2026-12-18T10:00:00" }
    ],
    weeklyStudy: [
        { day: "9/27", hours: 2.0 }, { day: "9/28", hours: 3.5 }, { day: "9/29", hours: 1.0 },
        { day: "9/30", hours: 4.5 }, { day: "10/1", hours: 2.5 }, { day: "10/2", hours: 5.0 },
        { day: "10/3", hours: 3.0 }, { day: "10/4", hours: 1.5 }, { day: "10/5", hours: 4.0 },
        { day: "10/6", hours: 2.0 }, { day: "10/7", hours: 3.0 }, { day: "10/8", hours: 5.5 },
        { day: "10/9", hours: 2.0 }, { day: "Today", hours: 1.2 }
    ]
};

let trackerData = JSON.parse(JSON.stringify(DEFAULT_DATA));

function getSupabaseClient() {
    if (typeof window.supabase === 'undefined') return null;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    if (SUPABASE_URL.includes("YOUR_") || SUPABASE_ANON_KEY.includes("YOUR_")) return null;
    try {
        return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.error("Supabase client init error:", e);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const projectSelect = document.getElementById('projectSelect');
    const projectList = document.getElementById('projectList');
    const examList = document.getElementById('examList');
    const timerDisplay = document.getElementById('timerDisplay');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const logBtn = document.getElementById('logBtn');
    const resetBtn = document.getElementById('resetBtn');
    const chartContainer = document.getElementById('chartContainer');
    const weeklyTotalDisplay = document.getElementById('weeklyTotalDisplay');
    const dbStatus = document.getElementById('dbStatus');

    const manualHours = document.getElementById('manualHours');
    const manualMins = document.getElementById('manualMins');
    const manualLogBtn = document.getElementById('manualLogBtn');

    const openEditorBtn = document.getElementById('openEditorBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const editorModal = document.getElementById('editorModal');
    const addProjBtn = document.getElementById('addProjBtn');
    const addExamBtn = document.getElementById('addExamBtn');
    const manageItemsList = document.getElementById('manageItemsList');

    let timerInterval = null;
    let elapsedSeconds = 0;

    function renderAll() {
        renderProjects();
        renderExams();
        renderChart();
    }

    // Synchronous immediate render on page load
    renderAll();

    async function loadData() {
        // 1. Try local storage
        try {
            const local = localStorage.getItem('study_tracker_data');
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
                    trackerData = parsed;
                    renderAll();
                }
            }
        } catch (e) {
            console.warn("LocalStorage read error:", e);
        }

        // 2. Try Supabase DB
        const client = getSupabaseClient();
        if (client) {
            if (dbStatus) dbStatus.textContent = "status: connecting to supabase...";
            try {
                const { data, error } = await client
                    .from('study_dashboard')
                    .select('data')
                    .eq('id', 'main')
                    .maybeSingle();

                if (error) {
                    console.error("Supabase fetch error:", error);
                    if (dbStatus) dbStatus.textContent = `status: supabase error (${error.message || error.code})`;
                } else if (data && data.data && Array.isArray(data.data.projects) && data.data.projects.length > 0) {
                    trackerData = data.data;
                    localStorage.setItem('study_tracker_data', JSON.stringify(trackerData));
                    renderAll();
                    if (dbStatus) dbStatus.textContent = "status: connected to supabase";
                } else {
                    // Seed initial data if table row is empty
                    if (dbStatus) dbStatus.textContent = "status: seeding initial data to supabase...";
                    await saveData();
                    if (dbStatus) dbStatus.textContent = "status: connected to supabase (initialized)";
                }
            } catch (err) {
                console.error("Supabase connection exception:", err);
                if (dbStatus) dbStatus.textContent = "status: connection error";
            }
        } else {
            if (dbStatus) dbStatus.textContent = "status: local storage mode (paste anon key in app.js)";
        }
    }

    async function saveData() {
        localStorage.setItem('study_tracker_data', JSON.stringify(trackerData));
        renderAll();

        const client = getSupabaseClient();
        if (client) {
            try {
                const { error } = await client
                    .from('study_dashboard')
                    .upsert({ id: 'main', data: trackerData });

                if (error) {
                    console.error("Supabase save error:", error);
                    if (dbStatus) dbStatus.textContent = `status: save failed (${error.message})`;
                }
            } catch (err) {
                console.error("Supabase save exception:", err);
            }
        }
    }

    function renderProjects() {
        if (!projectSelect || !projectList) return;
        const currentSelected = projectSelect.value;
        projectSelect.innerHTML = '';
        projectList.innerHTML = '';

        const projectsList = trackerData.projects || [];
        projectsList.forEach(proj => {
            const opt = document.createElement('option');
            opt.value = proj.id;
            opt.textContent = proj.name;
            if (proj.id === currentSelected) opt.selected = true;
            projectSelect.appendChild(opt);

            const li = document.createElement('li');
            li.innerHTML = `<span class="item-name">${proj.name}</span>` +
                `<span class="item-val">${Number(proj.totalHours || 0).toFixed(1)} hrs</span>`;
            projectList.appendChild(li);
        });
    }

    function renderExams() {
        if (!examList) return;
        examList.innerHTML = '';
        const now = new Date().getTime();

        const examsList = trackerData.exams || [];
        const sortedExams = [...examsList].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedExams.forEach(exam => {
            const examTime = new Date(exam.date).getTime();
            const diffMs = examTime - now;

            let countdownText = "";
            if (diffMs <= 0) {
                countdownText = "Completed";
            } else {
                const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                countdownText = `${days}d ${hours}h left`;
            }

            const dateFormatted = new Date(exam.date).toLocaleString([], {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const li = document.createElement('li');
            li.innerHTML = `<div>` +
                `<div class="item-name">${exam.name}</div>` +
                `<div style="font-size:0.8rem; color: var(--text-muted);">${dateFormatted}</div>` +
                `</div>` +
                `<span class="item-val">${countdownText}</span>`;
            examList.appendChild(li);
        });
    }

    function renderChart() {
        if (!chartContainer) return;
        chartContainer.innerHTML = '';

        const weeklyList = trackerData.weeklyStudy || [];
        const maxHours = Math.max(...weeklyList.map(d => d.hours), 6.0);
        let totalWeeklyHours = 0;

        weeklyList.forEach(entry => {
            totalWeeklyHours += entry.hours;
            const heightPercent = (entry.hours / maxHours) * 100;
            const isToday = entry.day === "Today";

            const col = document.createElement('div');
            col.className = 'chart-col';
            col.innerHTML = `<div class="chart-val">${entry.hours > 0 ? entry.hours.toFixed(1) : ''}</div>` +
                `<div class="chart-bar-wrap">` +
                `<div class="chart-bar ${isToday ? 'today' : ''}" style="height: ${heightPercent}%;"></div>` +
                `</div>` +
                `<div class="chart-label">${entry.day}</div>`;
            chartContainer.appendChild(col);
        });

        if (weeklyTotalDisplay) {
            weeklyTotalDisplay.textContent = `Total: ${totalWeeklyHours.toFixed(1)} hrs`;
        }
    }

    function formatHMS(sec) {
        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    function renderManagerList() {
        if (!manageItemsList) return;
        manageItemsList.innerHTML = '';

        const pTitle = document.createElement('div');
        pTitle.style.fontWeight = 'bold';
        pTitle.style.margin = '8px 0 4px 0';
        pTitle.textContent = "Subjects:";
        manageItemsList.appendChild(pTitle);

        (trackerData.projects || []).forEach((proj, idx) => {
            const row = document.createElement('div');
            row.className = 'edit-block';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.innerHTML = `<span style="flex: 1; font-weight: bold;">${proj.name} (${Number(proj.totalHours || 0).toFixed(1)} hrs)</span>`;

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-outline';
            delBtn.textContent = 'Delete';
            delBtn.onclick = async () => {
                trackerData.projects.splice(idx, 1);
                await saveData();
                renderManagerList();
            };
            row.appendChild(delBtn);
            manageItemsList.appendChild(row);
        });

        const eTitle = document.createElement('div');
        eTitle.style.fontWeight = 'bold';
        eTitle.style.margin = '14px 0 4px 0';
        eTitle.textContent = "Exams & Dates:";
        manageItemsList.appendChild(eTitle);

        (trackerData.exams || []).forEach((ex, idx) => {
            const row = document.createElement('div');
            row.className = 'edit-block';
            const dateVal = ex.date ? ex.date.substring(0, 16) : '';

            row.innerHTML = `
                <div style="margin-bottom: 6px;">
                    <input type="text" id="editExamName_${idx}" value="${ex.name}">
                    <input type="datetime-local" id="editExamDate_${idx}" value="${dateVal}">
                </div>
                <div style="display: flex; gap: 6px; justify-content: flex-end;">
                    <button id="saveExamBtn_${idx}">Save</button>
                    <button id="delExamBtn_${idx}" class="btn-outline">Delete</button>
                </div>
            `;
            manageItemsList.appendChild(row);

            setTimeout(() => {
                const saveBtn = document.getElementById(`saveExamBtn_${idx}`);
                const delBtn = document.getElementById(`delExamBtn_${idx}`);

                if (saveBtn) {
                    saveBtn.onclick = async () => {
                        const newName = document.getElementById(`editExamName_${idx}`).value.trim();
                        const newDate = document.getElementById(`editExamDate_${idx}`).value;
                        if (!newName || !newDate) return alert("Fill in title and date.");

                        trackerData.exams[idx].name = newName;
                        trackerData.exams[idx].date = newDate;
                        await saveData();
                        alert("Exam updated!");
                        renderManagerList();
                    };
                }

                if (delBtn) {
                    delBtn.onclick = async () => {
                        trackerData.exams.splice(idx, 1);
                        await saveData();
                        renderManagerList();
                    };
                }
            }, 0);
        });
    }

    if (openEditorBtn) openEditorBtn.onclick = (e) => { e.preventDefault(); renderManagerList(); editorModal.style.display = 'flex'; };
    if (closeModalBtn) closeModalBtn.onclick = () => { editorModal.style.display = 'none'; };

    if (addProjBtn) {
        addProjBtn.onclick = async () => {
            const name = document.getElementById('newProjName').value.trim();
            const hrs = parseFloat(document.getElementById('newProjHours').value) || 0;
            if (!name) return alert("Enter subject title");

            trackerData.projects.push({ id: Date.now().toString(), name: name, totalHours: hrs });
            document.getElementById('newProjName').value = '';
            document.getElementById('newProjHours').value = '';
            await saveData();
            renderManagerList();
        };
    }

    if (addExamBtn) {
        addExamBtn.onclick = async () => {
            const name = document.getElementById('newExamName').value.trim();
            const date = document.getElementById('newExamDate').value;
            if (!name || !date) return alert("Enter exam title and date");

            trackerData.exams.push({ name: name, date: date });
            document.getElementById('newExamName').value = '';
            document.getElementById('newExamDate').value = '';
            await saveData();
            renderManagerList();
        };
    }

    if (manualLogBtn) {
        manualLogBtn.onclick = async () => {
            const hrs = parseFloat(manualHours.value) || 0;
            const mins = parseFloat(manualMins.value) || 0;

            if (hrs === 0 && mins === 0) return alert("Enter hours or minutes.");

            const totalAdded = hrs + (mins / 60);
            const selectedProjId = projectSelect.value;
            const proj = (trackerData.projects || []).find(p => p.id === selectedProjId);
            if (!proj) return alert("Select a subject first.");

            proj.totalHours += totalAdded;

            const todayEntry = (trackerData.weeklyStudy || []).find(d => d.day === "Today");
            if (todayEntry) todayEntry.hours += totalAdded;

            manualHours.value = '';
            manualMins.value = '';

            await saveData();
        };
    }

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'inline-block';
            if (logBtn) logBtn.style.display = 'inline-block';

            timerInterval = setInterval(() => {
                elapsedSeconds++;
                if (timerDisplay) timerDisplay.textContent = formatHMS(elapsedSeconds);
            }, 1000);
        });
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            clearInterval(timerInterval);
            if (startBtn) startBtn.style.display = 'inline-block';
            pauseBtn.style.display = 'none';
        });
    }

    if (logBtn) {
        logBtn.addEventListener('click', async () => {
            if (elapsedSeconds === 0) return;

            clearInterval(timerInterval);
            const hoursAdded = elapsedSeconds / 3600;

            const selectedProjId = projectSelect.value;
            const proj = (trackerData.projects || []).find(p => p.id === selectedProjId);
            if (proj) proj.totalHours += hoursAdded;

            const todayEntry = (trackerData.weeklyStudy || []).find(d => d.day === "Today");
            if (todayEntry) todayEntry.hours += hoursAdded;

            elapsedSeconds = 0;
            if (timerDisplay) timerDisplay.textContent = '00:00:00';
            if (startBtn) startBtn.style.display = 'inline-block';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (logBtn) logBtn.style.display = 'none';

            await saveData();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearInterval(timerInterval);
            elapsedSeconds = 0;
            if (timerDisplay) timerDisplay.textContent = '00:00:00';
            if (startBtn) startBtn.style.display = 'inline-block';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (logBtn) logBtn.style.display = 'none';
        });
    }

    loadData();
    setInterval(renderExams, 60000);
});