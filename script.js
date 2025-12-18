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

// Zeit-Tracking
let startTime = '09:00';
let gameDuration = 15; // Minuten
let pauseDuration = 5; // Minuten
let matchTimes = { A: {}, B: {} }; // key: "Team1|Team2" -> { startMin, endMin, displayTime }

// Zeit-Handler (speichern + neu berechnen wenn geändert)
['startTime', 'gameDuration', 'pauseDuration'].forEach(id => {
    const elem = document.getElementById(id);
    if (!elem) return;
    elem.addEventListener('change', () => {
        startTime = document.getElementById('startTime').value;
        gameDuration = Number(document.getElementById('gameDuration').value);
        pauseDuration = Number(document.getElementById('pauseDuration').value);

        // Wenn Spielpläne schon erstellt wurden, neu generieren
        if (finalized) {
            document.getElementById('scheduleA').innerHTML = '';
            document.getElementById('scheduleB').innerHTML = '';
            document.getElementById('scheduleA').appendChild(generateScheduleForGroup('A'));
            document.getElementById('scheduleB').appendChild(generateScheduleForGroup('B'));

            // Gespeicherte Werte wieder einfüllen
            ['A', 'B'].forEach(gk => {
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
                        if (r.score1 != null) b.value = r.score1;
                        if (r.score2 != null) a.value = r.score2;
                    }
                });
            });
        }

        saveState();
    });
});

// Berechne Start-/End-Zeit für jedes Spiel
function calcMatchTimes() {
    matchTimes = { A: {}, B: {} };

    const [startHour, startMin] = startTime.split(':').map(Number);
    let currentMin = startHour * 60 + startMin; // absolute Minuten seit Mitternacht

    // Für jede Gruppe durchgehen (nach Reihenfolge der Spielpläne)
    ['A', 'B'].forEach(gk => {
        const container = document.getElementById(gk === 'A' ? 'scheduleA' : 'scheduleB');
        if (!container) return;
        const rows = container.querySelectorAll('table tbody tr');
        rows.forEach(row => {
            const inputs = row.querySelectorAll('input[type="number"]');
            if (inputs.length < 2) return;
            const team1 = inputs[0].dataset.team;
            const team2 = inputs[1].dataset.team;
            const key = `${team1}|${team2}`;

            const startMinAbs = currentMin;
            const endMinAbs = currentMin + gameDuration;

            matchTimes[gk][key] = {
                startMin: startMinAbs,
                endMin: endMinAbs,
                displayTime: formatTime(startMinAbs) + ' - ' + formatTime(endMinAbs)
            };

            currentMin = endMinAbs + pauseDuration;
        });
    });
}

// Formatiere absolute Minuten zu HH:MM
function formatTime(absMin) {
    const h = Math.floor(absMin / 60);
    const m = absMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function encodeState(state) {
    try {
        const json = JSON.stringify(state);
        // Base64 encode für URL-Sicherheit
        return btoa(unescape(encodeURIComponent(json)));
    } catch (e) {
        console.warn('encodeState failed', e);
        return null;
    }
}


function decodeState(encoded) {
    try {
        const json = decodeURIComponent(escape(atob(encoded)));
        return JSON.parse(json);
    } catch (e) {
        console.warn('decodeState failed', e);
        return null;
    }
}

function getStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('state');
    if (!encoded) return null;
    return decodeState(encoded);
}

function updateURL() {
    const state = {
        finalized,
        groups: {
            A: groups.A.map(t => t.name),
            B: groups.B.map(t => t.name)
        },
        allResults,
        timeSettings: {
            startTime,
            gameDuration,
            pauseDuration
        }
    };
    const encoded = encodeState(state);
    if (!encoded) return;

    const url = new URL(window.location.href);
    url.searchParams.set('state', encoded);
    // URL ohne Reload aktualisieren
    window.history.replaceState({}, '', url.toString());
}


function copyShareLink() {
    // State direkt kodieren und URL bauen (nicht auf window.location.href verlassen)
    const state = {
        finalized,
        groups: {
            A: groups.A.map(t => t.name),
            B: groups.B.map(t => t.name)
        },
        allResults,
        timeSettings: {
            startTime,
            gameDuration,
            pauseDuration
        }
    };
    const encoded = encodeState(state);
    if (!encoded) {
        alert('Fehler beim Erstellen des Links');
        return;
    }
    
    // URL manuell bauen (Base-URL + State-Parameter)
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?state=${encoded}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Link kopiert! Du kannst ihn jetzt teilen.');
    }).catch(err => {
        // Fallback: zeige URL in prompt
        prompt('Kopiere diesen Link:', shareUrl);
    });
    
    // URL auch im Browser aktualisieren
    window.history.replaceState({}, '', shareUrl);
}


// --- Helpers ---
function saveState() {
    try {
        const state = {
            finalized,
            groups: {
                A: groups.A.map(t => t.name),
                B: groups.B.map(t => t.name)
            },
            allResults,
            timeSettings: {
                startTime,
                gameDuration,
                pauseDuration
            }
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        updateURL();
    } catch (err) {
        console.warn('saveState failed', err);
    }
}

function loadState() {
    const urlState = getStateFromURL();
    const raw = urlState ? JSON.stringify(urlState) : localStorage.getItem(STORAGE_KEY);

    if (!raw) return;
    try {
        const state = JSON.parse(raw);
        finalized = !!state.finalized;
        groups.A = (state.groups?.A || []).map(n => ({ name: n, points: 0, diff: 0 }));
        groups.B = (state.groups?.B || []).map(n => ({ name: n, points: 0, diff: 0 }));
        allResults = state.allResults || {};
        updateTable('A');
        updateTable('B');

        // Zeit-Einstellungen laden
        if (state.timeSettings) {
            startTime = state.timeSettings.startTime || '09:00';
            gameDuration = state.timeSettings.gameDuration || 15;
            pauseDuration = state.timeSettings.pauseDuration || 5;

            // Eingabefelder aktualisieren
            document.getElementById('startTime').value = startTime;
            document.getElementById('gameDuration').value = gameDuration;
            document.getElementById('pauseDuration').value = pauseDuration;
        }

        updateTable('A');
        updateTable('B');

        if (finalized) {
            // Erzeuge Spielpläne und fülle gespeicherte Werte ein
            document.getElementById('scheduleA').innerHTML = '';
            document.getElementById('scheduleB').innerHTML = '';
            document.getElementById('scheduleA').appendChild(generateScheduleForGroup('A'));
            document.getElementById('scheduleB').appendChild(generateScheduleForGroup('B'));

            // Fülle Inputs aus allResults (prüft beide Orientierungen)
            ['A', 'B'].forEach(gk => {
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
            calcMatchTimes();

            // Eingabefelder und Button ausblenden
            document.getElementById('inputA').style.display = 'none';
            document.getElementById('inputB').style.display = 'none';
            document.getElementById('createBtn').style.display = 'none';
        }

        if (urlState) {
            localStorage.setItem(STORAGE_KEY, raw);
        }
    } catch (err) {
        console.warn('loadState failed', err);
    }
}

// --- Teilen / Link kopieren ---
document.getElementById('shareBtn').addEventListener('click', copyShareLink);

// Reset: löscht gespeicherten Zustand und setzt UI/Variablen zurück
document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Alle Daten löschen und neu starten?')) return;

    // entferne gespeicherten State
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }

    // reset interne Daten
    finalized = false;
    groups.A = [];
    groups.B = [];
    allResults = {};
    // zeige Eingaben/Buttons wieder
    const inputA = document.getElementById('inputA');
    const inputB = document.getElementById('inputB');
    const createBtn = document.getElementById('createBtn');
    if (inputA) inputA.style.display = '';
    if (inputB) inputB.style.display = '';
    if (createBtn) createBtn.style.display = '';

    // leere Tabellen und Spielpläne
    const clearTable = id => {
        const table = document.getElementById(id);
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (tbody) tbody.innerHTML = '';
        const thead = table.querySelector('thead');
        if (thead) thead.remove();
    };
    clearTable('groupA');
    clearTable('groupB');
    const scheduleA = document.getElementById('scheduleA');
    const scheduleB = document.getElementById('scheduleB');
    if (scheduleA) scheduleA.innerHTML = '';
    if (scheduleB) scheduleB.innerHTML = '';

    // neu rendern
    updateTable('A');
    updateTable('B');
});

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

    // Berechne Zeiten (falls noch nicht vorhanden)
    if (!matchTimes[groupKey]) matchTimes[groupKey] = {};
    const [startHour, startMin] = startTime.split(':').map(Number);
    let currentMin = startHour * 60 + startMin;

    scheduled.forEach(match => {
        const key = `${match.a}|${match.b}`;
        const startMinAbs = currentMin;
        const endMinAbs = currentMin + gameDuration;
        matchTimes[groupKey][key] = {
            startMin: startMinAbs,
            endMin: endMinAbs,
            displayTime: formatTime(startMinAbs) + ' - ' + formatTime(endMinAbs)
        };
        currentMin = endMinAbs + pauseDuration;
    });

    // Erzeuge Tabelle ohne Rundennummern
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    const tbody = document.createElement('tbody');

    scheduled.forEach(match => {
        const key = `${match.a}|${match.b}`;
        const timeInfo = matchTimes[groupKey][key];
        const tr = document.createElement('tr');

        // Zeit-Spalte
        const tdTime = document.createElement('td');
        tdTime.textContent = timeInfo ? timeInfo.displayTime : '–';
        tdTime.style.padding = '4px 8px';
        tdTime.style.whiteSpace = 'nowrap';
        tr.appendChild(tdTime);


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
    ['A', 'B'].forEach(k => groups[k].forEach(t => { t.points = 0; t.diff = 0; }));

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

    calcMatchTimes();

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