const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const levelSelector = document.getElementById('levelSelector');
const modeSelector = document.getElementById('modeSelector');
const coopHint = document.getElementById('coopHint');
const menu = document.getElementById('menu');
const startButton = document.getElementById('startButton');

const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
const mouse = { x: 0, y: 0, isDown: false };

const ship = { x: 400, y: 300, speed: 6, size: 18, turretAngle: 0, hp: 3, isDead: false };
let bullets = [];
let enemies = [];
let particles = [];
let stars = [];

let score = 0;
let enemyTimer = 0;
let fireCooldown = 0;
const maxAmmo = 35;
let ammo = maxAmmo;
let reloadTimer = 0;
const reloadTime = 150;
let screenShake = 0;

const levels = [
    { name: 'УРОВЕНЬ 1: ЛЕГКИЙ', width: 1200, scoreForNext: 150, minSpeed: 1.0, maxSpeed: 1.8, spawnRate: 50, enemySize: 12 },
    { name: 'УРОВЕНЬ 2: СРЕДНИЙ', width: 1600, scoreForNext: 350, minSpeed: 1.7, maxSpeed: 3.0, spawnRate: 34, enemySize: 14 },
    { name: 'УРОВЕНЬ 3: СЛОЖНЫЙ', width: 2200, scoreForNext: Infinity, minSpeed: 2.8, maxSpeed: 4.8, spawnRate: 26, enemySize: 16 }
];
let selectedLevel = 1;
let currentLevel = 1;
let currentLevelData = levels[0];
let gameMode = 'single';
let gameStarted = false;
let cameraX = 0;

function initStars() {
    stars = [];
    for (let i = 0; i < 120; i++) {
        stars.push({
            x: Math.random() * currentLevelData.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 3 + 1
        });
    }
}

initStars();

window.addEventListener('keydown', (e) => {
    if (e.code in keys) {
        keys[e.code] = true;
        e.preventDefault();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code in keys) {
        keys[e.code] = false;
        e.preventDefault();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        if (ship.isDead) {
            restartGame();
        } else {
            mouse.isDown = true;
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.isDown = false;
});

canvas.addEventListener('mouseleave', () => {
    mouse.isDown = false;
});

function createExplosion(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1,
            color: color,
            size: Math.random() * 3 + 1
        });
    }
}

function restartGame() {
    ship.hp = 3;
    ship.isDead = false;
    ship.x = 100;
    ship.y = 300;
    bullets = [];
    enemies = [];
    particles = [];
    score = 0;
    enemyTimer = 0;
    fireCooldown = 0;
    screenShake = 0;
    ammo = maxAmmo;
    reloadTimer = 0;
    mouse.isDown = false;
    currentLevel = selectedLevel;
    currentLevelData = levels[selectedLevel - 1];
    cameraX = 0;
    initStars();
    updateLevelButtons();
}

function startGame() {
    currentLevel = selectedLevel;
    currentLevelData = levels[currentLevel - 1];
    restartGame();
    gameStarted = true;
    if (menu) menu.style.display = 'none';
}

function setMode(mode) {
    gameMode = mode;
    if (coopHint) {
        coopHint.textContent = mode === 'coop'
            ? 'Режим «Играть с другом» активирован. Реальное Bluetooth-соединение здесь не реализовано.'
            : 'Для режима «Играть с другом» пока показаны настройки. Настоящее подключение по Bluetooth требует отдельной разработки.';
    }
    updateModeButtons();
}

function update() {
    if (!gameStarted) return;
    if (ship.isDead) return;

    cameraX = ship.x - canvas.width / 2;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > currentLevelData.width - canvas.width) cameraX = currentLevelData.width - canvas.width;

    stars.forEach(s => {
        s.y += s.speed;
        if (s.y > canvas.height) {
            s.y = 0;
            s.x = Math.random() * currentLevelData.width;
        }
    });

    if (keys.KeyW) ship.y -= ship.speed;
    if (keys.KeyS) ship.y += ship.speed;
    if (keys.KeyA) ship.x -= ship.speed;
    if (keys.KeyD) ship.x += ship.speed;

    if (ship.x < 20) ship.x = 20;
    if (ship.x > currentLevelData.width - 20) ship.x = currentLevelData.width - 20;
    if (ship.y < 20) ship.y = 20;
    if (ship.y > 580) ship.y = 580;

    ship.turretAngle = Math.atan2(mouse.y - ship.y, mouse.x - ship.x);

    if (reloadTimer > 0) {
        reloadTimer--;
        if (reloadTimer === 0) ammo = maxAmmo;
    } else {
        if (fireCooldown > 0) fireCooldown--;
        if (mouse.isDown && fireCooldown === 0 && ammo > 0) {
            bullets.push({ x: ship.x, y: ship.y, angle: ship.turretAngle, speed: 20 });
            ammo--;
            fireCooldown = 5;
            if (ammo === 0) reloadTimer = reloadTime;
        }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;
        if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600) bullets.splice(i, 1);
    }

    enemyTimer++;
    if (enemyTimer > currentLevelData.spawnRate) {
        enemies.push({
            x: Math.random() < 0.5 ? -20 : currentLevelData.width + 20,
            y: Math.random() * 600,
            speed: currentLevelData.minSpeed + Math.random() * (currentLevelData.maxSpeed - currentLevelData.minSpeed),
            size: currentLevelData.enemySize || 14,
            angle: 0
        });
        enemyTimer = 0;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        let angleToShip = Math.atan2(ship.y - e.y, ship.x - e.x);
        e.x += Math.cos(angleToShip) * e.speed;
        e.y += Math.sin(angleToShip) * e.speed;
        e.angle += 0.05;

        if (Math.hypot(ship.x - e.x, ship.y - e.y) < ship.size + e.size) {
            createExplosion(ship.x, ship.y, '#ffffff', 20);
            enemies.splice(i, 1);
            ship.hp--;
            screenShake = 15;
            if (ship.hp <= 0) {
                createExplosion(ship.x, ship.y, '#00f0ff', 50);
                ship.isDead = true;
            }
            continue;
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            let b = bullets[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < e.size + 10) {
                createExplosion(e.x, e.y, '#ffffff', 15);
                enemies.splice(i, 1);
                bullets.splice(j, 1);
                score += 10;
                break;
            }
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        screenShake--;
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-cameraX, 0);

    ctx.fillStyle = '#ffffff';
    stars.forEach(s => {
        ctx.globalAlpha = s.size / 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#00f0ff';
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - Math.cos(b.angle) * 20, b.y - Math.sin(b.angle) * 20);
        ctx.stroke();
    });

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        ctx.beginPath();
        ctx.moveTo(0, -e.size);
        ctx.lineTo(e.size, 0);
        ctx.lineTo(0, e.size);
        ctx.lineTo(-e.size, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();
    });

    if (!ship.isDead) {
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(18, 15);
        ctx.lineTo(0, 8);
        ctx.lineTo(-18, 15);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(6, 8);
        ctx.lineTo(0, 4);
        ctx.lineTo(-6, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.turretAngle);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(35, 0);
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText(`СИСТЕМЫ: ${'█ '.repeat(ship.hp)}`, 20, 30);
    ctx.fillText(`УРОВЕНЬ: ${currentLevelData.name}`, 20, 55);
    ctx.fillText(`РЕЖИМ: ${gameMode === 'coop' ? 'КООП.' : 'ОДИН'}`, 20, 80);
    ctx.fillText(`СЧЕТ: ${score}`, 660, 30);

    if (reloadTimer > 0) {
        if (Math.floor(Date.now() / 200) % 2 === 0) {
            ctx.fillStyle = '#00f0ff';
            ctx.fillText('ПЕРЕЗАРЯДКА...', 640, 55);
        }
    } else {
        ctx.strokeStyle = '#00f0ff';
        ctx.strokeRect(660, 42, 100, 10);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(660, 42, (ammo / maxAmmo) * 100, 10);
    }

    if (ship.isDead) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#00f0ff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px Courier New';
        ctx.fillText('СИСТЕМНЫЙ СБОЙ', 400, 250);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Courier New';
        ctx.fillText(`Уничтожено целей: ${score / 10}`, 400, 300);
        ctx.fillText('Кликните для перезапуска', 400, 350);
        ctx.textAlign = 'left';
    }
}

function setLevel(levelNumber) {
    selectedLevel = levelNumber;
    currentLevel = levelNumber;
    currentLevelData = levels[levelNumber - 1];
    restartGame();
}

function updateLevelButtons() {
    document.querySelectorAll('#levelSelector button').forEach(button => {
        const level = Number(button.dataset.level);
        button.classList.toggle('selected', level === currentLevel);
    });
}

function updateModeButtons() {
    document.querySelectorAll('#modeSelector button').forEach(button => {
        const mode = button.dataset.mode;
        button.classList.toggle('selected', mode === gameMode);
    });
}

if (levelSelector) {
    document.querySelectorAll('#levelSelector button').forEach(button => {
        button.addEventListener('click', () => {
            setLevel(Number(button.dataset.level));
        });
    });
}

if (modeSelector) {
    document.querySelectorAll('#modeSelector button').forEach(button => {
        button.addEventListener('click', () => {
            setMode(button.dataset.mode);
        });
    });
}

if (startButton) {
    startButton.addEventListener('click', startGame);
}

updateLevelButtons();
updateModeButtons();

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
