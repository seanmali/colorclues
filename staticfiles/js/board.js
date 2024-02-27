const colorGrid = document.getElementById("color-grid");

for (let i = 0; i < 17; i++) {
    const row = document.createElement("div");
    row.className = "color-row";

    for (let j = 0; j < 31; j++) {
        const col = document.createElement("div");
        col.className = "color-col";
        col.setAttribute("data-row", i);
        col.setAttribute("data-col", j);
        if (i === 0) {
            col.style.backgroundColor = `black`;
            col.style.color = 'white';
            col.style.textAlign = 'center';
            if (j !== 0) {
                col.textContent = j.toString();
            }
            col.className = "grid-col";
        } else if (j === 0) {
            col.style.backgroundColor = `black`;
            col.style.color = 'white';
            col.style.textAlign = 'center';
            col.textContent = String.fromCharCode(i + 64);
            col.className = "grid-col";
        } else {
            const hue = Math.round(j * 12);
            const saturation = 100
            const lightness = 15 + Math.round(i * 5);
            col.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        }
        row.appendChild(col);
    }

    colorGrid.appendChild(row);
}
