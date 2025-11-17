let finalized = false;

// Gruppen-Daten (Teams als Objekte mit Statistiken)
const groups = {
    A: [], // { name: string, points: number, diff: number }
    B: []
};

// Enter-Handler zum Hinzufügen von Teams
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
    // Optional: Duplikate verhindern (innerhalb beider Gruppen)
    const exists = [...groups.A, ...groups.B].some(t => t.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert('Diese Mannschaft existiert bereits.');
        input.value = '';
        return;
    }

    groups[groupKey].push({ name, points: 0, diff: 0 });
    input.value = '';
    updateTable(groupKey);
}

function updateTable(groupKey) {
    const table = document.getElementById(`group${groupKey}`);

    // Entferne vorhandenes thead (damit Header beim Wechsel von unfinalized -> finalized aktualisiert wird)
    const oldThead = table.querySelector('thead');
    if (oldThead) oldThead.remove();

    // Kopf erstellen abhängig von finalized
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

    // Sortieren: Punkte/Diff nur relevant wenn finalized
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

    // finalized: Platzierung berechnen und alle Spalten anzeigen
    let prevPoints = null;
    let prevDiff = null;
    let prevRank = 0;

    sorted.forEach((team, index) => {
        let rank;
        if (team.points === prevPoints && team.diff === prevDiff) {
            rank = prevRank;
        } else {
            rank = index + 1;
            prevRank = rank;
            prevPoints = team.points;
            prevDiff = team.diff;
        }

        const tr = document.createElement('tr');

        const tdRank = document.createElement('td');
        tdRank.textContent = rank;
        tr.appendChild(tdRank);

        const tdName = document.createElement('td');
        tdName.textContent = team.name;
        tr.appendChild(tdName);

        const tdPoints = document.createElement('td');
        tdPoints.textContent = team.points;
        tr.appendChild(tdPoints);

        const tdDiff = document.createElement('td');
        tdDiff.textContent = team.diff;
        tr.appendChild(tdDiff);

        tbody.appendChild(tr);
    });
}

// Erstellt den Spielplan für eine Gruppe (Jeder gegen Jeden)
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

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const tbody = document.createElement('tbody');

    let players = teams.slice();

    if (players.length % 2 == 1) {
        players.push(null);
    }

    const playerCount = players.length;
    const rounds = playerCount - 1;
    const half = playerCount / 2;

    const playerIndexes = players.map((_, i) => i).slice(1);

    for (let round = 0; round < rounds; round++) {
        const roundPairings = [];

        const newPlayerIndexes = [0].concat(playerIndexes);

        const firstHalf = newPlayerIndexes.slice(0, half);
        const secondHalf = newPlayerIndexes.slice(half, playerCount).reverse();

        for (let k = 0; k < firstHalf.length; k++) {

            let team1 = players[firstHalf[k]];
            let team2 = players[secondHalf[k]];

            if (team1 === null || team2 === null)  continue;

            const tr = document.createElement('tr');

            // Punkte Team A (Input)
            const tdAInp = document.createElement('td');
            const inpA = document.createElement('input');
            inpA.type = 'number';
            inpA.min = '0';
            inpA.style.width = '60px';
            inpA.dataset.team = team1;
            inpA.dataset.teamOpp = team2;
            inpA.dataset.group = groupKey;
            tdAInp.appendChild(inpA);
            tr.appendChild(tdAInp);

            // Team A Name
            const tdAName = document.createElement('td');
            tdAName.textContent = team1;
            tr.appendChild(tdAName);

            // Separator
            const tdSep = document.createElement('td');
            tdSep.textContent = '|';
            tdSep.style.textAlign = 'center';
            tr.appendChild(tdSep);

            // Team B Name
            const tdBName = document.createElement('td');
            tdBName.textContent = team2;
            tr.appendChild(tdBName);

            // Punkte Team B (Input)
            const tdBInp = document.createElement('td');
            const inpB = document.createElement('input');
            inpB.type = 'number';
            inpB.min = '0';
            inpB.style.width = '60px';
            inpB.dataset.team = team2;
            inpB.dataset.teamOpp = team1;
            inpB.dataset.group = groupKey;
            tdBInp.appendChild(inpB);
            tr.appendChild(tdBInp);

            // Live-Update bei Änderungen
            [inpA, inpB].forEach(inp => inp.addEventListener('input', recalcStandings));

            tbody.appendChild(tr);
        }

        // rotating the array
        playerIndexes.push(playerIndexes.shift());
    }

    table.appendChild(tbody);
    container.appendChild(table);
    return container;
}

// Berechnet Punkte und Differenzen aus den aktuellen Spielergebnissen
function recalcStandings() {
    // Reset stats
    ['A', 'B'].forEach(k => {
        groups[k].forEach(t => {
            t.points = 0;
            t.diff = 0;
        });
    });

    // Alle Matches in beiden Schedules durchgehen
    const matchRows = document.querySelectorAll('#scheduleA table tbody tr, #scheduleB table tbody tr');
    matchRows.forEach(row => {
        const inputs = row.querySelectorAll('input[type="number"]');
        if (inputs.length < 2) return;

        const aInp = inputs[0];
        const bInp = inputs[1];

        if (aInp.value === '' || bInp.value === '') return;

        const aScore = Number(aInp.value);
        const bScore = Number(bInp.value);
        const groupKey = aInp.dataset.group; // 'A' oder 'B'
        const teamAname = aInp.dataset.team;
        const teamBname = bInp.dataset.team;

        const teamList = groups[groupKey];
        const teamA = teamList.find(t => t.name === teamAname);
        const teamB = teamList.find(t => t.name === teamBname);
        if (!teamA || !teamB) return;

        if (aScore > bScore) {
            teamA.points += 2;
        } else if (aScore < bScore) {
            teamB.points += 2;
        } else {
            teamA.points += 1;
            teamB.points += 1;
        }

        teamA.diff += (aScore - bScore);
        teamB.diff += (bScore - aScore);
    });

    updateTable('A');
    updateTable('B');
}

document.getElementById('createBtn').addEventListener('click', () => {
    // setze finalized auf true bevor neu rendern
    finalized = true;

    // Entferne alte Spielpläne
    document.getElementById('scheduleA').innerHTML = '';
    document.getElementById('scheduleB').innerHTML = '';

    // Erzeuge neue Spielpläne aus Gruppen-Daten
    const schedA = generateScheduleForGroup('A');
    const schedB = generateScheduleForGroup('B');

    document.getElementById('scheduleA').appendChild(schedA);
    document.getElementById('scheduleB').appendChild(schedB);

    // Eingabefelder und Button ausblenden (Mannschaften sind final)
    document.getElementById('inputA').style.display = 'none';
    document.getElementById('inputB').style.display = 'none';
    document.getElementById('createBtn').style.display = 'none';

    // Tabellen neu rendern und initial auswerten
    updateTable('A');
    updateTable('B');
    recalcStandings();
});

// Falls die Seite beim Laden bereits Teams enthalten sollte, rendern:
document.addEventListener('DOMContentLoaded', () => {
    updateTable('A');
    updateTable('B');
});