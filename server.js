const io = require('socket.io')(3000, {
    cors: { origin: "*" } // Разрешаем подключение с любых компьютеров
});

console.log("Сервер запущен на порту 3000. Ожидание игроков...");

// Храним роли игроков и общее состояние игры
let players = {}; 
let gameState = {
    shipX: 400,
    shipY: 300,
    turretAngle: 0,
    bullets: [],
    enemies: [],
    score: 0,
    hp: 3
};

// Таймер для спавна врагов на сервере
let enemyTimer = 0;

io.on('connection', (socket) => {
    // Распределяем роли: первый зашедший - пилот, второй - стрелок
    if (!players.pilot) {
        players.pilot = socket.id;
        socket.emit('setRole', 'pilot');
        console.log(`Игрок ${socket.id} стал ПИЛОТОМ`);
    } else if (!players.shooter) {
        players.shooter = socket.id;
        socket.emit('setRole', 'shooter');
        console.log(`Игрок ${socket.id} стал СТРЕЛКОМ`);
    } else {
        socket.emit('setRole', 'spectator'); // Остальные просто смотрят
    }

    // Принимаем движение от Пилота
    socket.on('pilotMove', (data) => {
        if (socket.id === players.pilot) {
            gameState.shipX = data.x;
            gameState.shipY = data.y;
        }
    });

    // Принимаем поворот мыши от Стрелка
    socket.on('shooterRotate', (angle) => {
        if (socket.id === players.shooter) {
            gameState.turretAngle = angle;
        }
    });

    // Принимаем выстрел от Стрелка
    socket.on('shooterShoot', (bulletData) => {
        if (socket.id === players.shooter) {
            gameState.bullets.push(bulletData);
        }
    });

    // Очистка при отключении игрока
    socket.on('disconnect', () => {
        if (socket.id === players.pilot) { players.pilot = null; console.log("Пилот отключился"); }
        if (socket.id === players.shooter) { players.shooter = null; console.log("Стрелок отключился"); }
    });
});

// Главный цикл сервера (60 раз в секунду пересчитывает физику)
setInterval(() => {
    // 1. Движение пуль
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        let b = gameState.bullets[i];
        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;
        if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600) {
            gameState.bullets.splice(i, 1);
        }
    }

    // 2. Спавн врагов (каждые ~1.5 секунды)
    enemyTimer++;
    if (enemyTimer > 90 && (players.pilot || players.shooter)) {
        gameState.enemies.push({
            x: Math.random() < 0.5 ? -20 : 820,
            y: Math.random() * 600,
            speed: 2,
            size: 15
        });
        enemyTimer = 0;
    }

    // 3. Движение врагов к кораблю и коллизии
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        let e = gameState.enemies[i];
        let angle = Math.atan2(gameState.shipY - e.y, gameState.shipX - e.x);
        e.x += Math.cos(angle) * e.speed;
        e.y += Math.sin(angle) * e.speed;

        // Враг врезался в корабль
        if (Math.hypot(gameState.shipX - e.x, gameState.shipY - e.y) < 35) {
            gameState.enemies.splice(i, 1);
            gameState.hp--;
            continue;
        }

        // Пуля попала во враг
        for (let j = gameState.bullets.length - 1; j >= 0; j--) {
            let b = gameState.bullets[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < e.size + 4) {
                gameState.enemies.splice(i, 1);
                gameState.bullets.splice(j, 1);
                gameState.score += 10;
                break;
            }
        }
    }

    // Отправляем обновленное состояние ВСЕМ подключенным браузерам
    io.emit('serverUpdate', gameState);
}, 1000 / 60);