// Game Configuration
const config = {
    width: 800,
    height: 600,
    backgroundColor: '#87ceeb',
    groundHeight: 100
};

// Camera
const camera = {
    x: 0
};

// Player (screen position is fixed, world position changes)
const player = {
    worldX: 100,
    screenX: 100,
    y: 0,
    width: 40,
    height: 40,
    velocityX: 0,
    velocityY: 0,
    speed: 300,
    jumpForce: 500,
    gravity: 1200,
    isOnGround: false,
    color: '#4ecdc4',
    canDoubleJump: false,
    hasUsedDoubleJump: false,
    jumpKeyHeld: false
};

// Spikes
const spikes = [];

// Blocks (2x player size obstacles)
const blocks = [];
let blockSpawnTimer = 0;
const blockSpawnInterval = 10; // 10 seconds

// Gears (sawblade obstacles)
const gears = [];
let gearSpawnTimer = 0;
const gearSpawnInterval = 4; // 4 seconds

// Monsters (rushing from right to left)
const monsters = [];
let monsterSpawnTimer = 0;
const monsterSpawnInterval = 11; // 11 seconds

// Background color change
const backgroundColors = ['#ffb6c1', '#ffffb3', '#b3ffb3', '#87ceeb']; // pink, light yellow, light green, sky blue
let backgroundTimer = 0;
const backgroundChangeInterval = 10; // 10 seconds

// Cloud text (나야,전민기)
const cloudText = {
    x: 300, // Start from middle of screen
    y: 120,
    speed: 40, // pixels per second
    text: '점프가어렵니?'
};

// Double jump portal system
let portal = null;
let isDoubleJumpMode = false;
let hasDoubleJump = false;
let doubleJumpTimer = 0;
const doubleJumpDuration = 20; // 20 seconds

// Particles for death effect
const particles = [];

// Leaderboard (top 10 from server)
let leaderboard = [];

// Supabase configuration
const SUPABASE_URL = 'https://ajpkfbyzodvjadtsgxjx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qEN5ryPr8tAglesmroaJNA_SQkMcg8c';

// Fetch leaderboard from Supabase
async function fetchLeaderboard() {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/scores?select=name,score,date,color&order=score.desc&limit=10`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        if (response.ok) {
            leaderboard = await response.json();
        }
    } catch (e) {
        console.log('Could not fetch leaderboard:', e);
    }
}

// Submit score to Supabase
async function submitScore(name, score) {
    try {
        const playerColor = playerColors[gameState.selectedColorIndex].hex;

        // First check if name exists
        const checkResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/scores?name=eq.${encodeURIComponent(name)}&select=id,score`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            }
        );

        if (checkResponse.ok) {
            const existing = await checkResponse.json();

            if (existing.length > 0) {
                // Update only if new score is higher
                if (score > existing[0].score) {
                    await fetch(
                        `${SUPABASE_URL}/rest/v1/scores?id=eq.${existing[0].id}`,
                        {
                            method: 'PATCH',
                            headers: {
                                'apikey': SUPABASE_KEY,
                                'Authorization': `Bearer ${SUPABASE_KEY}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify({ score, color: playerColor, date: new Date().toISOString() })
                        }
                    );
                }
            } else {
                // Insert new entry
                await fetch(
                    `${SUPABASE_URL}/rest/v1/scores`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify({ name, score, color: playerColor, date: new Date().toISOString() })
                    }
                );
            }
        }

        // Refresh leaderboard
        await fetchLeaderboard();
    } catch (e) {
        console.log('Could not submit score:', e);
    }
}

// Player colors
const playerColors = [
    { name: '빨강', hex: '#ff0000' },
    { name: '주황', hex: '#ff8000' },
    { name: '노랑', hex: '#ffff00' },
    { name: '초록', hex: '#00ff00' },
    { name: '청록', hex: '#00ffcc' },
    { name: '하늘', hex: '#00ccff' },
    { name: '파랑', hex: '#0066ff' },
    { name: '남색', hex: '#0000cc' },
    { name: '보라', hex: '#9900ff' },
    { name: '검정', hex: '#000000' },
    { name: '흰색', hex: '#ffffff' }
];

// Get server best score (top 1)
function getServerBestScore() {
    if (leaderboard.length > 0) {
        return { score: leaderboard[0].score, name: leaderboard[0].name };
    }
    return { score: 0, name: '---' };
}

// Check if score is in top 10
function beatsServerBest(score) {
    // If leaderboard has less than 10 entries, any score qualifies
    if (leaderboard.length < 10) {
        return true;
    }
    // Check if score is higher than the lowest score in top 10
    const lowestScore = leaderboard[leaderboard.length - 1].score;
    return score > lowestScore;
}

// Game State
const gameState = {
    isRunning: false,
    isGameOver: false,
    isPaused: false,
    isEnteringName: false,
    isSelectingColor: true,
    selectedColorIndex: 0,
    lastTime: 0,
    score: 0,
    newName: '',
    isHardMode: false,
    isHellMode: false,
    isGodMode: false
};

// Hell mode timer
let hellModeTimer = 0;
const hellModeInterval = 5; // 5 seconds

// God mode timer
let godModeTimer = 0;
const godModeInterval = 10; // 10 seconds
let godModeMonsterTimer = 0;
const godModeMonsterInterval = 20; // 20 seconds

// Canvas Setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

canvas.width = config.width;
canvas.height = config.height;

// Ground Y position
const groundY = config.height - config.groundHeight;

// Spawn spikes at the right edge of the screen (1 to 3 randomly, or 4-5 in double jump mode)
function spawnSpikes() {
    const spikeWidth = 40;
    const spikeHeight = 40;
    let count;

    if (isDoubleJumpMode) {
        // 6-8 spikes in double jump mode
        count = Math.floor(Math.random() * 3) + 6;
    } else if (gameState.isHardMode) {
        // 2-4.5 spikes in hard mode (2, 3, 4, or 5)
        count = Math.floor(Math.random() * 4) + 2;
    } else {
        // 1-4 spikes in normal mode
        count = Math.floor(Math.random() * 4) + 1;
    }

    let currentX = camera.x + config.width;

    for (let i = 0; i < count; i++) {
        const spike = {
            worldX: currentX,
            y: groundY - spikeHeight,
            width: spikeWidth,
            height: spikeHeight,
            color: '#000000'
        };
        spikes.push(spike);
        currentX += spikeWidth;
    }
}

// Spawn block at the right edge of the screen (40x80)
function spawnBlock() {
    const blockWidth = 40;
    const blockHeight = 80;
    const block = {
        worldX: camera.x + config.width,
        y: groundY - blockHeight,
        width: blockWidth,
        height: blockHeight,
        color: '#8b5cf6'
    };
    blocks.push(block);
}

// Spawn gear (sawblade) at the right edge of the screen
function spawnGear() {
    const gearRadius = 25;
    const gear = {
        worldX: camera.x + config.width + gearRadius,
        y: groundY - gearRadius,
        radius: gearRadius,
        teeth: 8,
        rotation: 0,
        color: '#f97316'
    };
    gears.push(gear);
}

// Spawn monster at the right edge of the screen
function spawnMonster() {
    const monsterSize = 55;
    // Set monster speed based on mode
    let monsterSpeed = 300;
    if (gameState.isGodMode) {
        monsterSpeed = 600;
    } else if (gameState.isHellMode) {
        monsterSpeed = 500;
    } else if (gameState.isHardMode) {
        monsterSpeed = 400;
    }
    const monster = {
        worldX: camera.x + config.width,
        y: groundY - monsterSize,
        width: monsterSize,
        height: monsterSize,
        speed: monsterSpeed,
        color: '#8b0000',
        mouthOpen: 0,
        mouthDirection: 1
    };
    monsters.push(monster);
}

// Draw cloud text
function drawCloudText(x, y, text) {
    ctx.save();

    // Draw cloud shape behind text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

    // Measure text width for cloud size
    ctx.font = 'bold 24px Arial';
    const textWidth = ctx.measureText(text).width;
    const cloudWidth = textWidth + 60;
    const cloudHeight = 60;

    // Draw fluffy cloud using circles
    const centerX = x + cloudWidth / 2;
    const centerY = y + cloudHeight / 2;

    // Main cloud body - bigger circles
    ctx.beginPath();
    ctx.arc(centerX - 40, centerY, 30, 0, Math.PI * 2);
    ctx.arc(centerX, centerY - 12, 35, 0, Math.PI * 2);
    ctx.arc(centerX + 40, centerY, 30, 0, Math.PI * 2);
    ctx.arc(centerX - 20, centerY + 12, 28, 0, Math.PI * 2);
    ctx.arc(centerX + 20, centerY + 12, 28, 0, Math.PI * 2);
    ctx.fill();

    // Draw text on cloud
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, centerX, centerY);

    ctx.restore();
}

// Spawn portal at the right edge of the screen
function spawnPortal(type) {
    const portalWidth = 50;
    const portalHeight = 70;
    portal = {
        worldX: camera.x + config.width,
        y: groundY - portalHeight,
        width: portalWidth,
        height: portalHeight,
        type: type, // 'doubleJump' or 'normal'
        color: type === 'doubleJump' ? '#9933ff' : '#33cc33',
        rotation: 0
    };
}

// Check collision between player and portal
function checkPortalCollision(playerScreenX) {
    if (!portal) return false;
    const portalScreenX = portal.worldX - camera.x;

    return playerScreenX < portalScreenX + portal.width &&
           playerScreenX + player.width > portalScreenX &&
           player.y < portal.y + portal.height &&
           player.y + player.height > portal.y;
}

// Check collision between player rectangle and monster rectangle
function checkMonsterCollision(playerScreenX, monster) {
    const monsterScreenX = monster.worldX - camera.x;

    return playerScreenX < monsterScreenX + monster.width &&
           playerScreenX + player.width > monsterScreenX &&
           player.y < monster.y + monster.height &&
           player.y + player.height > monster.y;
}

// Check collision between player rectangle and gear (using circle collision)
function checkGearCollision(playerScreenX, gear) {
    const gearScreenX = gear.worldX - camera.x;

    // Find closest point on rectangle to gear center
    const closestX = Math.max(playerScreenX, Math.min(gearScreenX, playerScreenX + player.width));
    const closestY = Math.max(player.y, Math.min(gear.y, player.y + player.height));

    // Calculate distance from closest point to gear center
    const distX = gearScreenX - closestX;
    const distY = gear.y - closestY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    return distance < gear.radius;
}

// Check if spike is within 75 pixels of gear
function checkSpikeGearCollision(spike, gear) {
    const spikeScreenX = spike.worldX - camera.x;
    const gearScreenX = gear.worldX - camera.x;

    // Use spike center for collision
    const spikeCenterX = spikeScreenX + spike.width / 2;
    const spikeCenterY = spike.y + spike.height / 2;

    const distX = gearScreenX - spikeCenterX;
    const distY = gear.y - spikeCenterY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    return distance < 150; // 150 pixels range
}

// Check if spike is within 75 pixels of block
function checkSpikeBlockCollision(spike, block) {
    const spikeScreenX = spike.worldX - camera.x;
    const blockScreenX = block.worldX - camera.x;

    // Use spike center for collision
    const spikeCenterX = spikeScreenX + spike.width / 2;
    const spikeCenterY = spike.y + spike.height / 2;

    // Use block center for collision
    const blockCenterX = blockScreenX + block.width / 2;
    const blockCenterY = block.y + block.height / 2;

    const distX = blockCenterX - spikeCenterX;
    const distY = blockCenterY - spikeCenterY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    return distance < 75; // 75 pixels range
}

// Check collision between player and block - returns 'side' for death, 'top' for landing, or false
function checkBlockCollision(playerScreenX, block) {
    const blockScreenX = block.worldX - camera.x;

    // Check if there's any overlap
    const isOverlapping = playerScreenX < blockScreenX + block.width &&
                          playerScreenX + player.width > blockScreenX &&
                          player.y < block.y + block.height &&
                          player.y + player.height > block.y;

    if (!isOverlapping) return false;

    // Check if player is landing on top of block (falling down and feet near block top)
    const playerBottom = player.y + player.height;
    const wasAboveBlock = playerBottom - player.velocityY * 0.02 <= block.y;

    if (player.velocityY >= 0 && wasAboveBlock) {
        return 'top';
    }

    return 'side';
}

// Check if point is inside triangle
function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
    const area = 0.5 * (-y2 * x3 + y1 * (-x2 + x3) + x1 * (y2 - y3) + x2 * y3);
    const s = 1 / (2 * area) * (y1 * x3 - x1 * y3 + (y3 - y1) * px + (x1 - x3) * py);
    const t = 1 / (2 * area) * (x1 * y2 - y1 * x2 + (y1 - y2) * px + (x2 - x1) * py);
    return s > 0 && t > 0 && 1 - s - t > 0;
}

// Check collision between player rectangle and spike triangle
function checkCollision(playerScreenX, spike) {
    const spikeScreenX = spike.worldX - camera.x;

    // Triangle points
    const tx1 = spikeScreenX + spike.width / 2; // top
    const ty1 = spike.y;
    const tx2 = spikeScreenX + spike.width; // bottom right
    const ty2 = spike.y + spike.height;
    const tx3 = spikeScreenX; // bottom left
    const ty3 = spike.y + spike.height;

    // Check if any corner of the player is inside the triangle
    const corners = [
        [playerScreenX, player.y],
        [playerScreenX + player.width, player.y],
        [playerScreenX, player.y + player.height],
        [playerScreenX + player.width, player.y + player.height]
    ];

    for (const [px, py] of corners) {
        if (pointInTriangle(px, py, tx1, ty1, tx2, ty2, tx3, ty3)) {
            return true;
        }
    }

    // Check if player bottom edge intersects with triangle
    if (player.y + player.height >= spike.y + spike.height) {
        // Player is at or below spike base
        if (playerScreenX + player.width > spikeScreenX && playerScreenX < spikeScreenX + spike.width) {
            if (player.y < spike.y + spike.height) {
                // Check intersection with triangle slopes
                const playerBottom = player.y + player.height;
                const playerRight = playerScreenX + player.width;

                // Left slope intersection
                if (playerRight > spikeScreenX && playerRight < tx1) {
                    const slopeY = ty3 - (playerRight - spikeScreenX) * (spike.height / (spike.width / 2));
                    if (playerBottom > slopeY) return true;
                }
                // Right slope intersection
                if (playerScreenX < spikeScreenX + spike.width && playerScreenX > tx1) {
                    const slopeY = ty2 - (spikeScreenX + spike.width - playerScreenX) * (spike.height / (spike.width / 2));
                    if (playerBottom > slopeY) return true;
                }
            }
        }
    }

    return false;
}

// Draw a gear (sawblade) shape
function drawGear(x, y, radius, teeth, rotation, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    const innerRadius = radius * 0.6;

    ctx.fillStyle = color;
    ctx.beginPath();

    for (let i = 0; i < teeth; i++) {
        const angle1 = (i / teeth) * Math.PI * 2;
        const angle2 = ((i + 0.3) / teeth) * Math.PI * 2;
        const angle3 = ((i + 0.5) / teeth) * Math.PI * 2;
        const angle4 = ((i + 0.7) / teeth) * Math.PI * 2;

        if (i === 0) {
            ctx.moveTo(Math.cos(angle1) * innerRadius, Math.sin(angle1) * innerRadius);
        }

        // Tooth outer edge
        ctx.lineTo(Math.cos(angle2) * radius, Math.sin(angle2) * radius);
        ctx.lineTo(Math.cos(angle3) * radius, Math.sin(angle3) * radius);
        // Back to inner
        ctx.lineTo(Math.cos(angle4) * innerRadius, Math.sin(angle4) * innerRadius);

        // Next tooth start
        const nextAngle = ((i + 1) / teeth) * Math.PI * 2;
        ctx.lineTo(Math.cos(nextAngle) * innerRadius, Math.sin(nextAngle) * innerRadius);
    }

    ctx.closePath();
    ctx.fill();

    // Draw center circle
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Helper to adjust color brightness
function adjustColor(hex, percent) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
    return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Create particles when player dies - Firework style with ~1024 squares
function createDeathParticles(screenX, y) {
    const centerX = screenX + player.width / 2;
    const centerY = y + player.height / 2;

    // Color variations based on player color
    const colors = [
        player.color,
        adjustColor(player.color, 40),
        adjustColor(player.color, -40),
        adjustColor(player.color, 80),
        adjustColor(player.color, -80),
        '#ffffff'
    ];

    // Main firework explosion - 1024 particles
    for (let i = 0; i < 1024; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 600;
        const size = 2 + Math.random() * 6;

        particles.push({
            x: centerX,
            y: centerY,
            size: size,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed - Math.random() * 200,
            gravity: 300 + Math.random() * 400,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 0.8 + Math.random() * 0.2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 15,
            type: 'firework'
        });
    }
}

// Update particles
function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.velocityY += p.gravity * deltaTime;
        p.x += p.velocityX * deltaTime;
        p.y += p.velocityY * deltaTime;

        // Firework style fade
        if (p.type === 'firework') {
            p.alpha -= deltaTime * 0.4;
            // Add slight twinkle effect
            if (Math.random() < 0.02) {
                p.alpha = Math.min(1, p.alpha + 0.3);
            }
        } else {
            p.alpha -= deltaTime * 0.5;
        }

        // Update rotation for squares
        if (p.rotation !== undefined) {
            p.rotation += p.rotationSpeed * deltaTime;
        }

        // Air resistance
        p.velocityX *= 0.99;
        p.velocityY *= 0.99;

        if (p.alpha <= 0 || p.size <= 0.5) {
            particles.splice(i, 1);
        }
    }
}

// Render particles
function renderParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        // Draw rotating squares (firework style)
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.rotation !== undefined) {
            ctx.rotate(p.rotation);
        }
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

// Render color selection screen
function renderColorSelect() {
    // Clear canvas
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, config.width, config.height);

    // Draw cloud text
    drawCloudText(cloudText.x, cloudText.y, cloudText.text);

    // Determine text color based on background
    const selectTextColor = config.backgroundColor === '#ffffb3' ? '#000000' : '#ffffff';
    const selectHighlightColor = config.backgroundColor === '#ffffb3' ? '#000000' : '#ffffff';

    // Draw title
    ctx.fillStyle = selectTextColor;
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('색상 선택', config.width / 2, 80);

    // Draw instructions
    ctx.font = '18px Arial';
    ctx.fillText('← → 로 선택, SPACE 또는 ENTER로 시작', config.width / 2, 120);

    // Draw color options in a grid
    const cols = 6;
    const boxSize = 60;
    const gap = 20;
    const startX = (config.width - (cols * boxSize + (cols - 1) * gap)) / 2;
    const startY = 180;

    for (let i = 0; i < playerColors.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (boxSize + gap);
        const y = startY + row * (boxSize + gap + 30);

        // Draw selection highlight
        if (i === gameState.selectedColorIndex) {
            ctx.strokeStyle = selectHighlightColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(x - 5, y - 5, boxSize + 10, boxSize + 10);
        }

        // Draw color box
        ctx.fillStyle = playerColors[i].hex;
        ctx.fillRect(x, y, boxSize, boxSize);

        // Draw border for visibility (especially for dark colors)
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, boxSize, boxSize);

        // Draw color name
        ctx.fillStyle = selectTextColor;
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(playerColors[i].name, x + boxSize / 2, y + boxSize + 20);
    }

    // Draw preview player
    ctx.fillStyle = selectTextColor;
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('미리보기', config.width / 2 - 150, 420);

    // Draw preview ground
    ctx.fillStyle = '#3d3d5c';
    ctx.fillRect(config.width / 2 - 250, 500, 200, 50);

    // Draw preview player
    ctx.fillStyle = playerColors[gameState.selectedColorIndex].hex;
    ctx.fillRect(config.width / 2 - 170, 460, 40, 40);

    // Draw leaderboard on the right side
    if (leaderboard.length > 0) {
        const leaderboardX = config.width - 150;
        const leaderboardY = 320;

        ctx.fillStyle = selectTextColor;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('TOP 10', leaderboardX, leaderboardY);

        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        for (let i = 0; i < leaderboard.length; i++) {
            const entry = leaderboard[i];
            const y = leaderboardY + 25 + i * 22;

            // Draw color box if color exists
            if (entry.color) {
                ctx.fillStyle = entry.color;
                ctx.fillRect(leaderboardX - 75, y - 10, 12, 12);
                ctx.strokeStyle = '#666666';
                ctx.lineWidth = 1;
                ctx.strokeRect(leaderboardX - 75, y - 10, 12, 12);
            }

            ctx.fillStyle = selectTextColor;
            ctx.fillText(`${i + 1}. ${entry.name}`, leaderboardX - 60, y);
            ctx.textAlign = 'right';
            ctx.fillText(`${entry.score}`, leaderboardX + 60, y);
            ctx.textAlign = 'left';
        }
    }
}

// Color selection loop
let colorSelectLastTime = performance.now();
function colorSelectLoop(currentTime) {
    if (!gameState.isSelectingColor) return;

    if (!currentTime) currentTime = performance.now();
    const deltaTime = (currentTime - colorSelectLastTime) / 1000;
    colorSelectLastTime = currentTime;

    // Update cloud position
    cloudText.x -= cloudText.speed * deltaTime;
    if (cloudText.x < -200) {
        cloudText.x = config.width + 50;
    }

    renderColorSelect();
    requestAnimationFrame(colorSelectLoop);
}

// Initialize Game
function init() {
    player.worldX = 100;
    player.y = groundY - player.height;
    player.velocityX = 0;
    player.velocityY = 0;
    player.isOnGround = true;
    player.canDoubleJump = false;
    player.hasUsedDoubleJump = false;
    player.jumpKeyHeld = false;
    camera.x = 0;
    gameState.isRunning = true;
    gameState.isGameOver = false;
    gameState.isPaused = false;
    gameState.isEnteringName = false;
    gameState.lastTime = performance.now();
    gameState.score = 0;
    gameState.isHardMode = false;
    gameState.isHellMode = false;
    gameState.isGodMode = false;
    hellModeTimer = 0;
    godModeTimer = 0;
    godModeMonsterTimer = 0;
    player.speed = 300; // Reset speed

    // Reset double jump mode
    isDoubleJumpMode = false;
    hasDoubleJump = false;
    doubleJumpTimer = 0;
    portal = null;

    // Hide name input if visible
    hideNameInput();

    // Clear particles, spikes, blocks, gears, and monsters
    particles.length = 0;
    spikes.length = 0;
    blocks.length = 0;
    gears.length = 0;
    monsters.length = 0;
    blockSpawnTimer = 0;
    gearSpawnTimer = 0;
    monsterSpawnTimer = 0;
    backgroundTimer = 0;
    spawnSpikes();

    requestAnimationFrame(gameLoop);
}

// Game Loop
function gameLoop(currentTime) {
    if (!gameState.isRunning) return;

    if (gameState.isPaused) {
        renderPause();
        requestAnimationFrame(gameLoop);
        return;
    }

    const deltaTime = (currentTime - gameState.lastTime) / 1000;
    gameState.lastTime = currentTime;

    update(deltaTime);
    render();

    requestAnimationFrame(gameLoop);
}

// Render pause screen
function renderPause() {
    render();

    // Draw pause overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, config.width, config.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', config.width / 2, config.height / 2);
    ctx.font = '24px Arial';
    ctx.fillText('Press P to resume', config.width / 2, config.height / 2 + 40);
}

// Game Over Loop (for particle animation)
function gameOverLoop(currentTime) {
    if (!gameState.isGameOver) return;

    if (!currentTime) {
        gameState.lastTime = performance.now();
        requestAnimationFrame(gameOverLoop);
        return;
    }

    const deltaTime = Math.min((currentTime - gameState.lastTime) / 1000, 0.1);
    gameState.lastTime = currentTime;

    updateParticles(deltaTime);
    renderGameOver();

    requestAnimationFrame(gameOverLoop);
}

// Render game over state
function renderGameOver() {
    // Clear canvas
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, config.width, config.height);

    // Draw cloud text
    drawCloudText(cloudText.x, cloudText.y, cloudText.text);

    // Draw ground
    ctx.fillStyle = '#3d3d5c';
    ctx.fillRect(0, groundY, config.width, config.groundHeight);

    // Draw score and high score (from server)
    const scoreTextColor = config.backgroundColor === '#ffffb3' ? '#000000' : '#ffffff';
    const serverBest = getServerBestScore();
    ctx.fillStyle = scoreTextColor;
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + gameState.score, 20, 40);
    ctx.fillText('Best: ' + serverBest.score + ' (' + serverBest.name + ')', 20, 70);

    // Draw spikes
    for (const spike of spikes) {
        const screenX = spike.worldX - camera.x;
        ctx.fillStyle = spike.color;
        ctx.beginPath();
        ctx.moveTo(screenX + spike.width / 2, spike.y);
        ctx.lineTo(screenX + spike.width, spike.y + spike.height);
        ctx.lineTo(screenX, spike.y + spike.height);
        ctx.closePath();
        ctx.fill();
    }

    // Draw blocks
    for (const block of blocks) {
        const screenX = block.worldX - camera.x;
        ctx.fillStyle = block.color;
        ctx.fillRect(screenX, block.y, block.width, block.height);
    }

    // Draw gears (sawblades)
    for (const gear of gears) {
        const screenX = gear.worldX - camera.x;
        drawGear(screenX, gear.y, gear.radius, gear.teeth, gear.rotation, gear.color);
    }

    // Draw monsters (side view - pentagon shape, upper jaw moves)
    for (const monster of monsters) {
        const screenX = monster.worldX - camera.x;
        const mouthGap = monster.mouthOpen * 10;
        const upperJawMove = monster.mouthOpen * 5;

        // Draw upper jaw (black) - pentagon shape, moves up when opening
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(screenX + monster.width, monster.y - upperJawMove);
        ctx.lineTo(screenX + monster.width, monster.y + 10 - upperJawMove);
        ctx.lineTo(screenX + monster.width - 10, monster.y + monster.height / 2 - mouthGap / 2);
        ctx.lineTo(screenX, monster.y + monster.height / 2 - mouthGap / 2);
        ctx.lineTo(screenX + monster.width - 15, monster.y - upperJawMove);
        ctx.closePath();
        ctx.fill();

        // Draw lower jaw (black) - pentagon shape, stays in place
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(screenX + monster.width, monster.y + monster.height);
        ctx.lineTo(screenX + monster.width, monster.y + monster.height - 10);
        ctx.lineTo(screenX + monster.width - 10, monster.y + monster.height / 2 + mouthGap / 2);
        ctx.lineTo(screenX, monster.y + monster.height / 2 + mouthGap / 2);
        ctx.lineTo(screenX + monster.width - 15, monster.y + monster.height);
        ctx.closePath();
        ctx.fill();

        // Draw teeth on upper jaw (white, pointing down)
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 4; i++) {
            const toothX = screenX + 8 + i * 11;
            const toothY = monster.y + monster.height / 2 - mouthGap / 2;
            ctx.beginPath();
            ctx.moveTo(toothX, toothY);
            ctx.lineTo(toothX + 5, toothY);
            ctx.lineTo(toothX + 2.5, toothY + 7);
            ctx.closePath();
            ctx.fill();
        }

        // Draw teeth on lower jaw (white, pointing up)
        for (let i = 0; i < 4; i++) {
            const toothX = screenX + 8 + i * 11;
            const toothY = monster.y + monster.height / 2 + mouthGap / 2;
            ctx.beginPath();
            ctx.moveTo(toothX, toothY);
            ctx.lineTo(toothX + 5, toothY);
            ctx.lineTo(toothX + 2.5, toothY - 7);
            ctx.closePath();
            ctx.fill();
        }

        // Draw eye (white) - on upper jaw, moves with jaw
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(screenX + monster.width - 12, monster.y + 12 - upperJawMove, 7, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw portal in game over state
    if (portal) {
        const portalScreenX = portal.worldX - camera.x;
        ctx.save();
        ctx.translate(portalScreenX + portal.width / 2, portal.y + portal.height / 2);

        // Draw portal glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, portal.width);
        gradient.addColorStop(0, portal.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, portal.width, 0, Math.PI * 2);
        ctx.fill();

        // Draw portal ring
        ctx.strokeStyle = portal.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, portal.width / 2, portal.height / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    // Draw particles
    renderParticles();

    // Determine text color based on background
    const textColor = config.backgroundColor === '#ffffb3' ? '#000000' : '#ffffff';

    // Draw game over text
    ctx.fillStyle = textColor;
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', config.width / 2, config.height / 2 - 40);

    if (gameState.isEnteringName) {
        // New high score - entering name
        ctx.font = '24px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText('NEW HIGH SCORE!', config.width / 2, config.height / 2);
        ctx.fillStyle = textColor;
        ctx.fillText('Enter your name:', config.width / 2, config.height / 2 + 35);

        ctx.font = '18px Arial';
        ctx.fillText('Press ENTER to confirm', config.width / 2, config.height / 2 + 120);
    } else {
        ctx.font = '24px Arial';
        ctx.fillText('Press R to restart', config.width / 2, config.height / 2 + 10);
    }

    // Draw leaderboard on the right side
    if (leaderboard.length > 0) {
        const leaderboardX = config.width - 180;
        const leaderboardY = 100;

        ctx.fillStyle = textColor;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('TOP 10', leaderboardX, leaderboardY);

        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        for (let i = 0; i < leaderboard.length; i++) {
            const entry = leaderboard[i];
            const y = leaderboardY + 30 + i * 25;
            ctx.fillStyle = textColor;
            ctx.fillText(`${i + 1}. ${entry.name}`, leaderboardX - 60, y);
            ctx.textAlign = 'right';
            ctx.fillText(`${entry.score}`, leaderboardX + 60, y);
            ctx.textAlign = 'left';
        }
    }
}

// Update Game Logic
function update(deltaTime) {
    // Auto move forward
    player.worldX += player.speed * deltaTime;

    // Jump (Space bar)
    if (keys['Space'] && player.isOnGround && !player.jumpKeyHeld) {
        player.velocityY = -player.jumpForce;
        player.isOnGround = false;
        player.hasUsedDoubleJump = false;
        player.jumpKeyHeld = true;
    } else if (keys['Space'] && !player.isOnGround && player.canDoubleJump && !player.hasUsedDoubleJump && !player.jumpKeyHeld) {
        // Double jump in air (only once, requires releasing and pressing space again)
        player.velocityY = -player.jumpForce;
        player.hasUsedDoubleJump = true;
        player.jumpKeyHeld = true;
    }

    // Track when space key is released
    if (!keys['Space']) {
        player.jumpKeyHeld = false;
    }

    // Apply gravity
    if (!player.isOnGround) {
        player.velocityY += player.gravity * deltaTime;
    }

    // Update vertical position
    player.y += player.velocityY * deltaTime;

    // Update camera to follow player
    camera.x = player.worldX - player.screenX;

    // Calculate player's screen X position
    let playerDrawX = player.worldX - camera.x;

    // Check if player is standing on a block
    let onBlock = false;
    for (const block of blocks) {
        const blockScreenX = block.worldX - camera.x;
        const playerBottom = player.y + player.height;

        // Check if player is on top of this block
        if (playerBottom === block.y &&
            playerDrawX + player.width > blockScreenX &&
            playerDrawX < blockScreenX + block.width) {
            onBlock = true;
            break;
        }
    }

    // Ground collision
    if (player.y >= groundY - player.height) {
        player.y = groundY - player.height;
        player.velocityY = 0;
        player.isOnGround = true;
    } else if (!onBlock && player.isOnGround && player.y < groundY - player.height) {
        // Player walked off a block - start falling
        player.isOnGround = false;
    }

    // Check spike collision
    for (const spike of spikes) {
        if (checkCollision(playerDrawX, spike)) {
            createDeathParticles(playerDrawX, player.y);
            gameState.isGameOver = true;
            gameState.isRunning = false;
            // Check if new high score
            // Check if beats server best score
            if (beatsServerBest(gameState.score)) {
                gameState.isEnteringName = true;
                gameState.newName = '';
                showNameInput();
            }
            gameOverLoop();
            return;
        }
    }

    // Block spawn timer (not in double jump mode or hard mode)
    if (!isDoubleJumpMode && !gameState.isHardMode) {
        blockSpawnTimer += deltaTime;
        if (blockSpawnTimer >= blockSpawnInterval) {
            spawnBlock();
            blockSpawnTimer = 0;
        }
    }

    // Check block collision
    for (const block of blocks) {
        const collision = checkBlockCollision(playerDrawX, block);
        if (collision === 'top') {
            // Land on top of block
            player.y = block.y - player.height;
            player.velocityY = 0;
            player.isOnGround = true;
        } else if (collision === 'side') {
            // Hit side of block - die
            createDeathParticles(playerDrawX, player.y);
            gameState.isGameOver = true;
            gameState.isRunning = false;
            // Check if new high score
            // Check if beats server best score
            if (beatsServerBest(gameState.score)) {
                gameState.isEnteringName = true;
                gameState.newName = '';
                showNameInput();
            }
            gameOverLoop();
            return;
        }
    }

    // Check block collision with spikes - remove block if within 75 pixels of spike
    for (let i = blocks.length - 1; i >= 0; i--) {
        for (const spike of spikes) {
            if (checkSpikeBlockCollision(spike, blocks[i])) {
                blocks.splice(i, 1);
                break;
            }
        }
    }

    // Remove blocks that are off screen to the left
    for (let i = blocks.length - 1; i >= 0; i--) {
        const blockScreenX = blocks[i].worldX - camera.x;
        if (blockScreenX + blocks[i].width < 0) {
            blocks.splice(i, 1);
        }
    }

    // Gear spawn timer (not in double jump mode or hard mode)
    if (!isDoubleJumpMode && !gameState.isHardMode) {
        gearSpawnTimer += deltaTime;
        if (gearSpawnTimer >= gearSpawnInterval) {
            spawnGear();
            gearSpawnTimer = 0;
        }
    }

    // Update gear rotation (counter-clockwise)
    for (const gear of gears) {
        gear.rotation -= deltaTime * 5;
    }

    // Check gear collision with player
    for (const gear of gears) {
        if (checkGearCollision(playerDrawX, gear)) {
            createDeathParticles(playerDrawX, player.y);
            gameState.isGameOver = true;
            gameState.isRunning = false;
            // Check if new high score
            // Check if beats server best score
            if (beatsServerBest(gameState.score)) {
                gameState.isEnteringName = true;
                gameState.newName = '';
                showNameInput();
            }
            gameOverLoop();
            return;
        }
    }

    // Check gear collision with spikes - remove gear if touching spike
    for (let i = gears.length - 1; i >= 0; i--) {
        let gearRemoved = false;
        for (const spike of spikes) {
            if (checkSpikeGearCollision(spike, gears[i])) {
                gears.splice(i, 1);
                gearRemoved = true;
                break;
            }
        }
        if (gearRemoved) continue;

        // Check gear collision with monsters - remove gear if touching monster
        for (const monster of monsters) {
            const gearScreenX = gears[i].worldX - camera.x;
            const monsterScreenX = monster.worldX - camera.x;
            const distX = gearScreenX - (monsterScreenX + monster.width / 2);
            const distY = gears[i].y - (monster.y + monster.height / 2);
            const distance = Math.sqrt(distX * distX + distY * distY);
            if (distance < gears[i].radius + monster.width / 2) {
                gears.splice(i, 1);
                break;
            }
        }
    }

    // Remove gears that are off screen to the left and give score
    for (let i = gears.length - 1; i >= 0; i--) {
        const gearScreenX = gears[i].worldX - camera.x;
        if (gearScreenX + gears[i].radius < 0) {
            gears.splice(i, 1);
            gameState.score += 1;
        }
    }

    // Check if all spikes are off screen to the left
    if (spikes.length > 0) {
        const allSpikesOffScreen = spikes.every(spike => {
            const spikeScreenX = spike.worldX - camera.x;
            return spikeScreenX + spike.width < 0;
        });

        if (allSpikesOffScreen) {
            gameState.score += spikes.length;
            spikes.length = 0;
            spawnSpikes();
        }
    }

    // Monster spawn timer (not in double jump mode)
    if (!isDoubleJumpMode) {
        monsterSpawnTimer += deltaTime;
        // Hard mode: spawn every 3 seconds, normal: every 11 seconds
        const currentMonsterInterval = gameState.isHardMode ? 3 : monsterSpawnInterval;
        if (monsterSpawnTimer >= currentMonsterInterval) {
            spawnMonster();
            monsterSpawnTimer = 0;
        }
    }

    // Update monster positions (move left) and mouth animation
    for (const monster of monsters) {
        monster.worldX -= monster.speed * deltaTime;

        // Animate mouth opening/closing
        monster.mouthOpen += monster.mouthDirection * deltaTime * 8;
        if (monster.mouthOpen >= 1) {
            monster.mouthOpen = 1;
            monster.mouthDirection = -1;
        } else if (monster.mouthOpen <= 0) {
            monster.mouthOpen = 0;
            monster.mouthDirection = 1;
        }
    }

    // Check monster collision with player
    for (const monster of monsters) {
        if (checkMonsterCollision(playerDrawX, monster)) {
            createDeathParticles(playerDrawX, player.y);
            gameState.isGameOver = true;
            gameState.isRunning = false;
            // Check if new high score
            // Check if beats server best score
            if (beatsServerBest(gameState.score)) {
                gameState.isEnteringName = true;
                gameState.newName = '';
                showNameInput();
            }
            gameOverLoop();
            return;
        }
    }

    // Remove monsters that are off screen to the left and give score
    for (let i = monsters.length - 1; i >= 0; i--) {
        const monsterScreenX = monsters[i].worldX - camera.x;
        if (monsterScreenX + monsters[i].width < 0) {
            monsters.splice(i, 1);
            gameState.score += 3;
        }
    }

    // Background color change timer
    backgroundTimer += deltaTime;
    if (backgroundTimer >= backgroundChangeInterval) {
        const randomIndex = Math.floor(Math.random() * backgroundColors.length);
        config.backgroundColor = backgroundColors[randomIndex];
        backgroundTimer = 0;
    }

    // Update cloud text position (move left)
    cloudText.x -= cloudText.speed * deltaTime;
    // Reset cloud position when it goes off screen to the left
    if (cloudText.x < -200) {
        cloudText.x = config.width + 50;
    }

    // Hard mode activation at 100 points
    if (gameState.score >= 100 && !gameState.isHardMode) {
        gameState.isHardMode = true;
        player.speed = 300 * 1.2; // 1.2x speed
    }

    // Hell mode activation at 150 points
    if (gameState.score >= 150 && !gameState.isHellMode) {
        gameState.isHellMode = true;
        // Keep speed at 1x (300)
    }

    // God mode activation at 200 points
    if (gameState.score >= 200 && !gameState.isGodMode) {
        gameState.isGodMode = true;
        player.speed = 300 * 1.7; // 1.7x speed
    }

    // Hell mode: spawn 3 spikes + block + monster every 5 seconds (only when not in god mode)
    if (gameState.isHellMode && !gameState.isGodMode && !isDoubleJumpMode) {
        hellModeTimer += deltaTime;
        if (hellModeTimer >= hellModeInterval) {
            // Spawn 3 spikes
            const spikeWidth = 40;
            const spikeHeight = 40;
            let currentX = camera.x + config.width;
            for (let i = 0; i < 3; i++) {
                spikes.push({
                    worldX: currentX,
                    y: groundY - spikeHeight,
                    width: spikeWidth,
                    height: spikeHeight,
                    color: '#000000'
                });
                currentX += spikeWidth;
            }
            // Spawn block right after spikes
            blocks.push({
                worldX: currentX,
                y: groundY - 80,
                width: 40,
                height: 80,
                color: '#8b5cf6'
            });
            // Spawn monster
            spawnMonster();
            hellModeTimer = 0;
        }
    }

    // God mode: spawn 6 spikes + block every 10 seconds, monster every 20 seconds
    if (gameState.isGodMode && !isDoubleJumpMode) {
        godModeTimer += deltaTime;
        godModeMonsterTimer += deltaTime;

        if (godModeTimer >= godModeInterval) {
            // Spawn 6 spikes
            const spikeWidth = 40;
            const spikeHeight = 40;
            let currentX = camera.x + config.width;
            for (let i = 0; i < 6; i++) {
                spikes.push({
                    worldX: currentX,
                    y: groundY - spikeHeight,
                    width: spikeWidth,
                    height: spikeHeight,
                    color: '#000000'
                });
                currentX += spikeWidth;
            }
            // Spawn block right after spikes
            blocks.push({
                worldX: currentX,
                y: groundY - 80,
                width: 40,
                height: 80,
                color: '#8b5cf6'
            });
            godModeTimer = 0;
        }

        if (godModeMonsterTimer >= godModeMonsterInterval) {
            spawnMonster();
            godModeMonsterTimer = 0;
        }
    }

    // Double jump portal system
    // Check portal collision
    if (portal && checkPortalCollision(playerDrawX)) {
        if (portal.type === 'doubleJump') {
            // Enter double jump mode
            isDoubleJumpMode = true;
            player.canDoubleJump = true;
            doubleJumpTimer = 0;
            portal = null;
        } else if (portal.type === 'normal') {
            // Return to normal mode
            isDoubleJumpMode = false;
            player.canDoubleJump = false;
            player.hasUsedDoubleJump = false;
            portal = null;
            // Reset spikes to normal mode (1-3 spikes)
            spikes.length = 0;
            spawnSpikes();
        }
    }

    // Update portal position (move with world)
    if (portal) {
        const portalScreenX = portal.worldX - camera.x;
        // Remove portal if off screen to the left
        if (portalScreenX + portal.width < 0) {
            // If normal portal goes off screen without being entered, kill player
            if (portal.type === 'normal') {
                createDeathParticles(playerDrawX, player.y);
                gameState.isGameOver = true;
                gameState.isRunning = false;
                if (beatsServerBest(gameState.score)) {
                    gameState.isEnteringName = true;
                    gameState.newName = '';
                    showNameInput();
                }
                gameOverLoop();
                return;
            }
            // Double jump portal missed - just remove it, game continues
            portal = null;
        } else {
            // Rotate portal for visual effect
            portal.rotation += deltaTime * 2;
        }
    }

    // Ensure spikes exist (fix for stuck game)
    if (spikes.length === 0) {
        spawnSpikes();
    }

    // Double jump mode timer - spawn normal portal after 20 seconds
    if (isDoubleJumpMode) {
        doubleJumpTimer += deltaTime;
        if (doubleJumpTimer >= doubleJumpDuration && !portal) {
            spawnPortal('normal');
            // Check if normal portal overlaps with spikes and move it right
            if (portal && portal.type === 'normal') {
                let needsMove = true;
                while (needsMove) {
                    needsMove = false;
                    for (const spike of spikes) {
                        // Check if portal overlaps with spike
                        if (portal.worldX < spike.worldX + spike.width &&
                            portal.worldX + portal.width > spike.worldX) {
                            portal.worldX += 100;
                            needsMove = true;
                            break;
                        }
                    }
                }
            }
        }
    }

    // 5% chance to spawn double jump portal (only in normal mode - not hard/hell/god mode)
    if (!isDoubleJumpMode && !portal && !gameState.isHardMode && !gameState.isHellMode && !gameState.isGodMode && Math.random() < 0.0005) {
        // 0.05% per frame gives roughly 5% chance over several seconds
        spawnPortal('doubleJump');
    }
}

// Render Game
function render() {
    // Clear canvas
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, config.width, config.height);

    // Draw cloud text "전민기가 만듬"
    drawCloudText(cloudText.x, cloudText.y, cloudText.text);

    // Draw ground
    ctx.fillStyle = '#3d3d5c';
    ctx.fillRect(0, groundY, config.width, config.groundHeight);

    // Draw score and high score (from server)
    const scoreTextColor = config.backgroundColor === '#ffffb3' ? '#000000' : '#ffffff';
    const serverBest = getServerBestScore();
    ctx.fillStyle = scoreTextColor;
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + gameState.score, 20, 40);
    ctx.fillText('Best: ' + serverBest.score + ' (' + serverBest.name + ')', 20, 70);

    // Draw "나야,전민기" in top right corner
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('나야,전민기', config.width - 20, 30);

    // Draw spikes (convert world position to screen position)
    for (const spike of spikes) {
        const screenX = spike.worldX - camera.x;

        // Draw spike
        ctx.fillStyle = spike.color;
        ctx.beginPath();
        ctx.moveTo(screenX + spike.width / 2, spike.y);
        ctx.lineTo(screenX + spike.width, spike.y + spike.height);
        ctx.lineTo(screenX, spike.y + spike.height);
        ctx.closePath();
        ctx.fill();
    }

    // Draw blocks
    for (const block of blocks) {
        const screenX = block.worldX - camera.x;
        ctx.fillStyle = block.color;
        ctx.fillRect(screenX, block.y, block.width, block.height);
    }

    // Draw gears (sawblades)
    for (const gear of gears) {
        const screenX = gear.worldX - camera.x;
        drawGear(screenX, gear.y, gear.radius, gear.teeth, gear.rotation, gear.color);
    }

    // Draw monsters (side view - pentagon shape, upper jaw moves)
    for (const monster of monsters) {
        const screenX = monster.worldX - camera.x;
        const mouthGap = monster.mouthOpen * 10;
        const upperJawMove = monster.mouthOpen * 5;

        // Draw upper jaw (black) - pentagon shape, moves up when opening
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(screenX + monster.width, monster.y - upperJawMove);
        ctx.lineTo(screenX + monster.width, monster.y + 10 - upperJawMove);
        ctx.lineTo(screenX + monster.width - 10, monster.y + monster.height / 2 - mouthGap / 2);
        ctx.lineTo(screenX, monster.y + monster.height / 2 - mouthGap / 2);
        ctx.lineTo(screenX + monster.width - 15, monster.y - upperJawMove);
        ctx.closePath();
        ctx.fill();

        // Draw lower jaw (black) - pentagon shape, stays in place
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(screenX + monster.width, monster.y + monster.height);
        ctx.lineTo(screenX + monster.width, monster.y + monster.height - 10);
        ctx.lineTo(screenX + monster.width - 10, monster.y + monster.height / 2 + mouthGap / 2);
        ctx.lineTo(screenX, monster.y + monster.height / 2 + mouthGap / 2);
        ctx.lineTo(screenX + monster.width - 15, monster.y + monster.height);
        ctx.closePath();
        ctx.fill();

        // Draw teeth on upper jaw (white, pointing down)
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 4; i++) {
            const toothX = screenX + 8 + i * 11;
            const toothY = monster.y + monster.height / 2 - mouthGap / 2;
            ctx.beginPath();
            ctx.moveTo(toothX, toothY);
            ctx.lineTo(toothX + 5, toothY);
            ctx.lineTo(toothX + 2.5, toothY + 7);
            ctx.closePath();
            ctx.fill();
        }

        // Draw teeth on lower jaw (white, pointing up)
        for (let i = 0; i < 4; i++) {
            const toothX = screenX + 8 + i * 11;
            const toothY = monster.y + monster.height / 2 + mouthGap / 2;
            ctx.beginPath();
            ctx.moveTo(toothX, toothY);
            ctx.lineTo(toothX + 5, toothY);
            ctx.lineTo(toothX + 2.5, toothY - 7);
            ctx.closePath();
            ctx.fill();
        }

        // Draw eye (white) - on upper jaw, moves with jaw
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(screenX + monster.width - 12, monster.y + 12 - upperJawMove, 7, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw portal
    if (portal) {
        const portalScreenX = portal.worldX - camera.x;
        ctx.save();
        ctx.translate(portalScreenX + portal.width / 2, portal.y + portal.height / 2);

        // Draw portal glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, portal.width);
        gradient.addColorStop(0, portal.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, portal.width, 0, Math.PI * 2);
        ctx.fill();

        // Draw rotating portal ring
        ctx.rotate(portal.rotation);
        ctx.strokeStyle = portal.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, portal.width / 2, portal.height / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Draw inner ring
        ctx.rotate(-portal.rotation * 2);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, portal.width / 3, portal.height / 3, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        // Draw portal type indicator
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        if (portal.type === 'doubleJump') {
            ctx.fillText('2X', portalScreenX + portal.width / 2, portal.y - 10);
        } else {
            ctx.fillText('N', portalScreenX + portal.width / 2, portal.y - 10);
        }
    }

    // Draw double jump mode indicator
    if (isDoubleJumpMode) {
        ctx.fillStyle = '#9933ff';
        ctx.font = '18px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('더블점프 모드', config.width - 20, 40);
        ctx.fillText('남은 시간: ' + Math.ceil(doubleJumpDuration - doubleJumpTimer) + '초', config.width - 20, 60);
    }

    // Draw player (convert world position to screen position)
    const playerDrawX = player.worldX - camera.x;
    ctx.fillStyle = player.color;
    ctx.fillRect(playerDrawX, player.y, player.width, player.height);
}

// Input Handling
const keys = {};
const nameInput = document.getElementById('name-input');

// Handle name input with real input element for Korean support
nameInput.addEventListener('input', () => {
    gameState.newName = nameInput.value;
});

nameInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && gameState.newName.length > 0) {
        // Submit score to server
        await submitScore(gameState.newName, gameState.score);

        gameState.isEnteringName = false;
        nameInput.style.display = 'none';
        nameInput.value = '';
        canvas.focus();
    }
});

function showNameInput() {
    nameInput.style.display = 'block';
    nameInput.value = '';
    nameInput.focus();
}

function hideNameInput() {
    nameInput.style.display = 'none';
    nameInput.value = '';
}

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    // Color selection screen
    if (gameState.isSelectingColor) {
        e.preventDefault();
        if (e.code === 'ArrowLeft') {
            gameState.selectedColorIndex = (gameState.selectedColorIndex - 1 + playerColors.length) % playerColors.length;
        } else if (e.code === 'ArrowRight') {
            gameState.selectedColorIndex = (gameState.selectedColorIndex + 1) % playerColors.length;
        } else if (e.code === 'ArrowUp') {
            gameState.selectedColorIndex = (gameState.selectedColorIndex - 6 + playerColors.length) % playerColors.length;
        } else if (e.code === 'ArrowDown') {
            gameState.selectedColorIndex = (gameState.selectedColorIndex + 6) % playerColors.length;
        } else if (e.code === 'Space' || e.code === 'Enter') {
            player.color = playerColors[gameState.selectedColorIndex].hex;
            gameState.isSelectingColor = false;
            init();
        }
        return;
    }

    // Skip if entering name (handled by input element)
    if (gameState.isEnteringName) {
        return;
    }

    // Prevent default browser behavior
    if (e.code === 'Space') {
        e.preventDefault();
    }
    // Restart game - go back to color selection (R or Space)
    if ((e.code === 'KeyR' || e.code === 'Space') && gameState.isGameOver && !gameState.isEnteringName) {
        player.worldX = 100;
        gameState.isGameOver = false;
        gameState.isSelectingColor = true;
        colorSelectLoop();
    }
    // Pause game
    if (e.code === 'KeyP' && !gameState.isGameOver) {
        gameState.isPaused = !gameState.isPaused;
        if (!gameState.isPaused) {
            gameState.lastTime = performance.now();
        }
    }
}, true);

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
}, true);

// Touch controls for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();

    // Get touch position with scale correction for responsive canvas
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    // Color selection screen
    if (gameState.isSelectingColor) {
        // Check if touch is on a color box
        const cols = 6;
        const boxSize = 60;
        const gap = 20;
        const startX = (config.width - (cols * boxSize + (cols - 1) * gap)) / 2;
        const startY = 180;

        for (let i = 0; i < playerColors.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const boxX = startX + col * (boxSize + gap);
            const boxY = startY + row * (boxSize + gap + 30);

            if (x >= boxX && x <= boxX + boxSize && y >= boxY && y <= boxY + boxSize) {
                gameState.selectedColorIndex = i;
                player.color = playerColors[gameState.selectedColorIndex].hex;
                gameState.isSelectingColor = false;
                init();
                return;
            }
        }
        return;
    }

    // Game over - restart
    if (gameState.isGameOver && !gameState.isEnteringName) {
        player.worldX = 100;
        gameState.isGameOver = false;
        gameState.isSelectingColor = true;
        colorSelectLoop();
        return;
    }

    // During game - jump
    keys['Space'] = true;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys['Space'] = false;
}, { passive: false });

// Start the game when the page loads
window.addEventListener('load', async () => {
    // Make canvas focusable and focus it for keyboard input
    canvas.tabIndex = 1;
    canvas.focus();

    // Fetch leaderboard from server
    await fetchLeaderboard();

    if (gameState.isSelectingColor) {
        colorSelectLoop();
    } else {
        init();
    }
});
