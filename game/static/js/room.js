const roomName = JSON.parse(document.getElementById('room-name').textContent);
const gameSocket = new WebSocket('ws://' + window.location.host + '/ws/game/' + roomName + '/');
var cur_player = null;
var player_turn = null;
var player_list = null;
var is_turn = null;
var guess_row = null;
var guess_col = null;
var guess_color = null;

/* SOCKET */

gameSocket.onopen = function (e) {
    console.log("Connection established");
};

gameSocket.onmessage = function (e) {
    const data = JSON.parse(e.data);
    const messageType = data['type'];

    if (messageType === 'player_list') {
        // Receive player list from consumer and populate global list
        const players = data['players'];
        player_list = players;
        // Update UI
        updatePlayerList(players);
    } else if (messageType === 'clue_message') {
        const message = data['message'];
        const is_turn = data['is_player_turn'];
        // Allow the guessers to make a guess once a clue is given
        if (!is_turn) {
            allowGuessing();
        } else {
            // disallow sending a clue
            document.getElementById('clue-message-input').disabled = true;
            document.getElementById('clue-message-submit').disabled = true;
        }
        updateChat(message);
    } else if (messageType === 'current_player') {
        const player = data['player'];
        updateHeader(player);
    } else if (messageType === 'player_turn') {
        const player = data['player'];
        player_turn = player;
    } else if (messageType === 'update_player') {
        const players = data['players'];
        player_list = players;
        updatePlayerList(players)
    } else if (messageType === 'turn_update') {
        // Update whose turn it is
        const player = data['player'];
        is_turn = data['is_player_turn'];
        player_turn = player;
        cur_player = data['cur_player'];
        // Hide elements
        document.getElementById('start-game-button').style.display = 'none';
        document.getElementById('confirmGuessButton').style.display = 'none';

        // No guessing should be done until a clue is given
        disallowGuessing();

        // For each person, if it is their turn, show the clue giver elements
        // Otherwise show the guesser elements
        if (is_turn) {
            updateClueGiverElements();
        } else {
            updateGuesserElements();
        }
    } else if (messageType === 'update_picked_color') {
        xCoord = data['picked_color']['x_coord']
        yCoord = data['picked_color']['y_coord']
        color = data['picked_color']['color']
        picked_color = {
            'x_coord': xCoord,
            'y_coord': yCoord,
            'color': color,
        }
    } else if (messageType === 'all_guesses_received') {
        const players = data['players'];
        const picked_color = data['picked_color'];
        const cur_player = data['cur_player'];
        document.getElementById('confirmGuessButton').style.display = 'none';
        let last_guess = false;
        let clue_giver_id;
        // We are re-making the player sidebar, so clear it for now
        clearPlayerUI();

        for (let player of Object.values(players)) {
            let id = player.id;
            let name = player.name;
            let color = player.color;
            let points = player.points;
            let guesses = Object.values(player.guesses);
            // If a player made guesses, add their square to the board
            if (guesses.length > 0) {
                let guess_number = player.guesses.length;
                // Check if the players made 2 guesses
                last_guess = guess_number === 2;
                let guess_rw = player.guesses[guess_number - 1].row;
                let guess_cl = player.guesses[guess_number - 1].col;
                // Remove any temporary guess squares
                removeGuessSquare(id, -1);
                addGuessSquare(guess_rw, guess_cl, id, color, guess_number);
            } else {
                clue_giver_id = id;
            }
            // Re-add a player to the sidebar to show their guesses
            addPlayerToUI(name, color, points, guesses);
        }

        if (last_guess) {
            let playerPoints = calculatePoints(players, picked_color);
            let pointsLabelInEndOfRoundModal = document.getElementById('endOfRoundPointsReceived');
            let cur_received_points = playerPoints[cur_player.id]['points'];
            pointsLabelInEndOfRoundModal.textContent = "You have received " + cur_received_points + " points.";
            let colorInEndOfRoundModal = document.getElementById("endOfRoundColor");
            
            colorInEndOfRoundModal.style.backgroundColor = picked_color['color'];
            
            let endOfRoundModal = document.getElementById('endRoundModal');
            endOfRoundModal.style.display='block';
            // Show end modal:
            setTimeout(function () {
                // We are updating the player UI so clear it for now
                clearPlayerUI();
                clearGuessSquares();
                endOfRoundModal.style.display='none';

                // Update the points for the clue giver
                for (let player of Object.values(players)) {
                    let id = player.id;
                    let name = player.name;
                    let color = player.color;
                    let points = player.points;
                    let new_points = points += playerPoints[id]['points'];

                    gameSocket.send(JSON.stringify(
                        {
                            'type': 'update_player',
                            'id': id,
                            'name': name,
                            'color': color,
                            'points': new_points,
                            'guesses': [],
                        }
                    ));
                    if (cur_player['id'] === id) {
                        updateHeader(
                            {
                                'name': name,
                                'color': color,
                                'points': new_points,
                            }
                        );
                    }

                }
                if (cur_player['id'] === clue_giver_id) {
                    document.getElementById('next-turn-button').style.display = 'block';
                } else {
                    document.getElementById('player-updates-label').style.display = 'block';
                    document.getElementById('player-updates-label').textContent = 'Waiting for next turn...';
                }
            }, 3000);
            if (cur_player['id'] === clue_giver_id) {
                // Update UIs
                document.querySelector('.clue-input-container').style.display = 'none';
                document.getElementById('clue-message-input').disabled = false;
                document.getElementById('clue-message-submit').disabled = false;
                document.getElementById('colorChoice').style.display = 'none';
            }
        } else {
            if (cur_player['id'] === clue_giver_id) {
                document.getElementById('clue-message-input').disabled = false;
                document.getElementById('clue-message-submit').disabled = false;
            } else {
                document.getElementById('player-updates-label').style.display = 'block';
                document.getElementById('player-updates-label').textContent = 'Waiting for a clue...';
            }
        }
    } else if (messageType === 'guess_submission') {
        //console.log("GUESS MADE!");
    } else {
        console.error("Incorrect message type in frontend - ", messageType);
    }
};

function updateClueGiverElements() {
    document.getElementById('player-updates-label').style.display = 'none';
    document.getElementById('my-turn').textContent = "Clue Giver";
    // Show clue giver utilities
    document.getElementById('drawCardButton').style.display = 'block';
}

function updateGuesserElements() {
    document.getElementById('player-updates-label').style.display = 'block';
    document.getElementById('player-updates-label').textContent = 'Waiting for a clue...';
    document.getElementById('my-turn').textContent = "Guesser";
    // Hide clue giver utilities
    document.getElementById('next-turn-button').style.display = 'none';
    document.getElementById('drawCardButton').style.display = 'none';
    document.getElementById('colorChoice').style.display = 'none';
    document.querySelector('.clue-input-container').style.display = 'none';
}

gameSocket.onclose = function (e) {
    console.error('Game socket closed unexpectedly');
};

/* PLAYERS */

function updateHeader(player) {
    const headerName = document.getElementById('my-name');
    headerName.textContent = player['name'];
    const myColor = document.getElementById('my-color');
    myColor.style.backgroundColor = player['color'];
    const myScore = document.getElementById('my-score');
    myScore.textContent = `${player['points']}pts`
}

document.querySelector('#submitPlayerInfo').addEventListener('click', submitPlayerInfo);

function submitPlayerInfo() {
    const playerName = document.querySelector('#playerName').value;
    const playerColor = document.querySelector('#playerColor').value;
    // Send player info to consumer
    gameSocket.send(JSON.stringify({
        'type': 'add_player',
        'name': playerName,
        'color': playerColor,
        'points': 0,
        'guesses': [],
    }));
    // Hide the player input modal
    const playerInputModal = document.querySelector('#playerInputModal');
    playerInputModal.style.display = 'none';
    // Get the "current player" - player who opened the window
    gameSocket.send(JSON.stringify({ 'type': 'get_player' }));
}

function showPlayerInputModal() {
    const playerInputModal = document.querySelector('#playerInputModal');
    playerInputModal.style.display = 'block';
}

function clearPlayerUI() {
    const playerList = document.querySelector('.player-info-container');
    while (playerList.firstChild) {
        playerList.removeChild(playerList.firstChild);
    }
    // Set up the player list UI
    playerList.innerHTML = '';
    const playerTitle = document.createElement('div');
    playerTitle.classList.add('player-info-title');
    playerTitle.textContent = "Players:";
    playerList.appendChild(playerTitle);
}

function addPlayerToUI(name, color, points, guesses) {
    // Create a div container for the player info
    const playerList = document.querySelector('.player-info-container');
    const playerBox = document.createElement('div');
    playerBox.classList.add('player-box');

    const playerBoxTop = document.createElement('div');
    playerBoxTop.classList.add('player-box-top');
    // Add player name
    const playerNameElem = document.createElement('span');
    playerNameElem.classList.add('player-name');
    playerNameElem.textContent = name;
    playerBoxTop.appendChild(playerNameElem);
    // Add player color
    const playerColorElem = document.createElement('div');
    playerColorElem.classList.add('player-color');
    playerColorElem.style.backgroundColor = color;
    playerBoxTop.appendChild(playerColorElem);
    // Add player points
    const playerScoreElem = document.createElement('div');
    playerScoreElem.textContent = `${points}pts`;
    playerScoreElem.classList.add('player-score');
    playerBoxTop.appendChild(playerScoreElem);

    const playerBoxBot = document.createElement('div');
    playerBoxBot.classList.add('player-box-bot');
    // Add player guesses
    if (Object.values(guesses).length > 0) {
        const playerGuessesUl = document.createElement('ul');
        playerGuessesUl.classList.add('player-guesses'); // Add a class for styling
        for (let guess of Object.values(guesses)) {
            const playerGuessElem = document.createElement('li');
            playerGuessElem.classList.add('player-guess');
            let rowInt = parseInt(guess.row);
            let rowLetter = String.fromCharCode(rowInt + 64);
            playerGuessElem.textContent = `(${guess.col}, ${rowLetter})`;
            playerGuessesUl.appendChild(playerGuessElem);
        }
        playerBoxBot.appendChild(playerGuessesUl);
    }
    playerBox.appendChild(playerBoxTop);
    playerBox.appendChild(playerBoxBot);
    playerList.appendChild(playerBox);
}

function updatePlayerList(players) {
    // Set up the player list UI
    const playerList = document.querySelector('.player-info-container');
    playerList.innerHTML = '';
    const playerTitle = document.createElement('div');
    playerTitle.classList.add('player-info-title');
    playerTitle.textContent = "Players:";
    playerList.appendChild(playerTitle);
    // Add each player in the list to the UI
    players.forEach(player => {
        addPlayerToUI(player.name, player.color, player.points, player.guesses);
    });
}

/* MESSAGES */

document.querySelector('#clue-message-input').onkeyup = function (e) {
    if (e.keyCode === 13) {
        document.querySelector('#clue-message-submit').click();
    }
};

document.querySelector('#clue-message-submit').onclick = async function (e) {
    const messageInputDom = document.querySelector('#clue-message-input');
    const message = messageInputDom.value;
    gameSocket.send(JSON.stringify({ 'type': 'clue_message', 'message': message }));
    messageInputDom.value = '';
};

function updateChat(message) {
    const index_of_player_turn = getIndexOfPlayer(player_list, player_turn);
    const player = player_list[index_of_player_turn];

    document.querySelector('#clue-log').value += (player.name + ": " + message + '\n');
}

/* TURNS */

document.querySelector('#start-game-button').addEventListener('click', startGame);

function startGame() {
    if (player_list.lenght > 2) {
        nextTurn();
    } else {
        let morePlayersModal = document.getElementById('morePlayersModal');
        morePlayersModal.style.display = "block";
        setTimeout(function () {
            morePlayersModal.style.display = "none";
        }, 3000);
    }
    
}

document.querySelector('#next-turn-button').addEventListener('click', nextTurn);

function nextTurn() {
    clearGuessSquares()
    // Get the current player turn
    gameSocket.send(JSON.stringify({ 'type': 'player_turn' }));
    let next_player_turn;
    // If it is the first turn of the game, choose a random player to go first
    if (player_turn === null) {
        next_player_turn = getRandomItem(player_list);
    } else {
        // If we know whose turn it was, go to the next player in the list
        const index = getIndexOfPlayer(player_list, player_turn);
        const next_index = (index + 1) % player_list.length;
        next_player_turn = player_list[next_index];
    }
    // Send whose turn it is next to the consumer
    gameSocket.send(JSON.stringify({ 'type': 'next_turn_request', 'next_player_turn': next_player_turn }));
}

function getRandomItem(list) {
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
}

function getIndexOfPlayer(list, playerId) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].id == playerId) {
            return i;
        }
    }
    return -1;
}

/* COLOR GUESSING */

function guessColor(event) {
    document.getElementById('player-updates-label').style.display = 'none';
    document.getElementById('confirmGuessButton').style.display = 'block';

    guess_row = event.target.dataset.row;
    guess_col = event.target.dataset.col;
    guess_color = event.target.style.backgroundColor;

    removeGuessSquare(cur_player.id, -1);

    addGuessSquare(guess_row, guess_col, cur_player.id, cur_player.color, -1);
}

document.querySelector('#confirmGuessButton').addEventListener('click', confirmGuess);

function confirmGuess() {
    disallowGuessing();

    const guess = {
        row: guess_row,
        col: guess_col,
        color: guess_color,
    };

    gameSocket.send(JSON.stringify({ 'type': 'guess_submission', 'guess': guess }))

    guess_row = null;
    guess_col = null;
    guess_color = null;
}

function allowGuessing() {
    document.getElementById('player-updates-label').textContent = 'Click a color to make a guess';
    document.getElementById('confirmGuessButton').disabled = false;
    const squares = document.querySelectorAll('.color-col');
    // Allow click and hover listeners
    squares.forEach((square) => {
        square.addEventListener('mouseover', () => {
            square.style.cursor = 'pointer';
            square.style.border = '1px solid gray';
        });
        square.addEventListener('mouseout', () => {
            square.style.cursor = 'default';
            square.style.border = '1px solid black';
        });
        square.addEventListener('click', guessColor);
    });
}

function disallowGuessing() {
    document.getElementById('confirmGuessButton').disabled = true;
    const squares = document.querySelectorAll('.color-col');
    // Disallow click and hover listeners
    squares.forEach((square) => {
        square.addEventListener('mouseover', () => {
            square.style.cursor = 'default';
            square.style.border = '1px solid black';
        });
        square.addEventListener('mouseout', () => {
            square.style.cursor = 'default';
            square.style.border = '1px solid black';
        });
        square.removeEventListener('click', guessColor);
    });
}

function clearGuessSquares() {
    const elementsToRemove = document.querySelectorAll('.guess-color-square');

    // Iterate over the selected elements and remove each one
    elementsToRemove.forEach(element => {
        element.remove();
    });
}

function addGuessSquare(row, col, playerId, playerColor, guessNumber) {
    // Add new guess square
    const square = document.querySelector(
        `[data-row="${row}"][data-col="${col}"]`
    );
    const colorSquare = document.createElement("div");
    colorSquare.classList.add("guess-color-square");
    colorSquare.setAttribute('id', `guess-token-${playerId}-${guessNumber}`);
    colorSquare.style.backgroundColor = playerColor;
    square.appendChild(colorSquare);
}

function removeGuessSquare(playerId, guessNumber) {
    // Remove the previous guess by ID
    const guessSquareId = `guess-token-${playerId}-${guessNumber}`;
    const guessSquare = document.getElementById(guessSquareId);
    if (guessSquare) {
        guessSquare.remove();
    }
}

function getPoints(guessedXCoord, guessedYCoord, picked_color) {
    actualXCoord = picked_color['x_coord'];
    actualYCoord = picked_color['y_coord'].charCodeAt(0) - 64;

    const dx = Math.abs(actualXCoord - guessedXCoord);
    const dy = Math.abs(actualYCoord - guessedYCoord);
    // Check if the coordinates are the same
    if (dx == 0 && dy == 0) {
        return 3;
    }
    // Check if the coordinates are 1 square apart
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1) || (dx === 1 && dy === 1)) {
        return 2;
    }
    // Check if the coordinates are 2 squares apart
    if ((dx == 2 && dy == 0) || (dx == 0 && dy == 2) || (dx == 2 && dy == 1) || (dx == 1 && dy == 2) || (dx == 2 && dy == 2)) {
        return 1;
    }
    // Coordinates are more than 2 squares apart
    return 0;
}

function calculatePoints(players, picked_color) {
    let playerPoints = {};
    let clueGiverPoints = 0;
    let clueGiver = null;

    for (let player in Object.values(players)) {
        let playerId = Object.values(players)[player].id;
        let guesses = Object.values(players)[player].guesses;
        let points = 0;
        if (guesses.length > 0) {
            for (let guess of guesses) {
                let receivedPoints = getPoints(guess.col, guess.row, picked_color);
                points += receivedPoints;
                if (receivedPoints > 0)  {
                    clueGiverPoints += 1;
                }
            }
        } else {
            clueGiver = playerId;
        }
        playerPoints[playerId] = {'points': points, 'isClueGiver':false};
    }
    if (clueGiver) {
        playerPoints[clueGiver] = {'points': clueGiverPoints, 'isClueGiver':true};
    }
    return playerPoints;
}

/* ON LOAD */

showPlayerInputModal();
