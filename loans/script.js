let loansData = [
    { title: 'Fed Unsub 1', date: '2026-08-31', p: 10129.80, apr: 8.07 },
    { title: 'Fed Unsub 2', date: '2027-01-15', p: 10250.00, apr: 8.07 },
    { title: 'Private 1', date: '2027-01-15', p: 24104.00, apr: 10.50 },
    { title: 'Fed Unsub 3', date: '2027-08-15', p: 10250.00, apr: 8.07 },
    { title: 'Private 2', date: '2027-08-15', p: 9858.00, apr: 10.50 }
];

let chartInstance = null;
const startDate = new Date(2026, 9, 15); // Oct 15, 2026
const repaymentStart = new Date(2028, 5, 16); // June 16, 2028

document.addEventListener('DOMContentLoaded', () => {
    renderLoans();
    
    // Sliders to Label sync
    for (let i = 1; i <= 4; i++) {
        const slider = document.getElementById(`phase${i}`);
        const label = document.getElementById(`val${i}`);
        slider.addEventListener('input', (e) => label.innerText = e.target.value);
    }

    document.getElementById('add-loan-btn').addEventListener('click', addLoan);
    document.getElementById('update-btn').addEventListener('click', runSimulation);

    // Reset zoom on double click
    document.getElementById('loanChart').addEventListener('dblclick', () => {
        if(chartInstance) chartInstance.resetZoom();
    });

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
                <input type="date" id="l-date-${index}" value="${loan.date}" title="Disbursement Date">
                <input type="number" id="l-p-${index}" value="${loan.p}" step="0.01" placeholder="Principal ($)">
                <input type="number" id="l-apr-${index}" value="${loan.apr}" step="0.01" placeholder="APR (%)">
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

// FORMATTER: Converts numbers to $X,XXX
const fmt = (num) => '$' + Math.round(num).toLocaleString();

function simulate(loansConfig, payments, repaymentYears) {
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
    let totalInSchoolPaid = 0;
    let originalPrincipalTotal = simLoans.reduce((sum, l) => sum + l.p, 0);
    
    let currentDate = new Date(startDate);
    
    // Phase 1: In-School & Grace
    for (let d = 0; d <= totalDays; d++) {
        let phase = 4;
        if (currentDate < new Date(2027, 0, 15)) phase = 1;
        else if (currentDate < new Date(2027, 7, 15)) phase = 2;
        else if (currentDate < new Date(2027, 11, 15)) phase = 3;

        simLoans.forEach(loan => {
            if (!loan.active && currentDate >= loan.origDate) loan.active = true;
        });

        let dailyBal = 0;
        simLoans.forEach(loan => {
            if (loan.active) {
                loan.currentI += loan.currentP * (loan.aprDec / 365.25);
                dailyBal += loan.currentP + loan.currentI;
            }
        });

        if (currentDate.getDate() === 1) {
            dates.push(currentDate.toISOString().split('T')[0]);
            balances.push(dailyBal);
        }

        // Apply Payment on 14th
        if (currentDate.getDate() === 14) {
            let pmt = payments[phase] || 0;
            if (pmt > 0) {
                totalInSchoolPaid += pmt;
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

    // Phase 2: Post-Grad Amortization
    let totalPostGradPmt = 0;
    const months = repaymentYears * 12;
    
    simLoans.forEach(loan => {
        let capBal = loan.currentP + loan.currentI;
        let mRate = loan.aprDec / 12;
        loan.postGradPmt = (capBal > 0 && mRate > 0) ? (capBal * (mRate * Math.pow(1 + mRate, months)) / (Math.pow(1 + mRate, months) - 1)) : 0;
        loan.repayBal = capBal;
        totalPostGradPmt += loan.postGradPmt;
    });

    for (let m = 1; m <= months; m++) {
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

    // Math: Total Interest = (Total Payments Made) - (Original Principal)
    let totalPaidEver = totalInSchoolPaid + (totalPostGradPmt * months);
    let totalInterestPaid = totalPaidEver - originalPrincipalTotal;

    return { dates, balances, totalPostGradPmt, totBalRepay, totalInterestPaid };
}

function runSimulation() {
    const currentLoans = syncLoansFromUI();
    const payments = {
        1: parseFloat(document.getElementById('phase1').value) || 0,
        2: parseFloat(document.getElementById('phase2').value) || 0,
        3: parseFloat(document.getElementById('phase3').value) || 0,
        4: parseFloat(document.getElementById('phase4').value) || 0
    };
    const term = parseInt(document.getElementById('repayment-term').value) || 10;

    const dynSim = simulate(currentLoans, payments, term);
    const baseSim = simulate(currentLoans, {1:0, 2:0, 3:0, 4:0}, term);

    updateKPIs(baseSim, dynSim);
    updateChart(baseSim, dynSim);
}

function updateKPIs(base, dyn) {
    const interestSaved = base.totalInterestPaid - dyn.totalInterestPaid;
    
    // Interest KPI
    document.getElementById('kpi-interest').innerText = fmt(dyn.totalInterestPaid);
    const intSub = document.getElementById('kpi-interest-saved');
    intSub.innerText = interestSaved >= 0 ? `Saved: ${fmt(interestSaved)}` : `Cost: ${fmt(Math.abs(interestSaved))}`;
    intSub.className = interestSaved >= 0 ? 'kpi-subtext text-green' : 'kpi-subtext text-red';

    // Monthly KPI
    document.getElementById('kpi-monthly').innerText = fmt(dyn.totalPostGradPmt) + '/mo';
    document.getElementById('kpi-monthly-compare').innerText = `vs ${fmt(base.totalPostGradPmt)}/mo baseline`;

    // Graduation Balance KPI
    document.getElementById('kpi-grad-bal').innerText = fmt(dyn.totBalRepay);
    document.getElementById('kpi-grad-compare').innerText = `vs ${fmt(base.totBalRepay)} baseline`;
}

function updateChart(baseSim, dynSim) {
    const ctx = document.getElementById('loanChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dynSim.dates,
            datasets: [
                {
                    label: 'Baseline ($0/mo In-School)',
                    data: baseSim.balances,
                    borderColor: '#9CA3AF',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    tension: 0.1
                },
                {
                    label: 'Dynamic Plan',
                    data: dynSim.balances,
                    borderColor: '#4F46E5',
                    borderWidth: 3,
                    fill: true,
                    backgroundColor: 'rgba(79, 70, 229, 0.05)',
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
                x: {
                    title: { display: true, text: 'Timeline (Years)' },
                    grid: { display: false }
                },
                y: {
                    title: { display: true, text: 'Portfolio Balance ($)' },
                    beginAtZero: true,
                    ticks: { callback: function(value) { return '$' + value.toLocaleString(); } }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) { return context.dataset.label + ': $' + Math.round(context.raw).toLocaleString(); }
                    }
                },
                zoom: {
                    pan: { enabled: true, mode: 'x' },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x'
                    }
                }
            }
        }
    });
}