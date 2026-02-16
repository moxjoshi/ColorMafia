const rows = 5;
const cols = 5;
let board = [];
let currentPlayer = 'red'; // 'red' or 'blue'
let isAnimating = false;
let gameMode = 'pvp'; // 'pvp' or 'pve'
let players = {
    'red': { color: '#FD5F5B', name: "RED", bgClass: 'turn-red', cellBg: '#FFCBC7' },
    'blue': { color: '#08C3F0', name: "BLUE", bgClass: 'turn-blue', cellBg: '#A9E3EF' }
};

const boardElement = document.getElementById('board');
// turnIndicator element is removed/hidden, logic updated to change body bg
const restartBtn = document.getElementById('restartBtn');
const homeBtn = document.getElementById('homeBtn');
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const rulesBtn = document.getElementById('rulesBtn');
const rulesModal = document.getElementById('rulesModal');
const closeRulesBtn = document.getElementById('closeRulesBtn');

// Start Game from Menu
window.startGame = function (mode) {
    gameMode = mode;
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initGame();
}

function showStartScreen() {
    gameScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    // Reset background to default black (or keep transition)
    document.body.className = '';
}

// Initialize Game
function initGame() {
    isAnimating = false;
    board = [];
    boardElement.innerHTML = '';

    // In PvE, Player is always Red, Bot is Blue. Red starts?
    // User didn't specify, but usually player goes first or random.
    currentPlayer = Math.random() < 0.5 ? 'red' : 'blue';

    updateTurnIndicator();

    for (let r = 0; r < rows; r++) {
        let row = [];
        for (let c = 0; c < cols; c++) {
            let cell = {
                r: r,
                c: c,
                dots: 0,
                owner: null,
                capacity: 4
            };
            row.push(cell);

            let cellDiv = document.createElement('div');
            cellDiv.classList.add('cell');
            cellDiv.dataset.r = r;
            cellDiv.dataset.c = c;
            cellDiv.addEventListener('click', () => handleCellClick(r, c));
            boardElement.appendChild(cellDiv);
        }
        board.push(row);
    }

    // If Bot starts (Bot is Blue now), trigger bot move
    if (gameMode === 'pve' && currentPlayer === 'blue') {
        setTimeout(makeBotMove, 1000);
    }
}

function updateTurnIndicator() {
    // Change Background Color
    document.body.className = players[currentPlayer].bgClass;
}

function renderBoard() {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let cell = board[r][c];
            let cellDiv = document.querySelector(`.cell[data-r='${r}'][data-c='${c}']`);
            cellDiv.innerHTML = ''; // Clear current content

            if (cell.dots > 0) {
                // Set background color of the cell
                cellDiv.style.backgroundColor = players[cell.owner].cellBg;

                // Create Player Circle
                let circle = document.createElement('div');
                circle.className = 'player-circle';
                circle.style.backgroundColor = players[cell.owner].color;

                // Add dots to the circle
                let displayDots = cell.dots > 4 ? 4 : cell.dots;

                for (let i = 1; i <= displayDots; i++) {
                    let dot = document.createElement('div');
                    if (displayDots === 1) dot.className = 'orb count-1';
                    else if (displayDots === 2) dot.className = `orb count-2-${i}`;
                    else if (displayDots === 3) dot.className = `orb count-3-${i}`;
                    else dot.className = `orb count-4-${i}`;

                    // Dot color is handled by CSS (white)
                    circle.appendChild(dot);
                }

                cellDiv.appendChild(circle);

                // Remove border from cell, as the circle indicates ownership now?
                // User said "Inside every box...", "Live with pre-made circle".
                // We'll keep the cell clean (no border) or minimal.
                cellDiv.style.border = 'none';
            } else {
                // Reset to default empty cell
                cellDiv.style.backgroundColor = ''; // Reverts to CSS default (var(--cell-bg))
                cellDiv.style.border = '2px solid #ccc'; // Softer border for empty cells
            }
        }
    }
}

// Check if current player has any orbs on the board
function hasOrbs(player) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c].owner === player) return true;
        }
    }
    return false;
}

// Handle Click
async function handleCellClick(r, c) {
    if (isAnimating) return;

    // If it's Bot's turn (Blue) and User clicks -> IGNORE
    if (gameMode === 'pve' && currentPlayer === 'blue') return;

    await processMove(r, c);
}

// Separate Logic Process for Reuse by Bot
async function processMove(r, c) {
    let cell = board[r][c];
    let playerHasOrbs = hasOrbs(currentPlayer);

    if (!playerHasOrbs) {
        if (cell.owner !== null) return;
    } else {
        if (cell.owner !== currentPlayer) return;
    }

    isAnimating = true;
    addOrb(r, c, currentPlayer);

    let unstable = true;
    while (unstable) {
        // Check win state before processing further explosions
        if (checkWinConditionMet(true)) {
            isAnimating = false;
            return;
        }

        let explosions = [];
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (board[i][j].dots >= board[i][j].capacity) {
                    explosions.push({ r: i, c: j });
                }
            }
        }

        if (explosions.length > 0) {
            unstable = true;
            await performExplosions(explosions);
        } else {
            unstable = false;
        }
    }

    // Final Win Check
    if (checkWinConditionMet(true)) {
        isAnimating = false;
        return;
    }

    // Switch Turn
    currentPlayer = currentPlayer === 'red' ? 'blue' : 'red';
    updateTurnIndicator();
    isAnimating = false;

    // Trigger Bot if it's Blue's turn now
    if (gameMode === 'pve' && currentPlayer === 'blue') {
        setTimeout(makeBotMove, 1000);
    }
}


function makeBotMove() {
    if (gameMode !== 'pve' || currentPlayer !== 'blue') return;
    if (checkWinConditionMet(false)) return;

    let validMoves = [];
    let hasOwnOrbs = hasOrbs('blue');

    // 1. Identify all valid moves
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!hasOwnOrbs) {
                if (board[r][c].owner === null) {
                    validMoves.push({ r: r, c: c });
                }
            } else {
                if (board[r][c].owner === 'blue') {
                    validMoves.push({ r: r, c: c });
                }
            }
        }
    }

    if (validMoves.length === 0) {
        console.log("Bot has no moves!");
        return;
    }

    // 2. Score each move
    let bestMove = null;
    let bestScore = -Infinity;

    for (let move of validMoves) {
        let score = evaluateMove(move.r, move.c);
        // Add a tiny bit of randomness to break ties and make it feel less robotic
        score += Math.random() * 5;

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    // 3. Execute best move
    if (bestMove) {
        processMove(bestMove.r, bestMove.c);
    }
}

function evaluateMove(r, c) {
    let cell = board[r][c];
    let score = 0;

    // Feature 1: Will this move cause an explosion?
    // Capacity is fixed at 4 for all cells now.
    let willExplode = (cell.dots + 1) >= 4;

    if (willExplode) {
        score += 100;
        let enemyNeighbors = countEnemyNeighbors(r, c, 'red');
        score += (enemyNeighbors * 20);
    } else {
        if (cell.dots + 1 === 3) {
            score += 10;
        }
    }

    if (isNextToCriticalEnemy(r, c, 'red')) {
        score -= 50;
    }

    if (isCorner(r, c)) score += 5;
    else if (isEdge(r, c)) score += 2;

    return score;
}

function countEnemyNeighbors(r, c, enemyColor) {
    let count = 0;
    let neighbors = [
        { r: r - 1, c: c }, { r: r + 1, c: c },
        { r: r, c: c - 1 }, { r: r, c: c + 1 }
    ];
    for (let n of neighbors) {
        if (n.r >= 0 && n.r < rows && n.c >= 0 && n.c < cols) {
            if (board[n.r][n.c].owner === enemyColor) {
                count++;
            }
        }
    }
    return count;
}

function isNextToCriticalEnemy(r, c, enemyColor) {
    let neighbors = [
        { r: r - 1, c: c }, { r: r + 1, c: c },
        { r: r, c: c - 1 }, { r: r, c: c + 1 }
    ];
    for (let n of neighbors) {
        if (n.r >= 0 && n.r < rows && n.c >= 0 && n.c < cols) {
            let neighbor = board[n.r][n.c];
            if (neighbor.owner === enemyColor && neighbor.dots >= 3) {
                return true;
            }
        }
    }
    return false;
}

function isCorner(r, c) {
    return (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1);
}

function isEdge(r, c) {
    return (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) && !isCorner(r, c);
}


function addOrb(r, c, color) {
    board[r][c].dots++;
    board[r][c].owner = color;
    renderBoard();
}

async function performExplosions(explosions) {
    await new Promise(resolve => setTimeout(resolve, 500));

    for (let ex of explosions) {
        let r = ex.r;
        let c = ex.c;
        let cell = board[r][c];
        let color = cell.owner;

        cell.dots -= 4;
        if (cell.dots === 0) {
            cell.owner = null;
        } else {
            cell.owner = color;
        }

        let neighbors = [
            { r: r - 1, c: c },
            { r: r + 1, c: c },
            { r: r, c: c - 1 },
            { r: r, c: c + 1 }
        ];

        for (let n of neighbors) {
            if (n.r >= 0 && n.r < rows && n.c >= 0 && n.c < cols) {
                board[n.r][n.c].dots++;
                board[n.r][n.c].owner = color;
            }
        }
    }
    renderBoard();
}

const winnerModal = document.getElementById('winnerModal');
const winnerText = document.getElementById('winnerText');

function checkWinConditionMet(showWinnerAlert = true) {
    let redCount = 0;
    let blueCount = 0;
    let totalOrbs = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c].owner === 'red') redCount++;
            if (board[r][c].owner === 'blue') blueCount++;
            totalOrbs += board[r][c].dots;
        }
    }

    if (totalOrbs >= 2) {
        if (redCount === 0) {
            if (showWinnerAlert) {
                showWinModal('blue');
            }
            return true;
        }
        if (blueCount === 0) {
            if (showWinnerAlert) {
                showWinModal('red');
            }
            return true;
        }
    }
    return false;
}

function showWinModal(winner) {
    winnerText.textContent = `${players[winner].name} WINS!`;
    winnerText.style.color = players[winner].color; // Set text color to winner's color
    winnerModal.classList.remove('hidden');

    setTimeout(() => {
        winnerModal.classList.add('hidden');
        showStartScreen();
    }, 2000);
}

restartBtn.addEventListener('click', initGame);
homeBtn.addEventListener('click', showStartScreen);

// Rules Modal Event Listeners
rulesBtn.addEventListener('click', () => {
    rulesModal.classList.remove('hidden');
});

closeRulesBtn.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
});

rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) {
        rulesModal.classList.add('hidden');
    }
});

let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);