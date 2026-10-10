// --- SUPABASE DATABASE CONFIGURATION ---
const SUPABASE_URL = "https://xkwdguskmvschpmkkwxs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrd2RndXNrbXZzY2hwbWtrd3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NDE3MjksImV4cCI6MjEwNzIxNzcyOX0.hlVk4ZK4BBJD6IG0W8-IxwxhlB5jMMHVLNNRHyxg0HE"; // <-- Paste your anon key here
const USER_ROW_ID = "zoya"; // Unique row key for Zoya in Supabase
const LOCAL_STORAGE_KEY = "zoya_study_tracker_data";

// Helper functions for dynamic rolling dates
function getDateKey(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDateDisplayLabel(offsetDays = 0) {
    if (offsetDays === 0) return "Today";
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function generateDefaultDailyLogs() {
    const logs = {};
    const sampleHours = [1.5, 2.0, 3.0, 2.5, 4.0, 1.0, 3.5, 2.0, 2.5, 3.0, 4.5, 2.0, 1.5, 2.0];
    for (let i = 13; i >= 0; i--) {
        const key = getDateKey(i);
        logs[key] = sampleHours[13 - i];
    }
    return logs;
}

// Starter Data for Zoya
const DEFAULT_DATA = {
    dailyGoal: 3.0,
    projects: [
        { id: "101", name: "Organic Chemistry", totalHours: 18.5 },
        { id: "102", name: "Biochemistry", totalHours: 22.0 },
        { id: "103", name: "Calculus II", totalHours: 15.0 },
        { id: "104", name: "Physics & Lab", totalHours: 12.5 }
    ],
    exams: [
        { name: "Organic Chemistry Midterm", date: "2026-11-05T10:00:00" },
        { name: "Biochemistry Quiz 3", date: "2026-11-18T13:30:00" }
    ],
    dailyLogs: generateDefaultDailyLogs()
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
    const streakDisplay = document.getElementById('streakDisplay');

    const goalTextDisplay = document.getElementById('goalTextDisplay');
    const goalBarFill = document.getElementById('goalBarFill');
    const dailyGoalInput = document.getElementById('dailyGoalInput');
    const saveGoalBtn = document.getElementById('saveGoalBtn');

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
        renderGoalAndStreak();
    }

    renderAll();

    async function loadData() {
        try {
            const local = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
                    trackerData = parsed;
                    if (!trackerData.dailyLogs) trackerData.dailyLogs = generateDefaultDailyLogs();
                    if (!trackerData.dailyGoal) trackerData.dailyGoal = 3.0;
                    renderAll();
                }
            }
        } catch (e) {
            console.warn("LocalStorage read error:", e);
        }

        const client = getSupabaseClient();
        if (client) {
            if (dbStatus) dbStatus.textContent = "status: connecting to supabase...";
            try {
                const { data, error } = await client
                    .from('study_dashboard')
                    .select('data')
                    .eq('id', USER_ROW_ID)
                    .maybeSingle();

                if (error) {
                    console.error("Supabase fetch error:", error);
                    if (dbStatus) dbStatus.textContent = `status: error (${error.message || error.code})`;
                } else if (data && data.data && Array.isArray(data.data.projects) && data.data.projects.length > 0) {
                    trackerData = data.data;
                    if (!trackerData.dailyLogs) trackerData.dailyLogs = generateDefaultDailyLogs();
                    if (!trackerData.dailyGoal) trackerData.dailyGoal = 3.0;
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trackerData));
                    renderAll();
                    if (dbStatus) dbStatus.textContent = "status: connected";
                } else {
                    if (dbStatus) dbStatus.textContent = "status: seeding initial data...";
                    await saveData();
                    if (dbStatus) dbStatus.textContent = "status: connected";
                }
            } catch (err) {
                console.error("Supabase connection exception:", err);
                if (dbStatus) dbStatus.textContent = "status: connection error";
            }
        } else {
            if (dbStatus) dbStatus.textContent = "status: local storage mode";
        }
    }

    async function saveData() {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trackerData));
        renderAll();

        const client = getSupabaseClient();
        if (client) {
            try {
                const { error } = await client
                    .from('study_dashboard')
                    .upsert({ id: USER_ROW_ID, data: trackerData });

                if (error) {
                    console.error("Supabase save error:", error);
                    if (dbStatus) dbStatus.textContent = `status: save failed (${error.message})`;
                }
            } catch (err) {
                console.error("Supabase save exception:", err);
            }
        }
    }

    function addTimeLogged(hoursToAdd) {
        const selectedProjId = projectSelect.value;
        const proj = (trackerData.projects || []).find(p => p.id === selectedProjId);
        if (!proj) return false;

        proj.totalHours += hoursToAdd;

        const todayKey = getDateKey(0);
        if (!trackerData.dailyLogs) trackerData.dailyLogs = {};
        trackerData.dailyLogs[todayKey] = (trackerData.dailyLogs[todayKey] || 0) + hoursToAdd;

        return true;
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

        const logs = trackerData.dailyLogs || {};
        const daysData = [];
        let total14DayHours = 0;

        for (let i = 13; i >= 0; i--) {
            const key = getDateKey(i);
            const label = getDateDisplayLabel(i);
            const hrs = logs[key] || 0;
            daysData.push({ key, label, hours: hrs, isToday: i === 0 });
            total14DayHours += hrs;
        }

        const maxHours = Math.max(...daysData.map(d => d.hours), 6.0);

        daysData.forEach(entry => {
            const heightPercent = (entry.hours / maxHours) * 100;

            const col = document.createElement('div');
            col.className = 'chart-col';
            col.innerHTML = `<div class="chart-val">${entry.hours > 0 ? entry.hours.toFixed(1) : ''}</div>` +
                `<div class="chart-bar-wrap">` +
                `<div class="chart-bar ${entry.isToday ? 'today' : ''}" style="height: ${heightPercent}%;"></div>` +
                `</div>` +
                `<div class="chart-label">${entry.label}</div>`;
            chartContainer.appendChild(col);
        });

        if (weeklyTotalDisplay) {
            weeklyTotalDisplay.textContent = `Total: ${total14DayHours.toFixed(1)} hrs`;
        }
    }

    function renderGoalAndStreak() {
        const logs = trackerData.dailyLogs || {};
        const todayKey = getDateKey(0);
        const todayHours = logs[todayKey] || 0;
        const goal = trackerData.dailyGoal || 3.0;

        const percent = Math.min(100, Math.round((todayHours / goal) * 100));
        if (goalTextDisplay) {
            goalTextDisplay.textContent = `${todayHours.toFixed(1)} / ${goal.toFixed(1)} hrs (${percent}%)`;
        }
        if (goalBarFill) {
            goalBarFill.style.width = `${percent}%`;
        }
        if (dailyGoalInput) {
            dailyGoalInput.value = goal;
        }

        let streak = 0;
        let dayOffset = (todayHours > 0) ? 0 : 1;

        while (true) {
            const k = getDateKey(dayOffset);
            if ((logs[k] || 0) > 0) {
                streak++;
                dayOffset++;
            } else {
                break;
            }
        }

        if (streakDisplay) {
            streakDisplay.textContent = `🔥 ${streak} day streak`;
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

    if (saveGoalBtn) {
        saveGoalBtn.onclick = async () => {
            const val = parseFloat(dailyGoalInput.value);
            if (isNaN(val) || val <= 0) return alert("Please enter a valid target hour.");
            trackerData.dailyGoal = val;
            await saveData();
            alert("Daily goal updated!");
        };
    }

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
            const success = addTimeLogged(totalAdded);
            if (!success) return alert("Select a subject first.");

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

            addTimeLogged(hoursAdded);

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