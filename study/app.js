// --- SUPABASE DATABASE CONFIGURATION ---
const SUPABASE_URL = "https://xkwdguskmvschpmkkwxs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrd2RndXNrbXZzY2hwbWtrd3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NDE3MjksImV4cCI6MjEwNzIxNzcyOX0.hlVk4ZK4BBJD6IG0W8-IxwxhlB5jMMHVLNNRHyxg0HE"; // <-- Make sure your anon key is pasted here

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let trackerData = {
    projects: [],
    exams: [],
    weeklyStudy: []
};

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
    const syncStatus = document.getElementById('syncStatus');

    // Manual Time Inputs
    const manualHours = document.getElementById('manualHours');
    const manualMins = document.getElementById('manualMins');
    const manualLogBtn = document.getElementById('manualLogBtn');

    // Modal Editor Elements
    const openEditorBtn = document.getElementById('openEditorBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const editorModal = document.getElementById('editorModal');
    const addProjBtn = document.getElementById('addProjBtn');
    const addExamBtn = document.getElementById('addExamBtn');
    const manageItemsList = document.getElementById('manageItemsList');

    let timerInterval = null;
    let elapsedSeconds = 0;

    // Fetch initial data from Supabase DB
    async function loadFromDatabase() {
        if (!supabase) return;
        try {
            const { data, error } = await supabase
                .from('study_dashboard')
                .select('data')
                .eq('id', 'main')
                .single();

            if (error) throw error;
            if (data && data.data) {
                trackerData = data.data;
                if (syncStatus) syncStatus.textContent = "⚡ Supabase Database: Connected";
            }
        } catch (err) {
            console.warn("Could not fetch from Supabase, checking local storage.", err);
            if (syncStatus) syncStatus.textContent = "⚠️ Offline / Local Storage Mode";
            const local = localStorage.getItem('study_db_fallback');
            if (local) trackerData = JSON.parse(local);
        } finally {
            renderProjects();
            renderExams();
            renderChart();
        }
    }

    // Save updated data to Supabase DB
    async function saveToDatabase() {
        localStorage.setItem('study_db_fallback', JSON.stringify(trackerData));
        renderProjects();
        renderExams();
        renderChart();

        if (!supabase) return;

        try {
            const { error } = await supabase
                .from('study_dashboard')
                .upsert({ id: 'main', data: trackerData });

            if (error) throw error;
            console.log("Successfully synchronized with Supabase!");
        } catch (err) {
            console.error("Error writing to Supabase DB:", err);
            alert("Database write error: " + err.message);
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
            li.innerHTML = `<span class="item-title">${proj.name}</span>` +
                `<span class="item-hrs">${Number(proj.totalHours).toFixed(1)} hrs</span>`;
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
                `<div class="item-title">${exam.name}</div>` +
                `<div style="font-size:10px; color:#94a3b8;">${dateFormatted}</div>` +
                `</div>` +
                `<span class="badge-2000s">${countdownText}</span>`;
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

    // Modal Manager Render (Subject Delete + Exam Inline Edit/Delete)
    function renderManagerList() {
        if (!manageItemsList) return;
        manageItemsList.innerHTML = '';

        const pTitle = document.createElement('div');
        pTitle.style.fontWeight = 'bold';
        pTitle.style.margin = '6px 0';
        pTitle.textContent = "Subjects:";
        manageItemsList.appendChild(pTitle);

        (trackerData.projects || []).forEach((proj, idx) => {
            const row = document.createElement('div');
            row.className = 'item-edit-row';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.innerHTML = `<span style="flex: 1; font-weight: bold; color: #f1f5f9;">${proj.name} (${proj.totalHours.toFixed(1)} hrs)</span>`;
            
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-red';
            delBtn.textContent = 'Delete';
            delBtn.onclick = async () => {
                trackerData.projects.splice(idx, 1);
                await saveToDatabase();
                renderManagerList();
            };
            row.appendChild(delBtn);
            manageItemsList.appendChild(row);
        });

        const eTitle = document.createElement('div');
        eTitle.style.fontWeight = 'bold';
        eTitle.style.margin = '12px 0 6px 0';
        eTitle.textContent = "Exams & Dates:";
        manageItemsList.appendChild(eTitle);

        (trackerData.exams || []).forEach((ex, idx) => {
            const row = document.createElement('div');
            row.className = 'item-edit-row';

            // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
            const dateVal = ex.date ? ex.date.substring(0, 16) : '';

            row.innerHTML = `
                <div style="margin-bottom: 4px;">
                    <input type="text" id="editExamName_${idx}" value="${ex.name}" style="margin-bottom: 4px;">
                    <input type="datetime-local" id="editExamDate_${idx}" value="${dateVal}" style="margin-bottom: 4px;">
                </div>
                <div style="display: flex; gap: 4px; justify-content: flex-end;">
                    <button id="saveExamBtn_${idx}" class="btn-green">Save Changes</button>
                    <button id="delExamBtn_${idx}" class="btn-red">Delete</button>
                </div>
            `;
            manageItemsList.appendChild(row);

            // Bind inline save/delete actions
            setTimeout(() => {
                const saveBtn = document.getElementById(`saveExamBtn_${idx}`);
                const delBtn = document.getElementById(`delExamBtn_${idx}`);

                if (saveBtn) {
                    saveBtn.onclick = async () => {
                        const newName = document.getElementById(`editExamName_${idx}`).value.trim();
                        const newDate = document.getElementById(`editExamDate_${idx}`).value;
                        if (!newName || !newDate) return alert("Exam title and date cannot be empty.");

                        trackerData.exams[idx].name = newName;
                        trackerData.exams[idx].date = newDate;
                        await saveToDatabase();
                        alert("Exam updated successfully!");
                        renderManagerList();
                    };
                }

                if (delBtn) {
                    delBtn.onclick = async () => {
                        trackerData.exams.splice(idx, 1);
                        await saveToDatabase();
                        renderManagerList();
                    };
                }
            }, 0);
        });
    }

    if (openEditorBtn) openEditorBtn.onclick = () => { renderManagerList(); editorModal.style.display = 'flex'; };
    if (closeModalBtn) closeModalBtn.onclick = () => { editorModal.style.display = 'none'; };

    if (addProjBtn) {
        addProjBtn.onclick = async () => {
            const name = document.getElementById('newProjName').value.trim();
            const hrs = parseFloat(document.getElementById('newProjHours').value) || 0;
            if (!name) return alert("Enter project name");

            trackerData.projects.push({ id: Date.now().toString(), name: name, totalHours: hrs });
            document.getElementById('newProjName').value = '';
            document.getElementById('newProjHours').value = '';
            await saveToDatabase();
            renderManagerList();
        };
    }

    if (addExamBtn) {
        addExamBtn.onclick = async () => {
            const name = document.getElementById('newExamName').value.trim();
            const date = document.getElementById('newExamDate').value;
            if (!name || !date) return alert("Enter exam name and date");

            trackerData.exams.push({ name: name, date: date });
            document.getElementById('newExamName').value = '';
            document.getElementById('newExamDate').value = '';
            await saveToDatabase();
            renderManagerList();
        };
    }

    // Manual Hours/Minutes Input Event
    if (manualLogBtn) {
        manualLogBtn.onclick = async () => {
            const hrs = parseFloat(manualHours.value) || 0;
            const mins = parseFloat(manualMins.value) || 0;

            if (hrs === 0 && mins === 0) {
                alert("Please enter hours or minutes to add.");
                return;
            }

            const totalAddedHours = hrs + (mins / 60);

            // Update selected project total
            const selectedProjId = projectSelect.value;
            const proj = (trackerData.projects || []).find(p => p.id === selectedProjId);
            if (proj) {
                proj.totalHours += totalAddedHours;
            } else {
                alert("Please select a subject first!");
                return;
            }

            // Update Today's bar chart
            const todayEntry = (trackerData.weeklyStudy || []).find(d => d.day === "Today");
            if (todayEntry) todayEntry.hours += totalAddedHours;

            // Clear input fields
            manualHours.value = '';
            manualMins.value = '';

            // Save to DB & refresh UI
            await saveToDatabase();
        };
    }

    // Timer Session Controls
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
            if (elapsedSeconds === 0) {
                alert("Start the timer first to log study time.");
                return;
            }

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

            await saveToDatabase();
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

    loadFromDatabase();
    setInterval(renderExams, 60000);
});