const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const levels = [
    { name: 'УРОВЕНЬ 1: ЛЕГКИЙ', width: 1200, scoreForNext: 150, minSpeed: 1.0, maxSpeed: 1.8, spawnRate: 50, enemySize: 12 },
    { name: 'УРОВЕНЬ 2: СРЕДНИЙ', width: 1600, scoreForNext: 350, minSpeed: 1.7, maxSpeed: 3.0, spawnRate: 34, enemySize: 14 },
    { name: 'УРОВЕНЬ 3: СЛОЖНЫЙ', width: 2200, scoreForNext: Infinity, minSpeed: 2.8, maxSpeed: 4.8, spawnRate: 26, enemySize: 16 }
];

const state = {
    players: {},
    bullets: [],
    enemies: [],
    score: 0,
    currentLevel: 1,
    enemyTimer: 0,
    nextEntityId: 1
};

function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
    res.writeHead(status, { 'Content-Type': 'text/plain' });
    res.end(text);
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };
    return map[ext] || 'application/octet-stream';
}

function serveStatic(req, res) {
    let pathname = url.parse(req.url).pathname;
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(__dirname, pathname);
    if (!filePath.startsWith(__dirname)) {
        sendText(res, 403, 'Forbidden');
        return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            sendText(res, 404, 'Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
        res.end(data);
    });
}

function createPlayerTemplate(id) {
    return {
        x: id === 1 ? 100 : 700,
        y: 300,
        speed: 6,
        size: 18,
        turretAngle: 0,
        hp: 3,
        isDead: false
    };
}

function resetGameState() {
    state.bullets = [];
    state.enemies = [];
    state.score = 0;
    state.currentLevel = 1;
    state.enemyTimer = 0;
}

function handleJoin(req, res) {
    const playerCount = Object.keys(state.players).length;
    if (playerCount >= 2) {
        sendJson(res, 409, { error: 'Сервер заполнен.' });
        return;
    }
    const playerId = state.players[1] ? 2 : 1;
    state.players[playerId] = createPlayerTemplate(playerId);
    if (playerCount === 0) {
        resetGameState();
    }
    sendJson(res, 200, { playerId });
}

function handleState(req, res) {
    sendJson(res, 200, {
        players: state.players,
        bullets: state.bullets,
        enemies: state.enemies,
        score: state.score,
        currentLevel: state.currentLevel
    });
}

function handleUpdate(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk;
    });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const playerId = Number(data.playerId);
            if (!playerId || !state.players[playerId]) {
                sendJson(res, 400, { error: 'Неверный playerId' });
                return;
            }
            const player = state.players[playerId];
            if (typeof data.x === 'number') player.x = data.x;
            if (typeof data.y === 'number') player.y = data.y;
            if (typeof data.hp === 'number') player.hp = data.hp;
            if (typeof data.isDead === 'boolean') player.isDead = data.isDead;
            if (typeof data.turretAngle === 'number') player.turretAngle = data.turretAngle;
            if (data.shoot === true && !player.isDead) {
                state.bullets.push({
                    id: state.nextEntityId++,
                    x: player.x,
                    y: player.y,
                    angle: player.turretAngle,
                    speed: 20,
                    owner: playerId
                });
            }
            sendJson(res, 200, { ok: true });
        } catch (error) {
            sendJson(res, 400, { error: 'Неверный JSON' });
        }
    });
}

function advanceLevelIfNeeded() {
    const levelData = levels[state.currentLevel - 1];
    if (state.currentLevel < levels.length && state.score >= levelData.scoreForNext) {
        state.currentLevel += 1;
        state.enemyTimer = 0;
    }
}

function updateServerState() {
    const levelData = levels[state.currentLevel - 1];
    const alivePlayers = Object.values(state.players).filter(player => !player.isDead);
    if (alivePlayers.length === 0) return;

    state.enemyTimer += 1;
    if (state.enemyTimer > levelData.spawnRate) {
        const startX = Math.random() < 0.5 ? -20 : levelData.width + 20;
        state.enemies.push({
            id: state.nextEntityId++,
            x: startX,
            y: Math.random() * 560 + 20,
            speed: levelData.minSpeed + Math.random() * (levelData.maxSpeed - levelData.minSpeed),
            size: levelData.enemySize,
            angle: 0
        });
        state.enemyTimer = 0;
    }

    for (let i = state.bullets.length - 1; i >= 0; i--) {
        const bullet = state.bullets[i];
        bullet.x += Math.cos(bullet.angle) * bullet.speed;
        bullet.y += Math.sin(bullet.angle) * bullet.speed;
        if (bullet.x < 0 || bullet.x > levelData.width || bullet.y < 0 || bullet.y > 600) {
            state.bullets.splice(i, 1);
        }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        const angleToTarget = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        enemy.x += Math.cos(angleToTarget) * enemy.speed;
        enemy.y += Math.sin(angleToTarget) * enemy.speed;
        enemy.angle += 0.05;

        if (enemy.x < -40 || enemy.x > levelData.width + 40 || enemy.y < -40 || enemy.y > 640) {
            state.enemies.splice(i, 1);
            continue;
        }

        let destroyed = false;
        for (let j = state.bullets.length - 1; j >= 0; j--) {
            const bullet = state.bullets[j];
            if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.size + 10) {
                state.bullets.splice(j, 1);
                state.enemies.splice(i, 1);
                state.score += 10;
                destroyed = true;
                break;
            }
        }
        if (destroyed) continue;

        alivePlayers.forEach(player => {
            const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            if (!player.isDead && dist < player.size + enemy.size) {
                player.hp -= 1;
                if (player.hp <= 0) {
                    player.hp = 0;
                    player.isDead = true;
                }
                state.enemies.splice(i, 1);
            }
        });
    }

    advanceLevelIfNeeded();
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    if (req.method === 'GET' && parsedUrl.pathname === '/join') {
        handleJoin(req, res);
        return;
    }
    if (req.method === 'GET' && parsedUrl.pathname === '/state') {
        handleState(req, res);
        return;
    }
    if (req.method === 'POST' && parsedUrl.pathname === '/update') {
        handleUpdate(req, res);
        return;
    }
    if (req.method === 'GET') {
        serveStatic(req, res);
        return;
    }
    sendText(res, 404, 'Not found');
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

setInterval(updateServerState, 60);