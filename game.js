// === 俄羅斯方塊 - 手機電腦通用版 ===
class Tetris {
    constructor() {
        // Canvas
        this.boardCanvas = document.getElementById('board');
        this.nextCanvas = document.getElementById('next');
        this.ctx = this.boardCanvas.getContext('2d');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        // 遊戲參數
        this.COLS = 10;
        this.ROWS = 20;
        this.BLOCK = 30; // 每個方塊像素
        
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
        
        // 當前方塊
        this.piece = null;
        this.nextPiece = null;
        this.pieceX = 0;
        this.pieceY = 0;
        
        // 消除動畫
        this.clearing = [];
        this.clearFrame = 0;
        this.isClearing = false;
        
        // 粒子
        this.particles = [];
        
        // 觸控狀態
        this.touchTimers = {};
        
        // 方塊形狀
        this.SHAPES = [
            [[1,1,1,1]],                          // I
            [[1,1],[1,1]],                        // O
            [[0,1,0],[1,1,1]],                    // T
            [[0,1,1],[1,1,0]],                    // S
            [[1,1,0],[0,1,1]],                    // Z
            [[1,0,0],[1,1,1]],                    // J
            [[0,0,1],[1,1,1]]                     // L
        ];
        
        // 霓虹顏色
        this.COLORS = [
            null,
            { fill: '#00ffff', glow: '#00ffff' }, // I - cyan
            { fill: '#ffff00', glow: '#ffff00' }, // O - yellow
            { fill: '#cc00ff', glow: '#cc00ff' }, // T - purple
            { fill: '#00ff00', glow: '#00ff00' }, // S - green
            { fill: '#ff3333', glow: '#ff0000' }, // Z - red
            { fill: '#0066ff', glow: '#0066ff' }, // J - blue
            { fill: '#ff8800', glow: '#ff8800' }  // L - orange
        ];
        
        this.init();
    }
    
    init() {
        // Canvas 實際大小
        this.boardCanvas.width = this.COLS * this.BLOCK;
        this.boardCanvas.height = this.ROWS * this.BLOCK;
        this.nextCanvas.width = this.BLOCK * 4;
        this.nextCanvas.height = this.BLOCK * 4;
        
        // 顯示最高分
        document.getElementById('highScore').textContent = this.highScore;
        
        // 事件綁定
        this.bindEvents();
        
        // 背景粒子
        this.createBgParticles();
        
        // 繪製空畫面
        this.resetBoard();
        this.draw();
        this.drawNext();
        
        // 動畫循環
        this.animate();
    }
    
    bindEvents() {
        // 鍵盤
        document.addEventListener('keydown', (e) => this.onKey(e));
        
        // 觸控按鈕
        const btnMap = {
            btnLeft: 'left',
            btnRight: 'right',
            btnUp: 'rotate',
            btnDown: 'down',
            btnDrop: 'drop'
        };
        
        Object.entries(btnMap).forEach(([id, action]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.mobileAction(action);
                // 長按移動
                if (action === 'left' || action === 'right' || action === 'down') {
                    this.touchTimers[action] = setInterval(() => this.mobileAction(action), 80);
                }
            });
            
            btn.addEventListener('pointerup', (e) => {
                e.preventDefault();
                if (this.touchTimers[action]) {
                    clearInterval(this.touchTimers[action]);
                    this.touchTimers[action] = null;
                }
            });
            
            btn.addEventListener('pointerleave', () => {
                if (this.touchTimers[action]) {
                    clearInterval(this.touchTimers[action]);
                    this.touchTimers[action] = null;
                }
            });
        });
        
        // 暫停覆蓋層點擊
        document.getElementById('pauseOverlay').addEventListener('click', () => {
            if (this.isPaused) this.togglePause();
        });
        
        // 選單按鈕
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        
        // 遊戲板觸控手勢
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
    
    restart() { this.start(); }
    
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
        
        // 更新最高分
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('tetrisHS', this.highScore);
            document.getElementById('highScore').textContent = this.highScore;
        }
        
        document.getElementById('finalScore').textContent = `分數: ${this.score}`;
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
    
    canMove(px, py, shape = this.piece) {
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
        // 落下粒子
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
        
        // 牆壁踢
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
            
            if (this.combo > 1) this.showCombo(this.combo);
        } else {
            this.combo = 0;
            this.spawnPiece();
        }
        this.updateDisplay();
    }
    
    clearAnimation() {
        if (!this.isClearing || this.clearing.length === 0) return;
        
        this.clearFrame++;
        if (this.clearFrame >= 12) {
            // 移除行
            this.clearing.sort((a, b) => b - a);
            for (const y of this.clearing) {
                this.board.splice(y, 1);
                this.board.unshift(new Array(this.COLS).fill(0));
                this.spawnClearParticles(y);
            }
            
            this.lines += this.clearing.length;
            this.level = Math.floor(this.lines / 10) + 1;
            
            // 更新速度
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
    
    showCombo(n) {
        const el = document.getElementById('comboText');
        el.textContent = `${n}x 連擊!`;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 1000);
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
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);
        
        // 網格
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        for (let x = 0; x <= this.COLS; x++) {
            ctx.beginPath();
            ctx.moveTo(x * this.BLOCK, 0);
            ctx.lineTo(x * this.BLOCK, this.ROWS * this.BLOCK);
            ctx.stroke();
        }
        for (let y = 0; y <= this.ROWS; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * this.BLOCK);
            ctx.lineTo(this.COLS * this.BLOCK, y * this.BLOCK);
            ctx.stroke();
        }
        
        // 已固定的方塊
        for (let y = 0; y < this.ROWS; y++) {
            for (let x = 0; x < this.COLS; x++) {
                if (this.board[y][x]) {
                    if (this.isClearing && this.clearing.includes(y)) {
                        const a = 1 - this.clearFrame / 12;
                        const f = Math.sin(this.clearFrame * 0.7) * 0.5 + 0.5;
                        this.drawBlock(ctx, x, y, { fill: '#fff', glow: '#fff' }, a * f);
                    } else {
                        this.drawBlock(ctx, x, y, this.COLORS[this.board[y][x]]);
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
                        this.drawBlock(ctx, this.pieceX + x, dy, c);
                    }
                }
            }
        }
        
        // 粒子
        this.drawParticles(ctx);
    }
    
    drawBlock(ctx, bx, by, color, alpha = 1) {
        const x = bx * this.BLOCK;
        const y = by * this.BLOCK;
        const s = this.BLOCK;
        
        ctx.globalAlpha = alpha;
        ctx.shadowColor = color.glow;
        ctx.shadowBlur = 8;
        ctx.fillStyle = color.fill;
        ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        
        // 高光
        const g = ctx.createLinearGradient(x, y, x + s, y + s);
        g.addColorStop(0, 'rgba(255,255,255,0.25)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.05)');
        g.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = g;
        ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        
        ctx.strokeStyle = color.glow;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
        
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
    
    drawNext() {
        const ctx = this.nextCtx;
        ctx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        if (!this.nextPiece) return;
        
        const idx = this.nextColorIndex();
        const c = this.COLORS[idx];
        const bs = 25;
        const ox = (this.nextCanvas.width - this.nextPiece[0].length * bs) / 2;
        const oy = (this.nextCanvas.height - this.nextPiece.length * bs) / 2;
        
        for (let y = 0; y < this.nextPiece.length; y++) {
            for (let x = 0; x < this.nextPiece[y].length; x++) {
                if (!this.nextPiece[y][x]) continue;
                const px = ox + x * bs;
                const py = oy + y * bs;
                ctx.shadowColor = c.glow;
                ctx.shadowBlur = 8;
                ctx.fillStyle = c.fill;
                ctx.fillRect(px + 1, py + 1, bs - 2, bs - 2);
                const g = ctx.createLinearGradient(px, py, px + bs, py + bs);
                g.addColorStop(0, 'rgba(255,255,255,0.25)');
                g.addColorStop(1, 'rgba(0,0,0,0.2)');
                ctx.fillStyle = g;
                ctx.fillRect(px + 1, py + 1, bs - 2, bs - 2);
                ctx.strokeStyle = c.glow;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(px + 1, py + 1, bs - 2, bs - 2);
                ctx.shadowBlur = 0;
            }
        }
    }
    
    nextColorIndex() {
        for (let i = 0; i < this.SHAPES.length; i++) {
            if (this.SHAPES[i] === this.nextPiece) return i + 1;
        }
        return 1;
    }
    
    drawParticles(ctx) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 4;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.03;
            p.vy += 0.08;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
    
    // === 事件處理 ===
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
    
    mobileAction(action) {
        if (this.isGameOver) {
            if (action === 'drop') this.start();
            return;
        }
        if (!this.isRunning || this.isPaused || this.isClearing) return;
        
        switch (action) {
            case 'left': this.moveLeft(); break;
            case 'right': this.moveRight(); break;
            case 'down': this.softDrop(); break;
            case 'rotate': this.rotate(); break;
            case 'drop': this.hardDrop(); break;
        }
    }
    
    // === 背景粒子 ===
    createBgParticles() {
        const container = document.getElementById('particlesContainer');
        const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff8800', '#0066ff'];
        for (let i = 0; i < 25; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            const size = Math.random() * 4 + 2;
            p.style.width = size + 'px';
            p.style.height = size + 'px';
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.boxShadow = `0 0 ${size * 2}px ${p.style.background}`;
            p.style.animationDuration = (Math.random() * 5 + 4) + 's';
            p.style.animationDelay = Math.random() * 5 + 's';
            container.appendChild(p);
        }
    }
    
    // === 工具 ===
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
        // 持續更新粒子（包含遊戲結束後）
        if (this.particles.length > 0) {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);
            this.draw();
        }
        requestAnimationFrame(() => this.animate());
    }
}

// 啟動
const game = new Tetris();
