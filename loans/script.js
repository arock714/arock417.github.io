// --- Application State & Defaults ---
let loansData = [
    { title: 'Fed Unsub 1', date: '2026-08-31', p: 10129.80, apr: 8.07 },
    { title: 'Fed Unsub 2', date: '2027-01-15', p: 10250.00, apr: 8.07 },
    { title: 'Private 1', date: '2027-01-15', p: 24104.00, apr: 10.50 },
    { title: 'Fed Unsub 3', date: '2027-08-15', p: 10250.00, apr: 8.07 },
    { title: 'Private 2', date: '2027-08-15', p: 9858.00, apr: 10.50 }
];

let chartInstance = null;
const startDate = new Date(2026, 9, 15); // JS months are 0-indexed (9 = Oct)
const repaymentStart = new Date(2028, 5, 16); // 5 = Jun

// --- DOM Setup ---
document.addEventListener('DOMContentLoaded', () => {
    renderLoans();
    
    // Bind slider values to labels
    for (let i = 1; i <= 4; i++) {
        const slider = document.getElementById(`phase${i}`);
        const label = document.getElementById(`val${i}`);
        slider.addEventListener('input', (e) => label.innerText = e.target.value);
    }

    document.getElementById('add-loan-btn').addEventListener('click', addLoan);
    document.getElementById('update-btn').addEventListener('click', runSimulation);

    // Initial Run
    runSimulation();
});

function renderLoans() {
    const container = document.getElementById('loans-container');
    container.innerHTML = '';
    loansData.forEach((loan, index) => {
        const div = document.createElement('div');
        div.className = 'loan-item';
        div.innerHTML = `
            <input type="text" id="l-title-${index}" value="${loan.title}" placeholder="Loan Name">
            <div class="input-row">
                <input type="date" id="l-date-${index}" value="${loan.date}">
                <input type="number" id="l-p-${index}" value="${loan.p}" step="0.01" placeholder="Principal">
                <input type="number" id="l-apr-${index}" value="${loan.apr}" step="0.01" placeholder="APR %">
            </div>
            <button class="btn-delete" onclick="deleteLoan(${index})">Delete Loan</button>
        `;
        container.appendChild(div);
    });
}

function addLoan() {
    loansData.push({ title: 'New Loan', date: '2027-01-01', p: 5000, apr: 5.00 });
    renderLoans();
}

function deleteLoan(index) {
    loansData.splice(index, 1);
    renderLoans();
}

function syncLoansFromUI() {
    const updatedLoans = [];
    for (let i = 0; i < loansData.length; i++) {
        updatedLoans.push({
            title: document.getElementById(`l-title-${i}`).value,
            date: document.getElementById(`l-date-${i}`).value,
            p: parseFloat(document.getElementById(`l-p-${i}`).value) || 0,
            apr: parseFloat(document.getElementById(`l-apr-${i}`).value) || 0
        });
    }
    loansData = updatedLoans;
    return updatedLoans;
}

// --- Simulation Logic ---
function simulate(loansConfig, payments) {
    // Deep copy loans for simulation
    let simLoans = loansConfig.map(l => ({
        ...l, 
        origDate: new Date(l.date), 
        active: false, 
        currentP: l.p, 
        currentI: 0,
        aprDec: l.apr / 100.0
    }));

    const totalDays = Math.floor((repaymentStart - startDate) / (1000 * 60 * 60 * 24));
    let dates = [];
    let balances = [];
    
    let currentDate = new Date(startDate);
    
    // In-School Phase
    for (let d = 0; d <= totalDays; d++) {
        let phase = 4;
        if (currentDate < new Date(2027, 0, 15)) phase = 1;
        else if (currentDate < new Date(2027, 7, 15)) phase = 2;
        else if (currentDate < new Date(2027, 11, 15)) phase = 3;

        // Activate loans
        simLoans.forEach(loan => {
            if (!loan.active && currentDate >= loan.origDate) loan.active = true;
        });

        // Accrue interest daily
        let dailyBal = 0;
        simLoans.forEach(loan => {
            if (loan.active) {
                loan.currentI += loan.currentP * (loan.aprDec / 365.25);
                dailyBal += loan.currentP + loan.currentI;
            }
        });

        // Record end of month for simplicity in chart
        if (currentDate.getDate() === 1) {
            dates.push(currentDate.toISOString().split('T')[0]);
            balances.push(dailyBal);
        }

        // Apply Payments on the 14th
        if (currentDate.getDate() === 14) {
            let pmt = payments[phase] || 0;
            if (pmt > 0) {
                // Debt Avalanche: Sort active by APR desc
                let activeLoans = simLoans.filter(l => l.active).sort((a, b) => b.aprDec - a.aprDec);
                for (let loan of activeLoans) {
                    if (pmt <= 0) break;
                    if (loan.currentI >= pmt) {
                        loan.currentI -= pmt; pmt = 0;
                    } else {
                        pmt -= loan.currentI; loan.currentI = 0;
                        if (loan.currentP >= pmt) {
                            loan.currentP -= pmt; pmt = 0;
                        } else {
                            pmt -= loan.currentP; loan.currentP = 0;
                        }
                    }
                }
            }
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    let totBalRepay = simLoans.reduce((sum, l) => sum + l.currentP + l.currentI, 0);

    // Post-Grad 10-Year Amortization
    let totalPostGradPmt = 0;
    simLoans.forEach(loan => {
        let capBal = loan.currentP + loan.currentI;
        let mRate = loan.aprDec / 12;
        loan.postGradPmt = (capBal > 0 && mRate > 0) ? (capBal * (mRate * Math.pow(1 + mRate, 120)) / (Math.pow(1 + mRate, 120) - 1)) : 0;
        loan.repayBal = capBal;
        totalPostGradPmt += loan.postGradPmt;
    });

    for (let m = 1; m <= 120; m++) {
        let totMBal = 0;
        simLoans.forEach(loan => {
            let interest = loan.repayBal * (loan.aprDec / 12);
            let prin = loan.postGradPmt - interest;
            loan.repayBal = Math.max(0, loan.repayBal - prin);
            totMBal += loan.repayBal;
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
        dates.push(currentDate.toISOString().split('T')[0]);
        balances.push(totMBal);
    }

    return { dates, balances, totalPostGradPmt, totBalRepay };
}

function runSimulation() {
    const currentLoans = syncLoansFromUI();
    const payments = {
        1: parseFloat(document.getElementById('phase1').value) || 0,
        2: parseFloat(document.getElementById('phase2').value) || 0,
        3: parseFloat(document.getElementById('phase3').value) || 0,
        4: parseFloat(document.getElementById('phase4').value) || 0
    };

    const dynSim = simulate(currentLoans, payments);
    const baseSim = simulate(currentLoans, {1:0, 2:0, 3:0, 4:0});

    updateChart(baseSim, dynSim);
    
    document.getElementById('results-summary').innerHTML = `
        <strong>Simulation Results:</strong><br>
        Baseline ($0 in school): <strong>$${Math.round(baseSim.totBalRepay).toLocaleString()}</strong> at graduation -> <strong>$${Math.round(baseSim.totalPostGradPmt).toLocaleString()} /mo</strong> for 10 years.<br>
        Dynamic Strategy: <strong>$${Math.round(dynSim.totBalRepay).toLocaleString()}</strong> at graduation -> <strong>$${Math.round(dynSim.totalPostGradPmt).toLocaleString()} /mo</strong> for 10 years.
    `;
}

function updateChart(baseSim, dynSim) {
    const ctx = document.getElementById('loanChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dynSim.dates,
            datasets: [
                {
                    label: 'Baseline ($0/mo In-School)',
                    data: baseSim.balances,
                    borderColor: '#d9534f',
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    tension: 0.1
                },
                {
                    label: 'Dynamic Payments Strategy',
                    data: dynSim.balances,
                    borderColor: '#1b5e20',
                    borderWidth: 3,
                    fill: false,
                    pointRadius: 0,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) { return '$' + value.toLocaleString(); }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + Math.round(context.raw).toLocaleString();
                        }
                    }
                }
            }
        }
    });
}
