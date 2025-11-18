// Vollständiges script.js mit localStorage (Teams + Ergebnisse), Platzierung und ausgeglichener Spielreihenfolge

const STORAGE_KEY = 'volleyball_state_v1';

let finalized = false;

// Gruppen-Daten (Teams als Objekte mit Statistiken)
const groups = {
    A: [], // { name: string, points: number, diff: number }
    B: []
};

// Alle Ergebnisse: key = "TeamLeft|TeamRight" (so wie in der Tabelle), value = { group: 'A'|'B', team1, team2, score1, score2 }
let allResults = {};

// --- Helpers ---
function saveState() {
    try {
        const state = {
            finalized,
            groups: {
                A: groups.A.map(t => t.name),
                B: groups.B.map(t => t.name)
            },
            allResults
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
        console.warn('saveState failed', err);
    }
}

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
        const state = JSON.parse(raw);
        finalized = !!state.finalized;
        groups.A = (state.groups?.A || []).map(n => ({ name: n, points: 0, diff: 0 }));
        groups.B = (state.groups?.B || []).map(n => ({ name: n, points: 0, diff: 0 }));
        allResults = state.allResults || {};
        updateTable('A');
        updateTable('B');

        if (finalized) {
            // Erzeuge Spielpläne und fülle gespeicherte Werte ein
            document.getElementById('scheduleA').innerHTML = '';
            document.getElementById('scheduleB').innerHTML = '';
            document.getElementById('scheduleA').appendChild(generateScheduleForGroup('A'));
            document.getElementById('scheduleB').appendChild(generateScheduleForGroup('B'));

            // Fülle Inputs aus allResults (prüft beide Orientierungen)
            ['A','B'].forEach(gk => {
                const container = document.getElementById(gk === 'A' ? 'scheduleA' : 'scheduleB');
                if (!container) return;
                container.querySelectorAll('table tbody tr').forEach(row => {
                    const inputs = row.querySelectorAll('input[type="number"]');
                    if (inputs.length < 2) return;
                    const a = inputs[0], b = inputs[1];
                    const keyLR = `${a.dataset.team}|${b.dataset.team}`;
                    const keyRL = `${b.dataset.team}|${a.dataset.team}`;
                    const r = allResults[keyLR] || allResults[keyRL];
                    if (!r) return;
                    if (r.team1 === a.dataset.team && r.team2 === b.dataset.team) {
                        if (r.score1 != null) a.value = r.score1;
                        if (r.score2 != null) b.value = r.score2;
                    } else {
                        // inverted stored
                        if (r.score1 != null) b.value = r.score1;
                        if (r.score2 != null) a.value = r.score2;
                    }
                });
            });

            recalcStandings();

            // Eingabefelder und Button ausblenden
            document.getElementById('inputA').style.display = 'none';
            document.getElementById('inputB').style.display = 'none';
            document.getElementById('createBtn').style.display = 'none';
        }
    } catch (err) {
        console.warn('loadState failed', err);
    }
}

// --- UI / Gruppen ---
document.getElementById('inputA').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addToGroup('A');
    }
});
document.getElementById('inputB').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addToGroup('B');
    }
});

function addToGroup(groupKey) {
    const input = document.getElementById(`input${groupKey}`);
    const name = input.value.trim();
    if (!name) {
        alert('Bitte einen Mannschaftsnamen eingeben!');
        return;
    }
    const exists = [...groups.A, ...groups.B].some(t => t.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert('Diese Mannschaft existiert bereits.');
        input.value = '';
        return;
    }

    groups[groupKey].push({ name, points: 0, diff: 0 });
    input.value = '';
    updateTable('A');
    updateTable('B');
    saveState();
}

function updateTable(groupKey) {
    const table = document.getElementById(`group${groupKey}`);

    // Kopf immer neu erstellen (so aktualisiert sich Header wenn finalized wechselt)
    const oldThead = table.querySelector('thead');
    if (oldThead) oldThead.remove();

    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    if (finalized) {
        ['Platz', 'Name', 'Punkte', 'Punkt-Diff'].forEach(txt => {
            const th = document.createElement('th');
            th.textContent = txt;
            trHead.appendChild(th);
        });
    } else {
        const th = document.createElement('th');
        th.textContent = 'Name';
        trHead.appendChild(th);
    }
    thead.appendChild(trHead);
    table.insertBefore(thead, table.firstChild);

    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    const sorted = groups[groupKey].slice().sort((a, b) => {
        if (finalized) {
            if (b.points !== a.points) return b.points - a.points;
            if (b.diff !== a.diff) return b.diff - a.diff;
        }
        return a.name.localeCompare(b.name, 'de');
    });

    if (!finalized) {
        sorted.forEach(team => {
            const tr = document.createElement('tr');
            const tdName = document.createElement('td');
            tdName.textContent = team.name;
            tr.appendChild(tdName);
            tbody.appendChild(tr);
        });
        return;
    }

    // Platzberechnung (bei Gleichstand gleicher Platz)
    let prevPoints = null;
    let prevDiff = null;
    let prevRank = 0;
    sorted.forEach((team, idx) => {
        let rank;
        if (team.points === prevPoints && team.diff === prevDiff) {
            rank = prevRank;
        } else {
            rank = idx + 1;
            prevRank = rank;
            prevPoints = team.points;
            prevDiff = team.diff;
        }

        const tr = document.createElement('tr');
        const tdRank = document.createElement('td'); tdRank.textContent = rank; tr.appendChild(tdRank);
        const tdName = document.createElement('td'); tdName.textContent = team.name; tr.appendChild(tdName);
        const tdPoints = document.createElement('td'); tdPoints.textContent = team.points; tr.appendChild(tdPoints);
        const tdDiff = document.createElement('td'); tdDiff.textContent = team.diff; tr.appendChild(tdDiff);
        tbody.appendChild(tr);
    });
}

// --- Spielplan generierung (greedy scheduler für ausgeglichene Reihenfolge) ---
function generateScheduleForGroup(groupKey) {
    const teams = groups[groupKey].map(t => t.name);
    const container = document.createElement('div');
    container.className = 'generated-schedule';
    const h3 = document.createElement('h3');
    h3.textContent = `Spielplan Gruppe ${groupKey}`;
    container.appendChild(h3);

    if (teams.length < 2) {
        const p = document.createElement('p');
        p.textContent = 'Nicht genug Mannschaften (mind. 2).';
        container.appendChild(p);
        return container;
    }

    // Alle Paarungen
    const matches = [];
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            matches.push({ a: teams[i], b: teams[j] });
        }
    }

    // Greedy scheduling zur Ausbalancierung
    const playCount = {};
    teams.forEach(t => playCount[t] = 0);
    const scheduled = [];
    while (matches.length > 0) {
        let bestIdx = 0;
        let bestVal = Infinity;
        let bestSum = Infinity;
        for (let k = 0; k < matches.length; k++) {
            const m = matches[k];
            const val = Math.max(playCount[m.a], playCount[m.b]);
            const sum = playCount[m.a] + playCount[m.b];
            if (val < bestVal || (val === bestVal && sum < bestSum)) {
                bestIdx = k; bestVal = val; bestSum = sum;
            }
        }
        const next = matches.splice(bestIdx, 1)[0];
        scheduled.push(next);
        playCount[next.a] += 1;
        playCount[next.b] += 1;
    }

    // Erzeuge Tabelle ohne Rundennummern
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    const tbody = document.createElement('tbody');

    scheduled.forEach(match => {
        const tr = document.createElement('tr');

        // Punkte Team A (Input)
        const tdAInp = document.createElement('td');
        const inpA = document.createElement('input');
        inpA.type = 'number'; inpA.min = '0'; inpA.style.width = '60px';
        inpA.dataset.team = match.a; inpA.dataset.teamOpp = match.b; inpA.dataset.group = groupKey;
        tdAInp.appendChild(inpA); tr.appendChild(tdAInp);

        // Team A Name
        const tdAName = document.createElement('td'); tdAName.textContent = match.a; tr.appendChild(tdAName);

        // Separator
        const tdSep = document.createElement('td'); tdSep.textContent = '|'; tdSep.style.textAlign = 'center'; tr.appendChild(tdSep);

        // Team B Name
        const tdBName = document.createElement('td'); tdBName.textContent = match.b; tr.appendChild(tdBName);

        // Punkte Team B (Input)
        const tdBInp = document.createElement('td');
        const inpB = document.createElement('input');
        inpB.type = 'number'; inpB.min = '0'; inpB.style.width = '60px';
        inpB.dataset.team = match.b; inpB.dataset.teamOpp = match.a; inpB.dataset.group = groupKey;
        tdBInp.appendChild(inpB); tr.appendChild(tdBInp);

        // Input handler (speichern + neu berechnen)
        [inpA, inpB].forEach(inp => inp.addEventListener('input', onResultInput));

        // Falls beim Laden schon Werte existieren, fülle sie (loadState füllt später nochmal sicherheitshalber)
        const keyLR = `${match.a}|${match.b}`;
        const keyRL = `${match.b}|${match.a}`;
        const stored = allResults[keyLR] || allResults[keyRL];
        if (stored) {
            if (stored.team1 === match.a && stored.team2 === match.b) {
                if (stored.score1 != null) inpA.value = stored.score1;
                if (stored.score2 != null) inpB.value = stored.score2;
            } else {
                if (stored.score1 != null) inpB.value = stored.score1;
                if (stored.score2 != null) inpA.value = stored.score2;
            }
        }

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
    return container;
}

// --- Ergebnis-Handling ---
function onResultInput(e) {
    const input = e.target;
    const row = input.closest('tr');
    if (!row) return;
    const [aInp, bInp] = row.querySelectorAll('input[type="number"]');
    if (!aInp || !bInp) return;

    const team1 = aInp.dataset.team;
    const team2 = bInp.dataset.team;
    const group = aInp.dataset.group;

    const key = `${team1}|${team2}`;
    const score1 = aInp.value === '' ? null : Number(aInp.value);
    const score2 = bInp.value === '' ? null : Number(bInp.value);

    allResults[key] = {
        group,
        team1,
        team2,
        score1,
        score2
    };

    saveState();
    recalcStandings();
}

function recalcStandings() {
    // Reset
    ['A','B'].forEach(k => groups[k].forEach(t => { t.points = 0; t.diff = 0; }));

    // Durch alle gespeicherten Ergebnisse
    Object.values(allResults).forEach(r => {
        if (!r) return;
        const { group, team1, team2, score1, score2 } = r;
        if (score1 == null || score2 == null) return;
        const teamList = groups[group];
        if (!teamList) return;
        const t1 = teamList.find(x => x.name === team1);
        const t2 = teamList.find(x => x.name === team2);
        if (!t1 || !t2) return;

        if (score1 > score2) t1.points += 2;
        else if (score1 < score2) t2.points += 2;
        else { t1.points += 1; t2.points += 1; }

        t1.diff += (score1 - score2);
        t2.diff += (score2 - score1);
    });

    updateTable('A');
    updateTable('B');
}

// --- Spiel starten / UI ---
document.getElementById('createBtn').addEventListener('click', () => {
    finalized = true;

    document.getElementById('scheduleA').innerHTML = '';
    document.getElementById('scheduleB').innerHTML = '';

    document.getElementById('scheduleA').appendChild(generateScheduleForGroup('A'));
    document.getElementById('scheduleB').appendChild(generateScheduleForGroup('B'));

    // hide inputs and button
    document.getElementById('inputA').style.display = 'none';
    document.getElementById('inputB').style.display = 'none';
    document.getElementById('createBtn').style.display = 'none';

    recalcStandings();
    saveState();
});

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    if (!localStorage.getItem(STORAGE_KEY)) {
        updateTable('A');
        updateTable('B');
    }
});