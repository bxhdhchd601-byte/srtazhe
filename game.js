const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const roleDiv = document.getElementById('role');

// Подключаемся к локальному серверу Node.js
const socket = io('http://localhost:3000');

let myRole = 'spectator'; // Наша роль (определится сервером)
let serverState = {};    // Здесь будут храниться данные от сервера

const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
let localShip = { x: 400, y: 300, speed: 5 }; // Локальный просчет для пилота

// Получаем роль от сервера
socket.on('setRole', (role) => {
    myRole = role;
    if (role === 'pilot') roleDiv.innerText = "ВАША РОЛЬ: ПИЛОТ (Управление: WASD)";
    if (role === 'shooter') roleDiv.innerText = "ВАША РОЛЬ: СТРЕЛОК (Управление: Мышь + Клик)";
    if (role === 'spectator') roleDiv.innerText = "МЕСТ НЕТ: ВЫ ЗРИТЕЛЬ";
});

// Получаем постоянные обновления от сервера
socket.on('serverUpdate', (state) => {
    serverState = state;
});

// Управление Пилота
window.addEventListener('keydown', (e) => {
    if (myRole === 'pilot' && e.code in keys) {
        keys[e.code] = true;
        e.preventDefault();
    }
});
window.addEventListener('keyup', (e) => {
    if (myRole === 'pilot' && e.code in keys) {
        keys[e.code] = false;
        e.preventDefault();
    }
});

// Управление Стрелка (Мышь)
canvas.addEventListener('mousemove', (e) => {
    if (myRole === 'shooter' && serverState.shipX) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        // Считаем угол пушки относительно корабля
        const angle = Math.atan2(mouseY - serverState.shipY, mouseX - serverState.shipX);
        socket.emit('shooterRotate', angle);
    }
});

// Стрельба Стрелка (Клик)
canvas.addEventListener('mousedown', (e) => {
    if (myRole === 'shooter' && e.button === 0 && serverState.hp > 0) {
        socket.emit('shooterShoot', {
            x: serverState.shipX,
            y: serverState.shipY,
            angle: serverState.turretAngle,
            speed: 12
        });
    }
});

// Цикл обновления графики
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!serverState.shipX) {
        requestAnimationFrame(draw);
        return;
    }

    // Если игра окончена
    if (serverState.hp <= 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff3333';
        ctx.font = 'bold 40px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('МИССИЯ ПРОВАЛЕНА', canvas.width / 2, canvas.height / 2);
        requestAnimationFrame(draw);
        return;
    }

    // Рисуем интерфейс
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Courier New';
    ctx.fillText(`ЖИЗНИ: ${'❤️'.repeat(serverState.hp)}`, 20, 30);
    ctx.fillText(`ОЧКИ: ${serverState.score}`, canvas.width - 150, 30);

    // Рисуем врагов
    ctx.fillStyle = '#ff3333';
    serverState.enemies.forEach(e => {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Рисуем пули
    ctx.fillStyle = '#00f0ff';
    serverState.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Рисуем корабль
    ctx.save();
    ctx.translate(serverState.shipX, serverState.shipY);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 0);    
    ctx.lineTo(-20, -15); 
    ctx.lineTo(-10, 0);   
    ctx.lineTo(-20, 15);  
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Рисуем турель
    ctx.save();
    ctx.translate(serverState.shipX, serverState.shipY);
    ctx.rotate(serverState.turretAngle);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    ctx.restore();

    // Локальный апдейт движения пилота для плавности передачи
    if (myRole === 'pilot') {
        if (keys.KeyW) localShip.y -= localShip.speed;
        if (keys.KeyS) localShip.y += localShip.speed;
        if (keys.KeyA) localShip.x -= localShip.speed;
        if (keys.KeyD) localShip.x += localShip.speed;
        socket.emit('pilotMove', { x: localShip.x, y: localShip.y });
    } else {
        // Синхронизируем локальные координаты не-пилотов
        localShip.x = serverState.shipX;
        localShip.y = serverState.shipY;
    }

    requestAnimationFrame(draw);
}

draw();