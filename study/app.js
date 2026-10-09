const REPO_OWNER = "arock417";
const REPO_NAME = "arock417.github.io"; // Change if your repository name is different
const FILE_PATH = "study/data.json";

let trackerData = {
    projects: [
        { id: "1", name: "Flight Dynamics & Controls", totalHours: 24.5 },
        { id: "2", name: "Orbital Mechanics", totalHours: 18.0 },
        { id: "3", name: "NASA USLI Payload Development", totalHours: 42.0 }
    ],
    exams: [
        { name: "Flight Dynamics Midterm", date: "2026-10-28T14:00:00" },
        { name: "Orbital Mechanics Exam 1", date: "2026-11-12T09:30:00" }
    ],
    weeklyStudy: [
        { day: "Sat", hours: 2.5 },
        { day: "Sun", hours: 4.0 },
        { day: "Mon", hours: 1.5 },
        { day: "Tue", hours: 3.5 },
        { day: "Wed", hours: 2.0 },
        { day: "Thu", hours: 5.0 },
        { day: "Today", hours: 1.2 }
    ]
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
    const ghTokenInput = document.getElementById('ghTokenInput');
    const saveTokenBtn = document.getElementById('saveTokenBtn');

    let timerInterval = null;
    let elapsedSeconds = 0;

    if (ghTokenInput) {
        ghTokenInput.value = localStorage.getItem('gh_pat_token') || '';
    }

    if (saveTokenBtn) {
        saveTokenBtn.addEventListener('click', () => {
            localStorage.setItem('gh_pat_token', ghTokenInput.value.trim());
            alert('GitHub Access Token saved in browser storage!');
        });
    }

    async function loadData() {
        try {
            const res = await fetch('./data.json?cache=' + Date.now());
            if (res.ok) {
                const remoteData = await res.json();
                if (remoteData) {
                    if (Array.isArray(remoteData.projects)) trackerData.projects = remoteData.projects;
                    if (Array.isArray(remoteData.exams)) trackerData.exams = remoteData.exams;
                    if (Array.isArray(remoteData.weeklyStudy)) trackerData.weeklyStudy = remoteData.weeklyStudy;
                }
            }
        } catch (e) {
            console.warn("Could not load data.json, using local fallback data.", e);
        } finally {
            renderProjects();
            renderExams();
            renderChart();
        }
    }

    function encodeBase64Utf8(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        bytes.forEach(b => {
            binary += String.fromCharCode(b);
        });
        return btoa(binary);
    }

    async function commitToGitHub() {
        const token = localStorage.getItem('gh_pat_token') || (ghTokenInput ? ghTokenInput.value.trim() : '');
        if (!token) {
            alert("Time updated locally! Enter your GitHub Token at the top right to save changes permanently to your repo.");
            return;
        }

        try {
            const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
            const getRes = await fetch(getUrl, { 
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                } 
            });

            if (!getRes.ok) {
                const errData = await getRes.json().catch(() => ({}));
                throw new Error(`GitHub API HTTP ${getRes.status}: ${errData.message || 'Check username, repo name, or token.'}`);
            }

            const fileMeta = await getRes.json();
            const updatedContentBase64 = encodeBase64Utf8(JSON.stringify(trackerData, null, 2));

            const putRes = await fetch(getUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    message: "Log study session hours via website",
                    content: updatedContentBase64,
                    sha: fileMeta.sha
                })
            });

            if (putRes.ok) {
                console.log("Logged hours successfully committed to GitHub!");
            } else {
                const err = await putRes.json();
                alert(`GitHub Sync Failed: ${err.message}`);
            }
        } catch (err) {
            console.error("Error committing to GitHub:", err);
            alert(`Could not sync to GitHub: ${err.message}`);
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
            li.className = 'list-item';
            li.innerHTML = `<span class="item-title">${proj.name}</span>` +
                `<span class="item-sub" style="font-weight: bold; color: var(--accent-cyan);">${Number(proj.totalHours).toFixed(1)} hrs</span>`;
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
            li.className = 'list-item';
            li.innerHTML = `<div>` +
                `<div class="item-title">${exam.name}</div>` +
                `<div class="item-sub">${dateFormatted}</div>` +
                `</div>` +
                `<span class="countdown-badge">${countdownText}</span>`;
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

            renderProjects();
            renderChart();
            await commitToGitHub();
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