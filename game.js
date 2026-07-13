// game.js
class Tetris {
    constructor() {
        // Canvas 設定
        this.boardCanvas = document.getElementById('board');
        this.nextCanvas = document.getElementById('next');
        this.boardCtx = this.boardCanvas.getContext('2d');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        // 設定實際像素大小
        this.boardCanvas.width = 300;
        this.boardCanvas.height = 600;
        this.nextCanvas.width = 120;
        this.nextCanvas.height = 120;
        
        // 遊戲參數
        this.cols = 10;
        this.rows = 20;
        this.blockSize = 30;
        
        // 遊戲狀態
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.score = 0;
        this.highScore = localStorage.getItem('tetrisHighScore') || 0;
        this.level = 1;
        this.lines = 0;
        this.combo = 0;
        this.gameOver = false;
        this.isPaused = false;
        this.gameLoop = null;
        
        // 方塊狀態
        this.currentPiece = null;
        this.nextPiece = null;
        this.currentX = 0;
        this.currentY = 0;
        
        // 消除動畫
        this.clearingLines = [];
        this.clearAnimationFrame = 0;
        this.isClearing = false;
        
        // 粒子系統
        this.particles = [];
        
        // 方塊定義
        this.pieces = [
            // I
            [[1, 1, 1, 1]],
            // O
            [[1, 1],
             [1, 1]],
            // T
            [[0, 1, 0],
             [1, 1, 1]],
            // S
            [[0, 1, 1],
             [1, 1, 0]],
            // Z
            [[1, 1, 0],
             [0, 1, 1]],
            // J
            [[1, 0, 0],
             [1, 1, 1]],
            // L
            [[0, 0, 1],
             [1, 1, 1]]
        ];
        
        // 霓虹色彩方案
        this.colors = [
            null,
            { fill: '#00ffff', glow: '#00ffff', name: 'cyan' },     // I
            { fill: '#ffff00', glow: '#ffff00', name: 'yellow' },   // O
            { fill: '#cc00ff', glow: '#cc00ff', name: 'purple' },   // T
            { fill: '#00ff00', glow: '#00ff00', name: 'green' },    // S
            { fill: '#ff0000', glow: '#ff0000', name: 'red' },      // Z
            { fill: '#0066ff', glow: '#0066ff', name: 'blue' },     // J
            { fill: '#ff8800', glow: '#ff8800', name: 'orange' }    // L
        ];
        
        this.init();
    }
    
    init() {
        // 按鈕事件
        document.getElementById('highScore').textContent = this.highScore;
        
        // 鍵盤事件
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // 初始化背景粒子
        this.createBackgroundParticles();
        
        // 繪製初始畫面
        this.drawBoard();
        this.drawNext();
        
        // 開始動畫循環
        this.animate();
    }
    
    createBackgroundParticles() {
        const container = document.getElementById('particles');
        const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff8800'];
        
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.width = (Math.random() * 4 + 2) + 'px';
            particle.style.height = particle.style.width;
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            particle.style.animationDelay = Math.random() * 6 + 's';
            particle.style.animationDuration = (Math.random() * 4 + 4) + 's';
            container.appendChild(particle);
        }
    }
    
    start() {
        // 清除舊的遊戲循環
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        
        // 重置遊戲狀態
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.combo = 0;
        this.gameOver = false;
        this.isPaused = false;
        this.isClearing = false;
        this.clearingLines = [];
        this.particles = [];
        
        // 更新顯示
        this.updateScore();
        document.getElementById('gameOverOverlay').classList.remove('active');
        document.getElementById('pauseOverlay').classList.remove('active');
        
        // 生成方塊
        this.spawnPiece();
        
        // 開始遊戲循環
        this.gameLoop = setInterval(() => this.update(), Math.max(100, 1000 - (this.level - 1) * 100));
        
        // 動畫效果
        this.boardCanvas.style.boxShadow = '0 0 40px rgba(0, 240, 240, 0.5)';
        setTimeout(() => {
            this.boardCanvas.style.boxShadow = '0 0 40px rgba(0, 240, 240, 0.3)';
        }, 500);
    }
    
    togglePause() {
        if (this.gameOver || !this.gameLoop) return;
        
        this.isPaused = !this.isPaused;
        const pauseOverlay = document.getElementById('pauseOverlay');
        
        if (this.isPaused) {
            pauseOverlay.classList.add('active');
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        } else {
            pauseOverlay.classList.remove('active');
            this.gameLoop = setInterval(() => this.update(), Math.max(100, 1000 - (this.level - 1) * 100));
        }
    }
    
    spawnPiece() {
        if (this.nextPiece === null) {
            this.nextPiece = this.getRandomPiece();
        }
        
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.getRandomPiece();
        this.currentX = Math.floor((this.cols - this.currentPiece[0].length) / 2);
        this.currentY = 0;
        
        if (this.checkCollision(this.currentX, this.currentY, this.currentPiece)) {
            this.handleGameOver();
        }
        
        this.drawNext();
    }
    
    getRandomPiece() {
        const idx = Math.floor(Math.random() * this.pieces.length);
        return this.pieces[idx].map(row => [...row]);
    }
    
    update() {
        if (this.gameOver || this.isPaused || this.isClearing) return;
        
        if (!this.checkCollision(this.currentX, this.currentY + 1, this.currentPiece)) {
            this.currentY++;
        } else {
            this.lockPiece();
            this.checkLines();
        }
        
        this.drawBoard();
    }
    
    lockPiece() {
        const colorIndex = this.getPieceColorIndex();
        
        for (let y = 0; y < this.currentPiece.length; y++) {
            for (let x = 0; x < this.currentPiece[y].length; x++) {
                if (this.currentPiece[y][x]) {
                    const boardY = this.currentY + y;
                    const boardX = this.currentX + x;
                    if (boardY >= 0 && boardY < this.rows && boardX >= 0 && boardX < this.cols) {
                        this.board[boardY][boardX] = colorIndex;
                    }
                }
            }
        }
        
        // 方塊落下粒子效果
        this.createDropParticles();
    }
    
    getPieceColorIndex() {
        for (let i = 0; i < this.pieces.length; i++) {
            if (this.pieces[i] === this.currentPiece) {
                return i + 1;
            }
        }
        return 1;
    }
    
    checkLines() {
        const fullLines = [];
        
        for (let y = 0; y < this.rows; y++) {
            if (this.board[y].every(cell => cell !== 0)) {
                fullLines.push(y);
            }
        }
        
        if (fullLines.length > 0) {
            this.isClearing = true;
            this.clearingLines = fullLines;
            this.clearAnimationFrame = 0;
            
            // 連擊系統
            this.combo++;
            const comboBonus = this.combo * 50;
            this.score += fullLines.length * 100 * this.level + comboBonus;
            
            // 顯示連擊
            if (this.combo > 1) {
                this.showCombo(this.combo);
            }
        } else {
            this.combo = 0;
            this.spawnPiece();
        }
        
        this.updateScore();
    }
    
    clearLinesAnimation() {
        if (!this.isClearing || this.clearingLines.length === 0) return;
        
        this.clearAnimationFrame++;
        const maxFrames = 15;
        
        if (this.clearAnimationFrame >= maxFrames) {
            // 消除完成
            this.clearingLines.sort((a, b) => b - a);
            this.clearingLines.forEach(y => {
                this.board.splice(y, 1);
                this.board.unshift(Array(this.cols).fill(0));
                this.createClearParticles(y);
            });
            
            this.lines += this.clearingLines.length;
            this.level = Math.floor(this.lines / 10) + 1;
            
            // 更新遊戲速度
            if (this.gameLoop) {
                clearInterval(this.gameLoop);
                this.gameLoop = setInterval(() => this.update(), Math.max(100, 1000 - (this.level - 1) * 100));
            }
            
            this.clearingLines = [];
            this.isClearing = false;
            this.spawnPiece();
            this.updateScore();
        }
        
        this.drawBoard();
    }
    
    createClearParticles(lineY) {
        for (let x = 0; x < this.cols; x++) {
            for (let i = 0; i < 3; i++) {
                this.particles.push({
                    x: x * this.blockSize + this.blockSize / 2,
                    y: lineY * this.blockSize + this.blockSize / 2,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8 - 2,
                    life: 1,
                    color: this.colors[Math.floor(Math.random() * 7) + 1].fill,
                    size: Math.random() * 4 + 2
                });
            }
        }
    }
    
    createDropParticles() {
        for (let y = 0; y < this.currentPiece.length; y++) {
            for (let x = 0; x < this.currentPiece[y].length; x++) {
                if (this.currentPiece[y][x]) {
                    const px = (this.currentX + x) * this.blockSize + this.blockSize / 2;
                    const py = (this.currentY + y) * this.blockSize + this.blockSize / 2;
                    for (let i = 0; i < 2; i++) {
                        this.particles.push({
                            x: px,
                            y: py,
                            vx: (Math.random() - 0.5) * 3,
                            vy: (Math.random() - 0.5) * 3,
                            life: 1,
                            color: this.colors[this.getPieceColorIndex()].fill,
                            size: Math.random() * 3 + 1
                        });
                    }
                }
            }
        }
    }
    
    showCombo(combo) {
        const comboDisplay = document.getElementById('comboDisplay');
        comboDisplay.textContent = `${combo}x 連擊!`;
        comboDisplay.classList.add('active');
        
        setTimeout(() => {
            comboDisplay.classList.remove('active');
        }, 1000);
    }
    
    checkCollision(x, y, piece) {
        for (let py = 0; py < piece.length; py++) {
            for (let px = 0; px < piece[py].length; px++) {
                if (piece[py][px]) {
                    const newX = x + px;
                    const newY = y + py;
                    
                    if (newX < 0 || newX >= this.cols || newY >= this.rows) {
                        return true;
                    }
                    
                    if (newY >= 0 && this.board[newY][newX] !== 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    rotate() {
        if (this.gameOver || this.isPaused || this.isClearing) return;
        
        const rotated = [];
        const rows = this.currentPiece.length;
        const cols = this.currentPiece[0].length;
        
        for (let x = 0; x < cols; x++) {
            rotated[x] = [];
            for (let y = rows - 1; y >= 0; y--) {
                rotated[x].push(this.currentPiece[y][x]);
            }
        }
        
        // 牆壁碰撞檢測
        const kicks = [0, -1, 1, -2, 2];
        for (const kick of kicks) {
            if (!this.checkCollision(this.currentX + kick, this.currentY, rotated)) {
                this.currentPiece = rotated;
                this.currentX += kick;
                return;
            }
        }
        
        this.drawBoard();
    }
    
    hardDrop() {
        if (this.gameOver || this.isPaused || this.isClearing) return;
        
        let dropDistance = 0;
        while (!this.checkCollision(this.currentX, this.currentY + 1, this.currentPiece)) {
            this.currentY++;
            dropDistance++;
        }
        
        this.score += dropDistance * 2;
        this.lockPiece();
        this.checkLines();
        this.drawBoard();
        this.updateScore();
    }
    
    handleGameOver() {
        this.gameOver = true;
        clearInterval(this.gameLoop);
        this.gameLoop = null;
        
        // 更新最高分
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('tetrisHighScore', this.highScore);
            document.getElementById('highScore').textContent = this.highScore;
        }
        
        // 顯示遊戲結束畫面
        document.getElementById('finalScore').textContent = `最終分數: ${this.score}`;
        document.getElementById('gameOverOverlay').classList.add('active');
        
        // 遊戲結束特效
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                x: Math.random() * this.boardCanvas.width,
                y: Math.random() * this.boardCanvas.height,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1,
                color: '#ff0000',
                size: Math.random() * 5 + 2
            });
        }
    }
    
    handleKeyPress(e) {
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.moveLeft();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.moveRight();
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (!this.gameOver && !this.isPaused && !this.isClearing) {
                    if (!this.checkCollision(this.currentX, this.currentY + 1, this.currentPiece)) {
                        this.currentY++;
                        this.score++;
                        this.updateScore();
                        this.drawBoard();
                    }
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.rotate();
                break;
            case ' ':
                e.preventDefault();
                this.hardDrop();
                break;
            case 'p':
            case 'P':
                this.togglePause();
                break;
        }
    }
    
    moveLeft() {
        if (this.gameOver || this.isPaused || this.isClearing) return;
        if (!this.checkCollision(this.currentX - 1, this.currentY, this.currentPiece)) {
            this.currentX--;
            this.drawBoard();
        }
    }
    
    moveRight() {
        if (this.gameOver || this.isPaused || this.isClearing) return;
        if (!this.checkCollision(this.currentX + 1, this.currentY, this.currentPiece)) {
            this.currentX++;
            this.drawBoard();
        }
    }
    
    drawBlock(ctx, x, y, colorObj, size = this.blockSize, alpha = 1) {
        const { fill, glow } = colorObj;
        
        // 發光效果
        ctx.shadowColor = glow;
        ctx.shadowBlur = 10 * alpha;
        
        // 主體
        ctx.fillStyle = fill;
        ctx.globalAlpha = alpha;
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
        
        // 內部高光
        const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
        
        // 邊框
        ctx.strokeStyle = glow;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
        
        // 重置效果
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
    
    drawBoard() {
        this.boardCtx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);
        
        // 繪製網格背景
        this.boardCtx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.boardCtx.lineWidth = 1;
        for (let x = 0; x <= this.cols; x++) {
            this.boardCtx.beginPath();
            this.boardCtx.moveTo(x * this.blockSize, 0);
            this.boardCtx.lineTo(x * this.blockSize, this.boardCanvas.height);
            this.boardCtx.stroke();
        }
        for (let y = 0; y <= this.rows; y++) {
            this.boardCtx.beginPath();
            this.boardCtx.moveTo(0, y * this.blockSize);
            this.boardCtx.lineTo(this.boardCanvas.width, y * this.blockSize);
            this.boardCtx.stroke();
        }
        
        // 繪製已放置的方塊
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.board[y][x]) {
                    // 消除動畫
                    if (this.isClearing && this.clearingLines.includes(y
