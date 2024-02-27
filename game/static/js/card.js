const colorOptions = document.getElementById("colorOptionsModal");
const colorOptionsContent = document.getElementById("colorOptionsModalContent");
document.getElementById("drawCardButton").addEventListener("click", showColorOptions);

function showColorOptions() {
    
    const colsToRemove = document.querySelectorAll('.card-col');
    colsToRemove.forEach(element => {
        element.remove();
    });

    const rowsToRemove = document.querySelectorAll('.card-row');
    rowsToRemove.forEach(element => {
        element.remove();
    });

    
    for (let i = 0; i < 2; i++) {
        const row = document.createElement("div");
        row.className = "card-row";
    
        for (let j = 0; j < 2; j++) {
            const col = document.createElement("div");
            const randomY = Math.floor(Math.random() * 16) + 1;
            const randomX = Math.floor(Math.random() * 30) + 1;
            const yCoord = String.fromCharCode(64 + randomY);
            const xCoord = randomX;
            const hue = Math.round(randomX * 12);
            const saturation = 100
            const lightness = 15 + Math.round(randomY * 5);
            const colorDiv = document.createElement("div");
            colorDiv.className = "card-color-square";
            colorDiv.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            const coordDiv = document.createElement("div");
            coordDiv.className = "card-coord";
            coordDiv.textContent  = `(${xCoord}, ${yCoord})`;
            col.appendChild(colorDiv);
            col.appendChild(coordDiv);
            row.appendChild(col);
            col.className = "card-col";
        }
    
        colorOptionsContent.appendChild(row);
        const cardModal = document.querySelector('#colorOptionsModal');
        cardModal.style.display = 'block';

        document.querySelectorAll('.card-color-square').forEach((cardColorSquare) => {
            cardColorSquare.addEventListener('click', pickColor);
        });
    }
}

function pickColor() {
    // Extracting xCoord, yCoord, and color from the clicked card
    const xCoord = this.nextElementSibling.textContent.split(',')[0].slice(1).trim();
    const yCoord = this.nextElementSibling.textContent.split(',')[1].slice(0, -1).trim();
    const color = this.style.backgroundColor;
    const colorOptionsModal = document.getElementById('colorOptionsModal');
    colorOptionsModal.style.display = 'none';
    document.getElementById('drawCardButton').style.display = 'none';
    const colorChoice = document.getElementById('colorChoice');
    colorChoice.style.display = 'block';
    colorChoice.style.backgroundColor = color;
    colorChoice.textContent = `(${xCoord}, ${yCoord})`;
    if (yCoord >= 'K') {
        colorChoice.style.color = 'black';
    } else {
        colorChoice.style.color = 'white';
    }
    document.querySelector('.clue-input-container').style.display='block';
    
    gameSocket.send(JSON.stringify({
        'type': 'color_selection',
        'x_coord': xCoord,
        'y_coord': yCoord,
        'color': color,
    }))
}