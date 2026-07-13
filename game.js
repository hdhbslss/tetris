// === 俄羅斯方塊 - 完整版 ===
class Tetris {
    constructor() {
        // Canvas 元素
        this.boardCanvas = document.getElementById('board');
        this.nextCanvas = document.getElementById('next');
        this.ctx = this.boardCanvas.getContext('2d');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        // 遊戲參數
        this.COLS = 10;
        this.ROWS = 20;
        this.BLOCK = 30;
        
        // 遊戲狀態
        this.board = [];
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('tetrisHS')) || 0;
        this.level = 1;
        this.lines = 0;
        this.combo = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.isGameOver = false;
        this.loopId = null;
        
        // 方塊狀態
        this.piece = null;
        this.nextPiece = null;
        this.pieceX = 0;
        this.pieceY = 0;
        
        // 消除動畫
        this.clearing = [];
        this.clearFrame = 0;
        this.isClearing = false;
        
        // 粒子系統
        this.particles = [];
        
        // 觸控計時器
        this.touchTimers = {};
        
        // 方塊形狀定義
        this.SHAPES = [
            [[1, 1, 1, 1]],                          // I
            [[1, 1], [1, 1]],                        // O
            [[0, 1, 0], [1, 1, 1]],                  // T
            [[0, 1, 1], [1, 1, 0]],                  // S
            [[1, 1, 0], [0, 1, 1]],                  // Z
            [[1, 0, 0], [1, 1, 1]],                  // J
            [[0, 0, 1], [1, 1, 1]]                   // L
        ];
        
        // 霓虹色彩
        this.COLORS = [
            null,
            { fill: '#00ffff', glow: '#00ffff' },    // I - cyan
            { fill: '#ffff00', glow: '#ffff00' },    // O - yellow
            { fill: '#cc00ff', glow: '#cc00ff' },    // T - purple
            { fill: '#00ff00', glow: '#00ff00' },    // S - green
            { fill: '#ff3333', glow: '#ff0000' },    // Z - red
            { fill: '#0066ff', glow: '#0066ff' },    // J - blue
            { fill: '#ff8800', glow: '#ff8800' }     // L - orange
        ];
        
        this.init();
    }
    
    // === 初始化 ===
    init() {
        // 設定 Canvas 實際大小
        this.boardCanvas.width = this.COLS * this.BLOCK;
        this.boardCanvas.height = this.ROWS * this.BLOCK;
        this.nextCanvas.width = this.BLOCK * 4;
        this.nextCanvas.height = this.BLOCK * 4;
        
        // 顯示最高分
        document.getElementById('highScore').textContent = this.highScore;
        
        // 綁定事件
        this.bindEvents();
        
        // 建立背景特效
        this.createBgStars();
        this.createBgFloatBlocks();
        
        // 初始畫面
        this.resetBoard();
        this.draw();
        this.drawNext();
        
        // 啟動動畫循環
        this.animate();
    }
    
    // === 事件綁定 ===
    bindEvents() {
        // 鍵盤事件
        document.addEventListener('keydown', (e) => this.onKey(e));
        
        // 觸控按鈕事件
        const btnActions = {
            btnLeft: 'left',
            btnRight: 'right',
            btnRotate: 'rotate',
            btnDrop: 'drop'
        };
        
        Object.entries(btnActions).forEach(([id, action]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.mobileAction(action);
                // 左右移動支援長按
                if (action === 'left' || action === 'right') {
                    this.touchTimers[action] = setInterval(() => this.mobileAction(action), 80);
                }
            });
            
            btn.addEventListener('pointerup', (e) => {
                e.preventDefault();
                this.clearTouchTimer(action);
            });
            
            btn.addEventListener('pointerleave', () => {
                this.clearTouchTimer(action);
            });
            
            btn.addEventListener('pointercancel', () => {
                this.clearTouchTimer(action);
            });
        });
        
        // 選單按鈕
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.start());
        
        // 暫停覆蓋層點擊
        document.getElementById('pauseOverlay').addEventListener('click', () => {
            if (this.isPaused) this.togglePause();
        });
        
        // 遊戲說明彈窗
        document.getElementById('helpBtn').addEventListener('click', () => {
            document.getElementById('helpModal').classList.add('active');
        });
        
        document.getElementById('closeHelp').addEventListener('click', () => {
            document.getElementById('helpModal').classList.remove('active');
        });
        
        document.getElementById('helpModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('helpModal')) {
                document.getElementById('helpModal').classList.remove('active');
            }
        });
        
        // 畫布觸控手勢
        let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
        
        this.boardCanvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
            }
        }, { passive: true });
        
        this.boardCanvas.addEventListener('touchend', (e) => {
            if (!this.isRunning || this.isGameOver || this.isPaused) return;
            
            const dx = (e.changedTouches[0]?.clientX || touchStartX) - touchStartX;
            const dy = (e.changedTouches[0]?.clientY || touchStartY) - touchStartY;
            const dt = Date.now() - touchStartTime;
            
            // 快速點擊 = 旋轉
            if (Math.abs(dx) < 20 && Math.abs(dy) < 20 && dt < 300) {
                this.rotate();
                return;
            }
            
            // 下滑 = 硬降
            if (dy > 60 && dt < 500) {
                this.hardDrop();
                return;
            }
            
            // 左右滑動
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
                if (dx > 0) this.moveRight();
                else this.moveLeft();
            }
        });
    }
    
    clearTouchTimer(action) {
        if (this.touchTimers[action]) {
            clearInterval(this.touchTimers[action]);
            this.touchTimers[action] = null;
        }
    }
    
    // === 鍵盤處理 ===
    onKey(e) {
        if (this.isGameOver) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.start();
            }
            return;
        }
        
        if (e.key === 'p' || e.key === 'P') {
            this.togglePause();
            return;
        }
        
        if (!this.isRunning || this.isPaused || this.isClearing) return;
        
        switch (e.key) {
            case 'ArrowLeft': e.preventDefault(); this.moveLeft(); break;
            case 'ArrowRight': e.preventDefault(); this.moveRight(); break;
            case 'ArrowDown': e.preventDefault(); this.softDrop(); break;
            case 'ArrowUp': e.preventDefault(); this.rotate(); break;
            case ' ': e.preventDefault(); this.hardDrop(); break;
        }
    }
    
    // === 手機按鈕處理 ===
    mobileAction(action) {
        if (this.isGameOver) {
            if (action === 'drop') this.start();
            return;
        }
        if (!this.isRunning || this.isPaused || this.isClearing) return;
        
        switch (action) {
            case 'left': this.moveLeft(); break;
            case 'right': this.moveRight(); break;
            case 'rotate': this.rotate(); break;
            case 'drop': this.hardDrop(); break;
        }
    }
    
    // === 遊戲流程 ===
    start() {
        this.stop();
        this.resetBoard();
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.combo = 0;
        this.isGameOver = false;
        this.isPaused = false;
        this.isClearing = false;
        this.clearing = [];
        this.particles = [];
        
        this.updateDisplay();
        document.getElementById('gameOverOverlay').classList.remove('active');
        document.getElementById('pauseOverlay').classList.remove('active');
        
        this.nextPiece = this.randomPiece();
        this.spawnPiece();
        this.isRunning = true;
        this.runLoop();
    }
    
    stop() {
        this.isRunning = false;
        if (this.loopId) {
            clearInterval(this.loopId);
            this.loopId = null;
        }
    }
    
    gameOver() {
        this.isGameOver = true;
        this.stop();
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('tetrisHS', this.highScore);
            document.getElementById('highScore').textContent = this.highScore;
        }
        
        document.getElementById('finalScore').textContent = '分數: ' + this.score;
        document.getElementById('gameOverOverlay').classList.add('active');
        
        // 爆炸粒子
        for (let i = 0; i < 60; i++) {
            this.particles.push({
                x: Math.random() * this.boardCanvas.width,
                y: Math.random() * this.boardCanvas.height,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1,
                color: '#ff3333',
                size: Math.random() * 5 + 2
            });
        }
    }
    
    togglePause() {
        if (!this.isRunning || this.isGameOver) return;
        
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            document.getElementById('pauseOverlay').classList.add('active');
            this.stop();
        } else {
            document.getElementById('pauseOverlay').classList.remove('active');
            this.isRunning = true;
            this.runLoop();
        }
    }
    
    runLoop() {
        const speed = Math.max(80, 800 - (this.level - 1) * 70);
        this.loopId = setInterval(() => this.tick(), speed);
    }
    
    tick() {
        if (!this.isRunning || this.isPaused || this.isGameOver || this.isClearing) return;
        
        if (this.canMove(this.pieceX, this.pieceY + 1)) {
            this.pieceY++;
        } else {
            this.lockPiece();
        }
        this.draw();
    }
    
    // === 方塊操作 ===
    randomPiece() {
        const i = Math.floor(Math.random() * this.SHAPES.length);
        return this.SHAPES[i].map(r => [...r]);
    }
    
    spawnPiece() {
        this.piece = this.nextPiece;
        this.nextPiece = this.randomPiece();
        this.pieceX = Math.floor((this.COLS - this.piece[0].length) / 2);
        this.pieceY = 0;
        
        if (!this.canMove(this.pieceX, this.pieceY)) {
            this.gameOver();
        }
        
        this.drawNext();
    }
    
    canMove(px, py, shape = null) {
        shape = shape || this.piece;
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (!shape[y][x]) continue;
                const nx = px + x;
                const ny = py + y;
                if (nx < 0 || nx >= this.COLS || ny >= this.ROWS) return false;
                if (ny >= 0 && this.board[ny][nx]) return false;
            }
        }
        return true;
    }
    
    lockPiece() {
        const ci = this.pieceColorIndex();
        for (let y = 0; y < this.piece.length; y++) {
            for (let x = 0; x < this.piece[y].length; x++) {
                if (!this.piece[y][x]) continue;
                const by = this.pieceY + y;
                const bx = this.pieceX + x;
                if (by >= 0 && by < this.ROWS && bx >= 0 && bx < this.COLS) {
                    this.board[by][bx] = ci;
                }
            }
        }
        this.spawnDropParticles();
        this.checkLines();
    }
    
    pieceColorIndex() {
        for (let i = 0; i < this.SHAPES.length; i++) {
            if (this.SHAPES[i] === this.piece) return i + 1;
        }
        return 1;
    }
    
    moveLeft() {
        if (this.canMove(this.pieceX - 1, this.pieceY)) {
            this.pieceX--;
            this.draw();
        }
    }
    
    moveRight() {
        if (this.canMove(this.pieceX + 1, this.pieceY)) {
            this.pieceX++;
            this.draw();
        }
    }
    
    softDrop() {
        if (this.canMove(this.pieceX, this.pieceY + 1)) {
            this.pieceY++;
            this.score++;
            this.updateDisplay();
            this.draw();
        }
    }
    
    hardDrop() {
        let dist = 0;
        while (this.canMove(this.pieceX, this.pieceY + 1)) {
            this.pieceY++;
            dist++;
        }
        this.score += dist * 2;
        this.updateDisplay();
        this.lockPiece();
        this.draw();
    }
    
    rotate() {
        const rows = this.piece.length;
        const cols = this.piece[0].length;
        const rot = [];
        
        for (let x = 0; x < cols; x++) {
            rot[x] = [];
            for (let y = rows - 1; y >= 0; y--) {
                rot[x].push(this.piece[y][x]);
            }
        }
        
        // 牆壁踢檢測
        for (const kick of [0, -1, 1, -2, 2]) {
            if (this.canMove(this.pieceX + kick, this.pieceY, rot)) {
                this.piece = rot;
                this.pieceX += kick;
                this.draw();
                return;
            }
        }
    }
    
    // === 消除系統 ===
    checkLines() {
        const full = [];
        for (let y = 0; y < this.ROWS; y++) {
            if (this.board[y].every(c => c !== 0)) full.push(y);
        }
        
        if (full.length > 0) {
            this.isClearing = true;
            this.clearing = full;
            this.clearFrame = 0;
            this.combo++;
            this.score += full.length * 100 * this.level + this.combo * 50;
            
            if (this.combo > 1) {
                this.showCombo(this.combo);
            }
        } else {
            this.combo = 0;
            this.spawnPiece();
        }
        this.updateDisplay();
    }
    
    showCombo(n) {
        const el = document.getElementById('comboText');
        el.textContent = n + 'x 連擊!';
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 1000);
    }
    
    clearAnimation() {
        if (!this.isClearing || this.clearing.length === 0) return;
        
        this.clearFrame++;
        if (this.clearFrame >= 12) {
            // 移除完成的行
            this.clearing.sort((a, b) => b - a);
            for (const y of this.clearing) {
                this.board.splice(y, 1);
                this.board.unshift(new Array(this.COLS).fill(0));
                this.spawnClearParticles(y);
            }
            
            this.lines += this.clearing.length;
            this.level = Math.floor(this.lines / 10) + 1;
            
            // 更新遊戲速度
            this.stop();
            if (this.isRunning && !this.isPaused) {
                this.runLoop();
            }
            
            this.clearing = [];
            this.isClearing = false;
            this.spawnPiece();
            this.updateDisplay();
        }
        this.draw();
    }
    
    // === 粒子系統 ===
    spawnDropParticles() {
        const ci = this.pieceColorIndex();
        const color = this.COLORS[ci].fill;
        for (let y = 0; y < this.piece.length; y++) {
            for (let x = 0; x < this.piece[y].length; x++) {
                if (!this.piece[y][x]) continue;
                const px = (this.pieceX + x) * this.BLOCK + this.BLOCK / 2;
                const py = (this.pieceY + y) * this.BLOCK + this.BLOCK / 2;
                for (let i = 0; i < 2; i++) {
                    this.particles.push({
                        x: px, y: py,
                        vx: (Math.random() - 0.5) * 3,
                        vy: (Math.random() - 0.5) * 3,
                        life: 1, color, size: Math.random() * 3 + 1
                    });
                }
            }
        }
    }
    
    spawnClearParticles(rowY) {
        for (let x = 0; x < this.COLS; x++) {
            for (let i = 0; i < 3; i++) {
                const c = this.COLORS[Math.floor(Math.random() * 7) + 1].fill;
                this.particles.push({
                    x: x * this.BLOCK + this.BLOCK / 2,
                    y: rowY * this.BLOCK + this.BLOCK / 2,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8 - 2,
                    life: 1, color: c, size: Math.random() * 4 + 2
                });
            }
        }
    }
    
    // === 繪圖 ===
    resetBoard() {
        this.board = Array.from({ length: this.ROWS }, () => new Array(this.COLS).fill(0));
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);
        
        // 網格線
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= this.COLS; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.BLOCK, 0);
            this.ctx.lineTo(x * this.BLOCK, this.ROWS * this.BLOCK);
            this.ctx.stroke();
        }
        for (let y = 0; y <= this.ROWS; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.BLOCK);
            this.ctx.lineTo(this.COLS * this.BLOCK, y * this.BLOCK);
            this.ctx.stroke();
        }
        
        // 已固定的方塊
        for (let y = 0; y < this.ROWS; y++) {
            for (let x = 0; x < this.COLS; x++) {
                if (this.board[y][x]) {
                    if (this.isClearing && this.clearing.includes(y)) {
                        const alpha = 1 - this.clearFrame / 12;
                        const flash = Math.sin(this.clearFrame * 0.7) * 0.5 + 0.5;
                        this.drawBlock(x, y, { fill: '#ffffff', glow: '#ffffff' }, alpha * flash);
                    } else {
                        this.drawBlock(x, y, this.COLORS[this.board[y][x]]);
                    }
                }
            }
        }
        
        // 當前方塊
        if (this.piece && !this.isGameOver) {
            const ci = this.pieceColorIndex();
            const c = this.COLORS[ci];
            for (let y = 0; y < this.piece.length; y++) {
                for (let x = 0; x < this.piece[y].length; x++) {
                    if (!this.piece[y][x]) continue;
                    const dy = this.pieceY + y;
                    if (dy >= 0) {
                        this.drawBlock(this.pieceX + x, dy, c);
                    }
                }
            }
        }
        
        // 粒子
        this.drawParticles();
    }
    
    drawBlock(bx, by, color, alpha = 1) {
        const x = bx * this.BLOCK;
        const y = by * this.BLOCK;
        const s = this.BLOCK;
        
        this.ctx.globalAlpha = alpha;
        this.ctx.shadowColor = color.glow;
        this.ctx.shadowBlur = 8;
        this.ctx.fillStyle = color.fill;
        this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        
        // 高光效果
        const g = this.ctx.createLinearGradient(x, y, x + s, y + s);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        g.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        
        // 邊框
        this.ctx.strokeStyle = color.glow;
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
        
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
    }
    
    drawNext() {
        this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        if (!this.nextPiece) return;
        
        const ci = this.nextColorIndex();
        const c = this.COLORS[ci];
        const bs = 25;
        const ox = (this.nextCanvas.width - this.nextPiece[0].length * bs) / 2;
        const oy = (this.nextCanvas.height - this.nextPiece.length * bs) / 2;
        
        for (let y = 0; y < this.nextPiece.length; y++) {
            for (let x = 0; x < this.nextPiece[y].length; x++) {
                if (!this.nextPiece[y][x]) continue;
                
                const px = ox + x * bs;
                const py = oy + y * bs;
                
                this.nextCtx.shadowColor = c.glow;
                this.nextCtx.shadowBlur = 8;
                this.nextCtx.fillStyle = c.fill;
                this.nextCtx.fillRect(px + 1, py + 1, bs - 2, bs - 2);
                
                const g = this.nextCtx.createLinearGradient(px, py, px + bs, py + bs);
                g.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
                g.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
                this.nextCtx.fillStyle = g;
                this.nextCtx.fillRect(px + 1, py + 1, bs - 2, bs - 2);
                
                this.nextCtx.strokeStyle = c.glow;
                this.nextCtx.lineWidth = 1.5;
                this.nextCtx.strokeRect(px + 1, py + 1, bs - 2, bs - 2);
                this.nextCtx.shadowBlur = 0;
            }
        }
    }
    
    nextColorIndex() {
        for (let i = 0; i < this.SHAPES.length; i++) {
            if (this.SHAPES[i] === this.nextPiece) return i + 1;
        }
        return 1;
    }
    
    drawParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = 4;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
            
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.03;
            p.vy += 0.08;
            
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
    }
    
    // === 背景特效 ===
    createBgStars() {
        const container = document.getElementById('bgStars');
        for (let i = 0; i < 40; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            const size = Math.random() * 3 + 1;
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.style.animationDelay = Math.random() * 3 + 's';
            star.style.animationDuration = (Math.random() * 2 + 1) + 's';
            container.appendChild(star);
        }
    }
    
    createBgFloatBlocks() {
        const container = document.getElementById('bgFloatBlocks');
        const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff8800', '#0066ff'];
        
        for (let i = 0; i < 8; i++) {
            const block = document.createElement('div');
            block.className = 'float-block';
            block.style.left = Math.random() * 90 + '%';
            const size = Math.random() * 30 + 20;
            block.style.width = size + 'px';
            block.style.height = size + 'px';
            block.style.background = colors[Math.floor(Math.random() * colors.length)];
            block.style.animationDuration = (Math.random() * 10 + 12) + 's';
            block.style.animationDelay = Math.random() * 10 + 's';
            container.appendChild(block);
        }
    }
    
    // === 工具函數 ===
    updateDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('lines').textContent = this.lines;
    }
    
    animate() {
        if (this.isClearing) this.clearAnimation();
        
        if (this.isRunning && !this.isPaused && !this.isGameOver) {
            this.draw();
        }
        
        if (this.particles.length > 0) {
            this.draw();
        }
        
        requestAnimationFrame(() => this.animate());
    }
}

// === 啟動遊戲 ===
const game = new Tetris();
