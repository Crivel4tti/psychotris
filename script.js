let score = 0;
const scoreElement = document.getElementById('score');
const canvas = document.getElementById('tetris-canvas');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece-canvas');
const nextContext = nextCanvas.getContext('2d');
const infoText = document.getElementById('info-text');
const gameOverModal = document.getElementById('game-over-modal');
const restartButton = document.getElementById('restart-button');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

context.canvas.width = COLS * BLOCK_SIZE;
context.canvas.height = ROWS * BLOCK_SIZE;

const nextContextSize = 4 * BLOCK_SIZE;
nextContext.canvas.width = nextContextSize;
nextContext.canvas.height = nextContextSize;


const EDUCATIONAL_FACTS = [
    "CBD tem potencial ansiolítico, ajudando a reduzir o estresse e a ansiedade.",
    "A psicologia é fundamental para acompanhar pacientes em terapia com cannabis, oferecendo suporte emocional.",
    "Canabidiol (CBD) não possui os efeitos psicoativos do THC, sendo seguro para uso terapêutico.",
    "Estudos mostram que o CBD pode ser eficaz no tratamento de dores crônicas e inflamações.",
    "A terapia cognitivo-comportamental pode ajudar a otimizar os resultados do tratamento com cannabis medicinal.",
    "O sistema endocanabinoide, presente no nosso corpo, regula funções como humor, sono e apetite.",
    "O acompanhamento psicológico garante o uso consciente e responsável da cannabis medicinal.",
    "A cannabis medicinal pode ser uma ferramenta no tratamento de epilepsia refratária em crianças e adultos.",
    "O CBD interage com receptores de serotonina, o que pode explicar seus efeitos no humor e na ansiedade.",
    "A empatia e a escuta ativa são cruciais na abordagem psicológica de pacientes que usam cannabis medicinal."
];

const PIECES = {
    'I': { shape: [[1, 1, 1, 1]], imageIndex: 0 },
    'J': { shape: [[0, 1, 0], [0, 1, 0], [1, 1, 0]], imageIndex: 1 },
    'L': { shape: [[0, 1, 0], [0, 1, 0], [0, 1, 1]], imageIndex: 1 },
    'O': { shape: [[1, 1], [1, 1]], imageIndex: 0 },
    'S': { shape: [[0, 1, 1], [1, 1, 0]], imageIndex: 2 },
    'T': { shape: [[0, 1, 0], [1, 1, 1]], imageIndex: 0 },
    'Z': { shape: [[1, 1, 0], [0, 1, 1]], imageIndex: 2 }
};

const PIECE_IMAGES = [];
let imagesLoaded = 0;
const IMAGE_SOURCES = ['cannabis_leaf.png', 'psi_symbol.png', 'cbd_formula.png'];

IMAGE_SOURCES.forEach(src => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
        imagesLoaded++;
        if (imagesLoaded === IMAGE_SOURCES.length) {
            init();
        }
    };
    PIECE_IMAGES.push(img);
});

let board = createBoard();
let player;
let nextPiece;
let animationFrameId;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isGameOver = false;

// Audio setup
let audioContext;
let lineClearSoundBuffer;

function setupAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    fetch('line_clear.mp3')
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
            lineClearSoundBuffer = audioBuffer;
        })
        .catch(e => console.error("Error with decoding audio data", e));
}

function playSound(buffer) {
    if (!audioContext || !buffer || audioContext.state === 'suspended') return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function createPiece(type) {
    const pieceData = PIECES[type];
    return {
        shape: pieceData.shape,
        image: PIECE_IMAGES[pieceData.imageIndex],
        pos: { x: Math.floor(COLS / 2) - Math.floor(pieceData.shape[0].length / 2), y: 0 }
    };
}

function getRandomPiece() {
    const types = 'IJLOSTZ';
    const type = types[Math.floor(Math.random() * types.length)];
    return createPiece(type);
}

function drawMatrix(matrix, offset, ctx, image) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.drawImage(image, (x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            }
        });
    });
}

function drawBoard() {
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const image = value; // value is the image object itself
                context.drawImage(image, x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            }
        });
    });
}

function draw() {
    context.fillStyle = 'rgba(15, 23, 42, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    drawBoard();
    if (player) {
        drawMatrix(player.shape, player.pos, context, player.image);
    }
}

function drawNextPiece() {
    nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (nextPiece) {
        const shape = nextPiece.shape;
        const image = nextPiece.image;
        const xOffset = (nextCanvas.width - shape[0].length * BLOCK_SIZE) / 2;
        const yOffset = (nextCanvas.height - shape.length * BLOCK_SIZE) / 2;
        drawMatrix(shape, {x: xOffset/BLOCK_SIZE, y: yOffset/BLOCK_SIZE}, nextContext, image);
    }
}

function merge(board, player) {
    player.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + player.pos.y][x + player.pos.x] = player.image;
            }
        });
    });
}

function collide(board, player) {
    const [matrix, offset] = [player.shape, player.pos];
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] !== 0 &&
                (board[y + offset.y] &&
                    board[y + offset.y][x + offset.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function rotate(matrix) {
    const N = matrix.length;
    const M = matrix[0].length;
    const result = Array.from({length: M}, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < M; c++) {
            result[c][N - 1 - r] = matrix[r][c];
        }
    }
    return result;
}

function playerRotate() {
    const originalPos = player.pos.x;
    let offset = 1;
    const rotated = rotate(player.shape);
    player.shape = rotated;
    
    while (collide(board, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.shape[0].length) {
            player.shape = rotate(rotate(rotate(player.shape))); // rotate back
            player.pos.x = originalPos;
            return;
        }
    }
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(board, player)) {
        player.pos.x -= dir;
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(board, player)) {
        player.pos.y--;
        merge(board, player);
        playerReset();
        sweepLines();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide(board, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(board, player);
    playerReset();
    sweepLines();
    dropCounter = 0;
}

function playerReset() {
    player = nextPiece;
    nextPiece = getRandomPiece();
    drawNextPiece();
    
    if (collide(board, player)) {
        gameOver();
    }
}

function sweepLines() {
    let linesCleared = 0;
    outer: for (let y = board.length - 1; y > 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        ++y;
        linesCleared++;
    }

    if (linesCleared > 0) {
        playSound(lineClearSoundBuffer);
        showRandomFact();

        // Adicionar pontuação
        const points = [0, 100, 300, 500, 800]; 
        score += points[linesCleared] || 0;
        scoreElement.textContent = score;
    }
}

function showRandomFact() {
    const fact = EDUCATIONAL_FACTS[Math.floor(Math.random() * EDUCATIONAL_FACTS.length)];
    infoText.classList.add('fade');
    setTimeout(() => {
        infoText.textContent = fact;
        infoText.classList.remove('fade');
    }, 500);
}

function update(time = 0) {
    if (isGameOver) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    animationFrameId = requestAnimationFrame(update);
}


function handleKeyDown(event) {
    if (isGameOver) return;
     if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    switch (event.key) {
        case 'ArrowLeft':
            playerMove(-1);
            break;
        case 'ArrowRight':
            playerMove(1);
            break;
        case 'ArrowDown':
            playerDrop();
            break;
        case 'ArrowUp':
            playerRotate();
            break;
        case ' ': // Space bar for hard drop
            event.preventDefault();
            playerHardDrop();
            break;
    }
}

function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(animationFrameId);
    gameOverModal.classList.remove('hidden');
}

function restartGame() {
    isGameOver = false;
    board = createBoard();
    playerReset();
    score = 0;
    scoreElement.textContent = score;
    infoText.textContent = "Elimine uma linha para ver um fato educativo aqui!";
    gameOverModal.classList.add('hidden');
    update();
}

function init() {
    setupAudio();
    document.addEventListener('keydown', handleKeyDown);
    restartButton.addEventListener('click', restartGame);
    player = getRandomPiece();
    nextPiece = getRandomPiece();
    drawNextPiece();
    update();
}

