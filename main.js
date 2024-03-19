let currentCourseId = null;
let courseDetails = {};
let teeBoxIndex = 0;
let playerNames = ['Player 1'];

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

async function initApp() {
    const courses = await getAvailableGolfCourses();
    populateCourseSelect(courses);

    // Load saved course ID and tee box index from localStorage
    const savedCourseId = localStorage.getItem('selectedCourseId');
    const savedTeeBoxIndex = localStorage.getItem('selectedTeeBoxIndex');
    const savedPlayerNames = JSON.parse(localStorage.getItem('playerNames')) || playerNames;
    currentCourseId = savedCourseId || courses[0].id;
    teeBoxIndex = savedTeeBoxIndex ? parseInt(savedTeeBoxIndex, 10) : 0;
    playerNames = savedPlayerNames;
    document.getElementById("course-select").value = currentCourseId;
    document.getElementById("tee-box-select").value = teeBoxIndex;

    // Update the UI with the selected course and tee box
    await handleCourseSelection({ target: { value: currentCourseId } });
    await handleTeeSelection();

    document.getElementById("course-select").addEventListener("change", handleCourseSelection);
    document.getElementById("tee-box-select").addEventListener("change", handleTeeSelection);

    updatePlayerNamesUI();
}

// Function to update the player names UI based on local storage or defaults
function updatePlayerNamesUI() {
    playerNames.forEach((name, index) => {
        const nameInput = document.getElementById(`player-${index}-name`);
        if (nameInput) {
            nameInput.value = name;
        }
    });
}

function updatePlayerNames() {
    playerNames = Array.from(document.querySelectorAll('.player-name-input')).map(input => input.value);
    localStorage.setItem('playerNames', JSON.stringify(playerNames));
    updateScores(); // Recalculate scores with the updated player names
}

async function getAvailableGolfCourses() {
    return fetch("https://exquisite-pastelito-9d4dd1.netlify.app/golfapi/courses.json")
        .then(response => response.json());
}

async function getGolfCourseDetails(golfCourseId) {
    if (!courseDetails[golfCourseId]) {
        const response = await fetch(`https://exquisite-pastelito-9d4dd1.netlify.app/golfapi/course${golfCourseId}.json`);
        courseDetails[golfCourseId] = await response.json();
    }
    return courseDetails[golfCourseId];
}

function populateCourseSelect(courses) {
    const courseSelect = document.getElementById("course-select");
    courses.forEach(course => {
        const option = document.createElement("option");
        option.value = course.id;
        option.textContent = course.name;
        courseSelect.appendChild(option);
    });
    courseSelect.dispatchEvent(new Event('change')); // Automatically load the initial course
}

async function handleCourseSelection(ev) {
    currentCourseId = ev.target.value;
    const details = await getGolfCourseDetails(currentCourseId);
    populateTeeBoxSelect(details.holes[0].teeBoxes);
}

function populateTeeBoxSelect(teeBoxes) {
    const teeBoxSelect = document.getElementById("tee-box-select");
    teeBoxSelect.innerHTML = "";
    teeBoxes.forEach((teeBox, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = `${teeBox.teeType.toUpperCase()}, ${teeBox.totalYards} yards`;
        teeBoxSelect.appendChild(option);
    });
    teeBoxSelect.dispatchEvent(new Event('change')); // Automatically load the initial tee box
}

async function handleTeeSelection() {
    await populateScorecard();
}

document.getElementById('add-player-btn').addEventListener('click', addPlayer);

function addPlayer() {
    if (playerNames.length < 4) {
        const playerIndex = playerNames.length;
        playerNames.push(`Player ${playerIndex + 1}`);
        localStorage.setItem('playerNames', JSON.stringify(playerNames));
        populateScorecard(); // Re-populate the scorecard to show the new player
    } else {
        toastr.warning('Maximum of 4 players reached.');
    }
}

async function populateScorecard() {
    const details = await getGolfCourseDetails(currentCourseId);
    const scorecardTable = document.querySelector("#scorecard-container table");
    const thead = scorecardTable.querySelector("thead tr");
    const tbody = scorecardTable.querySelector("tbody");
    const tfoot = scorecardTable.querySelector("tfoot");
    const playerColumnWidth = 100 / (playerNames.length + 4);

    

    tbody.innerHTML = "";
    tfoot.innerHTML = "";
    while (thead.children.length > 4) {
        thead.removeChild(thead.lastChild);
    }

    // Dynamically create headers for player names
    playerNames.forEach((name, index) => {
        const th = document.createElement('th');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = name;
        nameInput.id = `player-${index}-name`;
        nameInput.classList.add('player-name-input');
        nameInput.addEventListener('change', () => updatePlayerNames());
        th.appendChild(nameInput);
        thead.appendChild(th);
    });
    // Populate hole details
    details.holes.forEach((hole, index) => {
        const row = tbody.insertRow();
        const teeBox = hole.teeBoxes[teeBoxIndex];
        row.insertCell().textContent = index + 1;
        row.insertCell().textContent = teeBox.yards;
        row.insertCell().textContent = teeBox.hcp;
        row.insertCell().textContent = teeBox.par;

        playerNames.forEach(() => {
            const cell = row.insertCell();
            const input = document.createElement('input');
            input.type = 'number';
            input.classList.add('player-score');
            input.dataset.holeIndex = index;
            cell.appendChild(input);
        });
    });

    // Setup footer scores
    ["in", "out", "total"].forEach((scoreType, index) => {
        const footerRow = tfoot.insertRow();
        for (let i = 0; i < 4; i++) {
            footerRow.insertCell();
        }
        playerNames.forEach((_, playerIndex) => {
            const cell = footerRow.insertCell();
            cell.innerHTML = `${scoreType.charAt(0).toUpperCase() + scoreType.slice(1)}: <span id="player-${playerIndex}-${scoreType}"></span>`;
        });
    });

    document.querySelectorAll('.player-score').forEach(input => {
        input.addEventListener('input', updateScores);
    });
}

function updatePlayerNames() {
    playerNames = Array.from(document.querySelectorAll('.player-name-input'))
        .map(input => input.value);
         localStorage.setItem('playerNames', JSON.stringify(playerNames));
         updateScores();
}

function updateScores() {
    const scoreInputs = document.querySelectorAll('.player-score');
    const scores = playerNames.map(() => ({ in: 0, out: 0, total: 0, playedHoles: 0 }));

    scoreInputs.forEach(input => {
        const holeIndex = input.dataset.holeIndex;
        const playerIndex = input.closest('td').cellIndex - 4;
        if (input.value) {
            const score = parseInt(input.value, 10);
            if (holeIndex < 9) {
                scores[playerIndex].in += score;
            } else {
                scores[playerIndex].out += score;
            }
            scores[playerIndex].playedHoles++;
        }
    });

    scores.forEach((score, index) => {
        // Only update the total if at least one hole has been played
        if (score.playedHoles > 0) {
            scores[index].total = score.out + score.in;
        } else {
            scores[index].total = 'N/A'; // Set to 'N/A' if no holes have been played
        }
        document.getElementById(`player-${index}-out`).textContent = score.out;
        document.getElementById(`player-${index}-in`).textContent = score.in;
        document.getElementById(`player-${index}-total`).textContent = score.total;
    });
}

function evaluateWinnerAndReset() {
    let lowestScore = Infinity;
    let winners = [];
    const scores = [];

    // finds the lowest score and the players with that score
    playerNames.forEach((player, index) => {
        const totalScoreElement = document.getElementById(`player-${index}-total`);
        const totalScore = parseInt(totalScoreElement.textContent, 10);

        // Only consider players who have a scored total
        if (!isNaN(totalScore)) {
            scores.push({ player, score: totalScore });

            if (totalScore < lowestScore) {
                lowestScore = totalScore;
            }
        }
    });

    // Determine all players who share the lowest score
    scores.forEach(({ player, score }) => {
        if (score === lowestScore) {
            winners.push(player);
        }
    });

    // toast
    let message;
    if (winners.length === 1) {
        message = `${winners[0]} has won with a score of ${lowestScore}! Congratulations!`;
    } else if (winners.length === playerNames.length) {
        // Special message if all players are tied
        message = "It's a tie between all players!";
    } else {
        // Handling multiple winners for a tie with 2-3 players
        const allWinners = winners.join(', ');
        message = `It's a tie between ${allWinners}, all scoring ${lowestScore}.`;
    }

    toastr.info(message);
}

function resetGame() {
        toastr.success('The game has been reset.'); 
        setTimeout(() => {
            localStorage.clear();
            sessionStorage.clear();
            location.reload();
        }, 1000);
         
}

document.getElementById('evaluate-winner-btn').addEventListener('click', evaluateWinnerAndReset);
document.getElementById('reset-game').addEventListener('click', resetGame);
