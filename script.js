// ==================================
// HTML 요소 가져오기
// ==================================
// HTML에서 만든 캔버스(게임 보드), 다음 블록 표시, 점수, 버튼 등을 JavaScript로 제어하기 위해 가져옵니다.
const canvas = document.getElementById('tetris-board');
const context = canvas.getContext('2d');
const nextBlockCanvas = document.getElementById('next-block');
const nextBlockContext = nextBlockCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');

// ==================================
// 게임 상수 정의
// ==================================
// 게임의 기본 규칙과 크기를 정합니다. 이 값들을 바꾸면 게임 난이도나 모양이 바뀝니다.
const ROWS = 10; // 게임 보드의 세로 칸 수
const COLS = 10; // 게임 보드의 가로 칸 수
const BLOCK_SIZE = 30; // 블록 한 칸의 크기 (픽셀 단위)

// 블록의 색상을 정의합니다. 새로운 색을 추가하거나 기존 색을 바꿀 수 있습니다.
const COLORS = [
    null,       // 0번은 빈 칸
    '#FF0D72', // I 블록 (빨강)
    '#0DC2FF', // L 블록 (파랑)
    '#0DFF72', // J 블록 (초록)
    '#F538FF', // O 블록 (보라)
    '#FF8E0D', // S 블록 (주황)
    '#FFE138', // T 블록 (노랑)
    '#3877FF'  // Z 블록 (진파랑)
];

// 테트리스 블록(테트로미노)의 모양을 정의합니다. 1~7 숫자는 COLORS 배열의 순서와 같습니다.
const SHAPES = [
    [], // 0번은 빈 모양
    [[1, 1, 1, 1]], // I
    [[2, 0, 0], [2, 2, 2]], // L
    [[0, 0, 3], [3, 3, 3]], // J
    [[4, 4], [4, 4]],   // O
    [[0, 5, 5], [5, 5, 0]], // S
    [[6, 6, 6], [0, 6, 0]], // T
    [[7, 7, 0], [0, 7, 7]]  // Z
];

// ==================================
// 게임 상태 변수
// ==================================
// 게임이 진행되면서 바뀌는 값들을 저장합니다.
let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0)); // 게임 보드판 (0으로 채워진 2차원 배열)
let score = 0; // 현재 점수
let gameOver = false; // 게임 오버 상태
let paused = false; // 일시정지 상태
let piece; // 현재 움직이는 블록
let nextPiece; // 다음에 나올 블록

// ==================================
// 그리기 함수
// ==================================

/**
 * 블록 한 칸(정사각형)을 그립니다.
 * @param {number} x - 가로 위치 (칸 번호)
 * @param {number} y - 세로 위치 (칸 번호)
 * @param {string} color - 채울 색상
 * @param {CanvasRenderingContext2D} ctx - 그릴 캔버스 context
 */
function drawSquare(x, y, color, ctx = context) {
    ctx.fillStyle = color; // 칸의 색을 정하고
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE); // 색을 채웁니다.
    ctx.strokeStyle = '#333'; // 테두리 색은 검은색으로
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE); // 테두리를 그립니다.
}

/**
 * 게임 보드 전체를 그립니다.
 * board 배열을 참고하여 쌓여있는 블록들을 화면에 표시합니다.
 */
function drawBoard() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]) { // board 배열에 블록 정보가 있으면
                drawSquare(col, row, COLORS[board[row][col]]); // 해당 색으로 블록을 그립니다.
            } else { // 정보가 없으면 (0이면)
                drawSquare(col, row, '#e0ffff'); // 기본 배경색으로 그립니다.
            }
        }
    }
}

/**
 * 현재 움직이는 테트리스 블록(piece)을 그립니다.
 * @param {object} piece - 현재 블록 객체
 * @param {CanvasRenderingContext2D} ctx - 그릴 캔버스 context
 */
function drawPiece(piece, ctx = context) {
    // 블록의 모양(shape) 배열에서 색상 번호를 찾습니다.
    const color = COLORS[piece.shape.flat().find(val => val > 0)];
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value > 0) { // 모양 배열에서 0이 아닌 부분만
                drawSquare(piece.x + x, piece.y + y, color, ctx); // 화면에 그립니다.
            }
        });
    });
}

// ==================================
// 게임 로직 함수
// ==================================

/**
 * 새로운 테트리스 블록을 무작위로 생성합니다.
 * @returns {object} - 새로운 블록 객체 (x, y 위치, 모양 포함)
 */
function generatePiece() {
    const typeId = Math.floor(Math.random() * (SHAPES.length - 1)) + 1; // 1~7 사이의 무작위 숫자
    const shape = SHAPES[typeId];
    return { x: Math.floor(COLS / 2) - 1, y: 0, shape }; // 블록 객체 생성하여 반환
}

/**
 * 블록을 한 칸 아래로 내립니다.
 * 만약 더 이상 내려갈 수 없으면, 블록을 보드에 고정시키고 다음 블록을 준비합니다.
 */
function drop() {
    if (!piece) return;
    // 아래로 한 칸 이동할 수 있는지 확인
    if (!isValidMove(piece.shape, piece.x, piece.y + 1)) {
        solidifyPiece(); // 이동 불가 시, 현재 위치에 블록 고정
        removeLines();   // 꽉 찬 줄이 있는지 확인하고 제거
        piece = nextPiece; // 다음 블록을 현재 블록으로
        nextPiece = generatePiece(); // 새로운 다음 블록 생성
        drawNextPiece(); // 다음 블록 미리보기 업데이트
        // 새 블록이 시작 위치에 놓일 수 없는 경우 게임 오버
        if (!isValidMove(piece.shape, piece.x, piece.y)) {
            gameOver = true;
            alert("게임 오버!");
            bgm.pause();
        }
    } else {
        piece.y++; // 이동 가능 시, y 좌표를 1 증가시켜 아래로 이동
    }
    update(); // 화면 업데이트
}

/**
 * 블록이 이동하려는 위치가 유효한지 확인합니다. (벽, 바닥, 다른 블록과 겹치는지)
 * @param {Array} shape - 확인할 블록의 모양
 * @param {number} x - 확인할 가로 위치
 * @param {number} y - 확인할 세로 위치
 * @returns {boolean} - 이동 가능하면 true, 불가능하면 false
 */
function isValidMove(shape, x, y) {
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col] > 0) {
                let newX = x + col;
                let newY = y + row;
                // 벽에 닿거나, 바닥에 닿거나, 다른 블록과 겹치는지 확인
                if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && board[newY][newX])) {
                    return false;
                }
            }
        }
    }
    return true;
}

/**
 * 현재 블록을 게임 보드(board 배열)에 고정시킵니다.
 */
function solidifyPiece() {
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value > 0) {
                board[piece.y + y][piece.x + x] = value;
            }
        });
    });
}

/**
 * 꽉 찬 가로줄을 찾아 제거하고 점수를 올립니다.
 */
function removeLines() {
    let linesRemoved = 0;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] === 0) { // 한 칸이라도 비어있으면
                continue outer; // 다음 줄 검사
            }
        }
        // 이 줄이 꽉 찼으면
        const row = board.splice(y, 1)[0].fill(0); // 해당 줄을 제거하고
        board.unshift(row); // 맨 위에 새로운 빈 줄을 추가합니다.
        y++; // 같은 줄을 다시 검사하기 위해 y 인덱스 조정
        linesRemoved++;
    }
    // 제거한 줄 수에 따라 점수 추가 (점수 정책을 여기서 바꿀 수 있습니다)
    if (linesRemoved > 0) {
        score += linesRemoved * 10;
        scoreElement.textContent = score;
    }
}

/**
 * '다음 블록' 칸에 다음 나올 블록을 그립니다.
 */
function drawNextPiece() {
    nextBlockContext.fillStyle = '#e0ffff'; // 배경색으로 초기화
    nextBlockContext.fillRect(0, 0, nextBlockCanvas.width, nextBlockCanvas.height);
    if (nextPiece) {
        // 블록을 중앙에 예쁘게 그리기 위한 위치 계산
        const shape = nextPiece.shape;
        const color = COLORS[shape.flat().find(val => val > 0)];
        const x = (nextBlockCanvas.width / BLOCK_SIZE - shape[0].length) / 2;
        const y = (nextBlockCanvas.height / BLOCK_SIZE - shape.length) / 2;
        
        shape.forEach((row, r) => {
            row.forEach((value, c) => {
                if (value > 0) {
                    // nextBlockCanvas에 그리기 위해 context를 명시적으로 전달
                    drawSquare(x + c, y + r, color, nextBlockContext);
                }
            });
        });
    }
}

// ==================================
// 게임 실행 및 제어
// ==================================

/**
 * 게임을 시작 상태로 초기화합니다.
 */
function startGame() {
    board.forEach(row => row.fill(0)); // 보드 초기화
    score = 0; // 점수 초기화
    scoreElement.textContent = score;
    gameOver = false;
    paused = false;
    pauseButton.textContent = '일시정지';
    piece = generatePiece(); // 첫 블록 생성
    nextPiece = generatePiece(); // 다음 블록 생성
    drawNextPiece(); // 다음 블록 표시
    if (bgm) {
        bgm.currentTime = 0; // 음악 처음부터
        bgm.play(); // 배경음악 재생
    }
    lastTime = performance.now();
    gameLoop();
}

/**
 * 게임의 메인 루프. 계속해서 게임 상태를 업데이트하고 화면을 다시 그립니다.
 */
let dropCounter = 0;
let dropInterval = 1000; // 블록이 자동으로 떨어지는 간격 (1000ms = 1초)
let lastTime;

function gameLoop(time = 0) {
    if (gameOver) return; // 게임 오버 시 루프 중단

    if (!paused) {
        const deltaTime = time - (lastTime || 0);
        lastTime = time;

        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            drop();
            dropCounter = 0;
        }
    }
    update();
    requestAnimationFrame(gameLoop);
}

/**
 * 화면을 업데이트하는 함수. 보드와 현재 블록을 다시 그립니다.
 */
function update() {
    drawBoard();
    if (piece) {
        drawPiece(piece);
    }
}

/**
 * 블록을 회전시킵니다.
 */
function rotatePiece() {
    const shape = piece.shape;
    // 행과 열을 바꿔서 90도 회전
    const newShape = shape[0].map((_, colIndex) => shape.map(row => row[colIndex]).reverse());
    // 회전한 모양이 유효한 위치인지 확인 후 적용
    if (isValidMove(newShape, piece.x, piece.y)) {
        piece.shape = newShape;
    } else {
        // "Wall Kick" 같은 고급 회전 로직을 여기에 추가할 수 있습니다.
    }
}

// ==================================
// 이벤트 리스너 (사용자 입력 처리)
// ==================================

// '게임 시작' 버튼 클릭 시
startButton.addEventListener('click', startGame);

// 키보드 입력 처리
document.addEventListener('keydown', event => {
    if (gameOver || paused) return;

    if (event.key === 'ArrowLeft') { // 왼쪽 화살표
        if (isValidMove(piece.shape, piece.x - 1, piece.y)) piece.x--;
    } else if (event.key === 'ArrowRight') { // 오른쪽 화살표
        if (isValidMove(piece.shape, piece.x + 1, piece.y)) piece.x++;
    } else if (event.key === 'ArrowDown') { // 아래쪽 화살표
        drop();
    } else if (event.key === 'ArrowUp') { // 위쪽 화살표 (회전)
        rotatePiece();
    }
    update(); // 키 입력 후 즉시 화면 업데이트
});

// '일시정지' 버튼 클릭 시
pauseButton.addEventListener('click', () => {
    if (gameOver) return;
    paused = !paused;
    if (paused) {
        bgm.pause();
        pauseButton.textContent = '계속하기';
    } else {
        bgm.play();
        pauseButton.textContent = '일시정지';
        lastTime = performance.now(); // 일시정지 후 시간 점프 방지
    }
});

// ==================================
// 배경음악 설정
// ==================================
// 유명한 테트리스 테마 음악을 배경음악으로 사용합니다.
const bgm = new Audio('https://upload.wikimedia.org/wikipedia/commons/e/e5/Tetris_theme.ogg');
bgm.loop = true; // 음악 반복 재생

// ==================================
// 초기 실행
// ==================================
// 페이지가 처음 로드될 때 게임 보드를 한 번 그립니다.
drawBoard();