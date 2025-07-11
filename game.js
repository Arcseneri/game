// === Variabel Global ===
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 400;

let keys = {};
let frame = 0;
let score = 0;
let sessionCoin = 0;
let permanentCoin = 0;
let worldSpeed = 3;
let ghostTimer = 0;
let gameOverFlag = false;
let shopActive = false;
let shopOptions = [];

let groundY = 340;
let coins = [];
let obstacles = [];
let enemyProjectiles = [];
let checkpoints = [];
let lastCheckpointScore = 0;
let respawnCount = 3;
let lastCheckpointState = null;

let hasGun = false;
let bulletCount = 0;
let maxBullet = 1;
let hasGhostSkill = false;

let upgrades = { maxHp: 0, maxStamina: 0, bonus: 0 };
let gameStarted = false;

let player = {
  x: 50, y: 300,
  width: 40, height: 40,
  velocityY: 0,
  jumpPower: -9,
  gravity: 0.25,
  grounded: false,
  hp: 3,
  stamina: 100,
  maxStamina: 100
};

let bullets = [];

// === Input Events ===
document.addEventListener("keydown", (e) => keys[e.key] = true);
document.addEventListener("keyup", (e) => keys[e.key] = false);

canvas.addEventListener("click", function (e) {
  if (!shopActive) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (let i = 0; i < shopOptions.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 150 + col * 200;
    const y = 150 + row * 70;
    const w = 180, h = 50;
    if (mx > x && mx < x + w && my > y && my < y + h) {
      if (!shopOptions[i].condition || shopOptions[i].condition()) {
        shopOptions[i].action();
        shopActive = false;
        break;
      }
    }
  }
});

function startGame() {
  gameStarted = true;
  document.getElementById("mainMenu").style.display = "none";
  document.getElementById("gameCanvas").style.display = "block";

  player.hp = 3 + upgrades.maxHp;
  player.maxStamina = 100 + upgrades.maxStamina * 20;
  player.stamina = player.maxStamina;
  score = 0;
  sessionCoin = 0;
  frame = 0;
  respawnCount = 3;
  coins = [];
  obstacles = [];
  bullets = [];
  enemyProjectiles = [];
  checkpoints = [];
  lastCheckpointScore = 0;
  lastCheckpointState = null;
  hasGun = false;
  bulletCount = 0;
  maxBullet = 1;
  hasGhostSkill = false;
  ghostTimer = 0;
  gameOverFlag = false;
  shopActive = false;

  gameLoop();
}

function loadUpgrades() {
  upgrades = JSON.parse(localStorage.getItem("upgrades")) || { maxHp: 0, maxStamina: 0, bonus: 0 };
  permanentCoin = parseInt(localStorage.getItem("permCoin")) || 0;
  document.getElementById("permCoin").innerText = permanentCoin;
}

function saveUpgrades() {
  localStorage.setItem("upgrades", JSON.stringify(upgrades));
  localStorage.setItem("permCoin", permanentCoin.toString());
}

function buyUpgrade(type) {
  if (type === 'maxHp' && upgrades.maxHp >= 10) return;
  if (permanentCoin >= 10) {
    upgrades[type]++;
    permanentCoin -= 10;
    saveUpgrades();
    document.getElementById("permCoin").innerText = permanentCoin;
  }
}

function update() {
  frame++;

  let baseSpeed = 3;
  if (score >= 10000) {
    const extra = Math.floor((score - 10000) / 5000);
    baseSpeed += Math.min(extra, 6);
  }
  worldSpeed = baseSpeed;

  const speedFactor = worldSpeed / 3;
  const adjustedGravity = player.gravity / speedFactor;

  player.velocityY += adjustedGravity;
  player.y += player.velocityY;

  if (player.y + player.height >= groundY) {
    player.y = groundY - player.height;
    player.velocityY = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  if (keys[" "] && player.grounded) {
    const jumpBoost = (worldSpeed - 2) * 0.6;
    player.velocityY = player.jumpPower - jumpBoost;
  }

  if (hasGhostSkill && keys["Shift"] && ghostTimer <= 0 && player.stamina >= 30) {
    ghostTimer = 60;
    player.stamina -= 30;
  }

  if (ghostTimer > 0) ghostTimer--;
  if (player.stamina < player.maxStamina) player.stamina += 0.01;

  if (keys["z"] && hasGun && bulletCount > 0) {
    bullets.push({ x: player.x + player.width, y: player.y + 15, width: 10, height: 5 });
    bulletCount--;
  }

  if (frame % 120 === 0) {
    coins.push({ x: canvas.width, y: groundY - 25, width: 20, height: 20 });
  }

  for (let i = 0; i < coins.length; i++) {
    coins[i].x -= worldSpeed;
    if (checkCollision(player, coins[i])) {
      sessionCoin++;
      coins.splice(i, 1);
      i--;
    }
  }

  if (frame % 150 === 0) {
    const obstacleX = canvas.width;
    const spawnType = Math.random();
    if (spawnType < 0.3) {
      obstacles.push({ x: obstacleX, y: groundY - 150, width: 30, height: 40, damage: 1, type: 'flying' });
    } else if (spawnType < 0.6) {
      obstacles.push({ x: obstacleX, y: groundY - 40, width: 60, height: 40, damage: 1 });
    } else if (score > 60000) {
    obstacles.push({ x: obstacleX, y: groundY - 40, width: 30, height: 40, damage: 1, type: 'shooter', shootCooldown: 100 + Math.floor(Math.random() * 100) });
  }
  }

  for (let i = 0; i < obstacles.length; i++) {
    let obs = obstacles[i];
    obs.x -= worldSpeed;
    if (obs.type === 'shooter' && obs.shootCooldown-- <= 0) {
      enemyProjectiles.push({ x: obs.x, y: obs.y + 5, width: 5, height: 5, speed: -6 });
      obs.shootCooldown = 200;
    }

    if (ghostTimer === 0 && checkCollision(player, obs)) {
      player.hp -= obs.damage;
      obstacles.splice(i, 1);
      i--;
      if (player.hp <= 0) checkRespawnOrGameOver();
    }
  }

  for (let i = 0; i < bullets.length; i++) {
    bullets[i].x += 10;
    for (let j = 0; j < obstacles.length; j++) {
      if (checkCollision(bullets[i], obstacles[j])) {
        bullets.splice(i, 1);
        obstacles.splice(j, 1);
        i--;
        break;
      }
    }
  }

  for (let i = 0; i < enemyProjectiles.length; i++) {
  enemyProjectiles[i].x += enemyProjectiles[i].speed; // speed negatif → ke kiri

  if (checkCollision(player, enemyProjectiles[i])) {
    player.hp--;
    enemyProjectiles.splice(i, 1);
    i--;
    if (player.hp <= 0) checkRespawnOrGameOver();
  }
}


  const checkpointScores = [5000, 10000, 20000, 45000, 60000, 80000, 100000];
  if (checkpointScores.includes(score)) {
    checkpoints.push({ x: canvas.width, y: groundY - 50, width: 30, height: 50 });
  }

  for (let i = 0; i < checkpoints.length; i++) {
    checkpoints[i].x -= worldSpeed;
    if (checkCollision(player, checkpoints[i])) {
      lastCheckpointState = JSON.parse(JSON.stringify({ player, score, coins, obstacles }));
      shopActive = true;
      shopOptions = [
        { label: "+1 HP - 3 coin", condition: () => sessionCoin >= 3, action: () => { player.hp++; sessionCoin -= 3; } },
        { label: "+20 Stamina - 3 coin", condition: () => sessionCoin >= 3, action: () => { player.stamina += 20; sessionCoin -= 3; } },
        { label: "+5 Coin - 2 coin", condition: () => sessionCoin >= 2, action: () => { sessionCoin += 5; sessionCoin -= 2; } },
        { label: "🔫 Beli Pistol (5 coin)", condition: () => !hasGun && sessionCoin >= 5, action: () => { hasGun = true; bulletCount = 1; sessionCoin -= 5; } },
        { label: "➕ Peluru (1) - 2 coin", condition: () => hasGun && sessionCoin >= 2, action: () => { if (bulletCount < maxBullet) { bulletCount++; sessionCoin -= 2; } } },
        { label: "🔧 Upgrade Peluru (max +1) - 5 coin", condition: () => hasGun && sessionCoin >= 5, action: () => { maxBullet++; sessionCoin -= 5; } },
        { label: "👻 Beli Skill Ghost - 7 coin", condition: () => !hasGhostSkill && sessionCoin >= 7, action: () => { hasGhostSkill = true; sessionCoin -= 7; } }
      ];
      checkpoints.splice(i, 1);
      i--;
    }
  }

  score++;
}

function checkCollision(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function checkRespawnOrGameOver() {
  if (respawnCount > 0 && lastCheckpointState) {
    respawnCount--;
    Object.assign(player, lastCheckpointState.player);
    score = lastCheckpointState.score;
    coins = lastCheckpointState.coins;
    obstacles = lastCheckpointState.obstacles;
  } else {
    gameOverFlag = true;
    permanentCoin += Math.floor(score / 2);
    saveUpgrades();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "green";
  ctx.fillRect(0, groundY, canvas.width, 60);

  ctx.fillStyle = ghostTimer > 0 ? "rgba(0,0,255,0.5)" : "blue";
  ctx.fillRect(player.x, player.y, player.width, player.height);

  ctx.fillStyle = "gold";
  coins.forEach(c => ctx.fillRect(c.x, c.y, c.width, c.height));

  ctx.fillStyle = "red";
  obstacles.forEach(o => ctx.fillRect(o.x, o.y, o.width, o.height));

  ctx.fillStyle = "purple";
  checkpoints.forEach(cp => ctx.fillRect(cp.x, cp.y, cp.width, cp.height));

  ctx.fillStyle = "orange";
  bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

  ctx.fillStyle = "black";
  enemyProjectiles.forEach(p => ctx.fillRect(p.x, p.y, p.width, p.height));

  ctx.fillStyle = "black";
  ctx.font = "16px sans-serif";
  ctx.fillText(`HP: ${player.hp}`, 10, 20);
  ctx.fillText(`Stamina: ${Math.floor(player.stamina)}`, 10, 40);
  ctx.fillText(`Score: ${score}`, 10, 60);
  ctx.fillText(`Koin: ${sessionCoin}`, 10, 80);
  if (hasGun) ctx.fillText(`Peluru: ${bulletCount}/${maxBullet}`, 10, 100);

  if (shopActive) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(100, 100, 600, 200);
    ctx.fillStyle = "white";
    ctx.font = "20px sans-serif";
    ctx.fillText("Checkpoint Shop", 320, 130);
    shopOptions.forEach((opt, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 150 + col * 200;
      const y = 150 + row * 70;
      ctx.fillStyle = "gray";
      ctx.fillRect(x, y, 180, 50);
      ctx.fillStyle = "white";
      ctx.fillText(opt.label, x + 10, y + 30);
    });
  }
}

function gameOver() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.font = "36px sans-serif";
  ctx.fillText("Game Over", canvas.width / 2 - 100, canvas.height / 2);
  ctx.font = "20px sans-serif";
  ctx.fillText(`Score: ${score}`, canvas.width / 2 - 40, canvas.height / 2 + 30);
}

function gameLoop() {
  if (!gameOverFlag) {
    if (!shopActive) update();
    draw();
    requestAnimationFrame(gameLoop);
  } else {
    draw();
    gameOver();
  }
}

loadUpgrades();
document.getElementById("mainMenu").style.display = "block";
gameLoop();
