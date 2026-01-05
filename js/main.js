// 게임 설정은 클래스 정의 후에 실행

// 메인 메뉴 씬
class MainMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });
    }

    create() {
        // 배경 (깔끔한 단색)
        this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
        
        // 타이틀 (곰플레이어 스타일 - 깔끔하고 미니멀)
        this.add.text(400, 200, 'DODGE', {
            fontSize: '64px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // 최고 생존 시간 표시
        const bestTime = parseFloat(localStorage.getItem('bestTime') || 0);
        this.add.text(400, 280, `BEST: ${bestTime.toFixed(1)}s`, {
            fontSize: '28px',
            fill: '#00ff88',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 시작 안내
        this.add.text(400, 380, 'CLICK TO START', {
            fontSize: '24px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 조작법 (간단하게)
        this.add.text(400, 450, 'ARROWS: MOVE', {
            fontSize: '18px',
            fill: '#aaaaaa',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 키 입력 설정 (여러 방법 시도)
        this.keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        
        // 키보드 포커스 활성화
        this.input.keyboard.enabled = true;
        
        // 모든 키 입력 감지 (디버깅용)
        this.input.keyboard.on('keydown', (event) => {
            console.log('키 입력:', event.key, event.keyCode);
            if (event.key === 'z' || event.key === 'Z' || event.keyCode === 90) {
                console.log('Z 키 감지! 게임 시작');
                this.scene.start('GameScene');
            }
        });
        
        // 클릭으로도 시작 가능
        this.input.on('pointerdown', () => {
            console.log('화면 클릭 감지! 게임 시작');
            this.scene.start('GameScene');
        });
        
        console.log('메인 메뉴 로드 완료. Z 키를 누르거나 화면을 클릭하세요.');
    }
    
    update() {
        // Z 키 입력 확인 (추가 방법)
        if (this.keyZ && this.keyZ.isDown) {
            console.log('Z 키 isDown 감지! 게임 시작');
            this.scene.start('GameScene');
        }
    }
}

// 메인 게임 씬
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // 게임 변수 초기화
        this.survivalTime = 0; // 생존 시간 (초)
        this.lives = 3;
        this.bombs = 3;
        this.powerLevel = 0;
        this.isSlowMode = false;
        this.isInvincible = false;
        this.gameOver = false;
        this.stageTime = 0;
        this.bossActive = false;
        this.midBossActive = false;

        // 배경 생성
        this.createBackground();

        // 플레이어 생성
        this.createPlayer();

        // 옵션 유닛 생성
        this.options = [];

        // 탄환 그룹
        this.playerBullets = this.physics.add.group({
            defaultKey: null,
            maxSize: 100
        });
        this.enemyBullets = this.physics.add.group({
            defaultKey: null,
            maxSize: 200
        });
        this.enemies = this.physics.add.group();
        this.items = this.physics.add.group();
        this.bosses = this.physics.add.group();

        // 탄환이 화면 밖으로 나가면 제거
        this.physics.world.on('worldbounds', (event) => {
            if (event.body.gameObject === this.player) {
                event.body.gameObject.setActive(false);
            } else if (this.playerBullets.contains(event.body.gameObject) || 
                       this.enemyBullets.contains(event.body.gameObject)) {
                event.body.gameObject.destroy();
            }
            // 적은 화면 밖으로 나가면 제거
            else if (this.enemies.contains(event.body.gameObject)) {
                if (event.body.gameObject.y > 650) { // 화면 아래로 나가면
                    event.body.gameObject.destroy();
                }
            }
        });

        // 충돌 설정
        this.setupCollisions();

        // UI 생성
        this.createUI();

        // 키 입력 설정
        this.setupInput();

        // 적 스폰 타이머
        this.enemySpawnTimer = 0;
        this.enemySpawnInterval = 50; // 0.05초마다 적 생성 (매우 많이 스폰)

        // 폭탄 사용 가능 여부
        this.bombCooldown = 0;

        // 플레이어 경계 처리
        this.player.body.setCollideWorldBounds(true);
    }

    createBackground() {
        // 곰플레이어 스타일 - 깔끔한 단색 배경
        this.bgLayers = [];
        
        // 단순한 그라데이션 배경
        const bg = this.add.rectangle(400, 300, 800, 600, 0x0f0f23);
        bg.setDepth(0);
        
        // 별 패턴 (미니멀하게)
        const graphics = this.add.graphics();
        graphics.fillStyle(0xffffff, 0.3);
        for (let j = 0; j < 50; j++) {
            const starX = Phaser.Math.Between(0, 800);
            const starY = Phaser.Math.Between(0, 600);
            graphics.fillCircle(starX, starY, 1);
        }
        graphics.setDepth(1);
        
        this.bgLayers.push({ 
            graphics: graphics,
            speed: 2
        });
    }

    createPlayer() {
        // 곰플레이어 스타일 - 단순한 원형 플레이어
        this.player = this.add.circle(400, 500, 12, 0x00ff88);
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setSize(24, 24);
        this.player.setDepth(10);
        
        // 플레이어 시작 위치를 화면 중앙으로
        this.player.setPosition(400, 300);
        
        // 플레이어 중심점 (피격 판정)
        this.hitbox = this.add.circle(this.player.x, this.player.y, 8, 0x00ff88);
        this.hitbox.setDepth(11);
        this.hitbox.setAlpha(0.5);
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        // Z 키 제거 (사격 기능 없음)
        this.keyX = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }

    setupCollisions() {
        // 플레이어 탄환과 적 충돌
        this.physics.add.overlap(
            this.playerBullets,
            this.enemies,
            this.hitEnemy,
            null,
            this
        );

        // 플레이어 탄환과 보스 충돌
        this.physics.add.overlap(
            this.playerBullets,
            this.bosses,
            this.hitBoss,
            null,
            this
        );

        // 적 탄환과 플레이어 충돌
        this.physics.add.overlap(
            this.enemyBullets,
            this.player,
            this.hitPlayer,
            null,
            this
        );

        // 적과 플레이어 충돌
        this.physics.add.overlap(
            this.enemies,
            this.player,
            this.hitPlayer,
            null,
            this
        );

        // 보스와 플레이어 충돌
        this.physics.add.overlap(
            this.bosses,
            this.player,
            this.hitPlayer,
            null,
            this
        );

        // 아이템과 플레이어 충돌
        this.physics.add.overlap(
            this.items,
            this.player,
            this.collectItem,
            null,
            this
        );
    }

    createUI() {
        // 곰플레이어 스타일 - 시간만 크게 표시 (깔끔하게)
        this.timeText = this.add.text(400, 50, 'Time: 0.0', {
            fontSize: '48px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);
    }

    updateLivesBar() {
        // 잔기 텍스트만 업데이트
        if (this.livesText) {
            this.livesText.setText(`LIVES: ${this.lives}`);
        }
    }

    update(time, delta) {
        if (this.gameOver) return;

        this.stageTime += delta;
        
        // 생존 시간 업데이트 (초 단위)
        if (!this.gameOver) {
            this.survivalTime = Math.floor(this.stageTime / 1000 * 10) / 10; // 소수점 1자리
            this.timeText.setText(`Time: ${this.survivalTime.toFixed(1)}`);
        }

        // 배경 스크롤
        this.updateBackground(delta);

        // 플레이어 이동
        this.updatePlayerMovement(delta);

        // 사격 기능 제거 (피하기 게임)

        // 폭탄
        this.updateBomb(time);

        // 적 스폰
        this.updateEnemySpawn(time);

        // 보스 스폰
        this.updateBossSpawn(time);

        // 옵션 업데이트
        this.updateOptions();
        
        // 적 비행기 위치 수동 업데이트 (물리 엔진이 제대로 작동하지 않을 경우 대비)
        this.updateEnemyPositions(delta);
        
        // 탄환 관련 기능 제거 (피하기 게임)
        
        // 적 비행기와 플레이어 수동 충돌 판정만 유지
        this.checkEnemyPlayerCollisions();

        // 보스 및 아이템 관련 기능 제거 (피하기 게임)

        // 히트박스 업데이트 (플레이어 중심점)
        if (this.hitbox) {
            this.hitbox.setPosition(this.player.x, this.player.y);
        }

        // 무적 시간 감소
        if (this.isInvincible) {
            this.player.setAlpha(0.5);
            this.invincibleTimer -= delta;
            if (this.invincibleTimer <= 0) {
                this.isInvincible = false;
                this.player.setAlpha(1);
            }
        }

        // 폭탄 쿨다운
        if (this.bombCooldown > 0) {
            this.bombCooldown -= delta;
        }
    }

    updateBackground(delta) {
        // 곰플레이어 스타일 - 배경은 정적이거나 매우 느리게 스크롤
        // 별 패턴은 거의 움직이지 않음
    }

    updatePlayerMovement(delta) {
        const speed = this.isSlowMode ? 100 : 300;
        let moveX = 0;
        let moveY = 0;

        if (this.cursors.left.isDown) {
            moveX = -speed;
        } else if (this.cursors.right.isDown) {
            moveX = speed;
        }

        if (this.cursors.up.isDown) {
            moveY = -speed;
        } else if (this.cursors.down.isDown) {
            moveY = speed;
        }

        // 저속 모드
        this.isSlowMode = this.keyShift.isDown;

        // 대각선 이동 정규화
        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.707;
            moveY *= 0.707;
        }

        this.player.body.setVelocity(moveX, moveY);
    }

    // 사격 기능 제거 (피하기 게임)

    updateBomb(time) {
        if (this.keyX.isDown && this.bombs > 0 && this.bombCooldown <= 0) {
            this.useBomb();
        }
    }

    useBomb() {
        this.bombs--;
        this.bombsText.setText(`BOMBS: ${this.bombs}`);
        this.bombCooldown = 500; // 0.5초 쿨다운

        // 무적 시간 부여
        this.isInvincible = true;
        this.invincibleTimer = 2000;

        // 화면 전체 폭발 효과
        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, 800);
            const y = Phaser.Math.Between(0, 600);
            this.createExplosion(x, y);
        }

        // 모든 적 탄환 제거
        this.enemyBullets.children.entries.forEach(bullet => {
            if (bullet.active) {
                bullet.destroy();
            }
        });

        // 모든 적에게 대미지
        this.enemies.children.entries.forEach(enemy => {
            if (enemy.active) {
                enemy.health -= 10;
                if (enemy.health <= 0) {
                    this.createExplosion(enemy.x, enemy.y);
                    enemy.destroy();
                }
            }
        });

        // 보스에게 대미지
        this.bosses.children.entries.forEach(boss => {
            if (boss.active) {
                boss.health -= 50;
                if (boss.health <= 0) {
                    this.createExplosion(boss.x, boss.y);
                    if (boss.isBoss && boss.phase === 1) {
                        // 2단계로 변신
                        this.transformBoss(boss);
                    } else {
                        boss.destroy();
                        this.bossActive = false;
                        this.midBossActive = false;
                    }
                }
            }
        });
    }

    // 사격 기능 제거 (피하기 게임)

    updateEnemySpawn(time) {
        // 보스전 중에도 일반 적 스폰 계속 (게임이 멈추지 않도록)
        // if (this.bossActive || this.midBossActive) return; // 보스전 중에는 일반 적 스폰 중지
        
        // 시간이 지날수록 더 빠르게 스폰 (난이도 증가)
        let spawnInterval = this.enemySpawnInterval;
        if (this.stageTime > 3000) { // 3초 후
            spawnInterval = this.enemySpawnInterval * 0.7; // 30% 더 빠르게
        }
        if (this.stageTime > 5000) { // 5초 후
            spawnInterval = this.enemySpawnInterval * 0.5; // 50% 더 빠르게
        }
        if (this.stageTime > 10000) { // 10초 후
            spawnInterval = this.enemySpawnInterval * 0.3; // 70% 더 빠르게
        }
        if (this.stageTime > 15000) { // 15초 후
            spawnInterval = this.enemySpawnInterval * 0.2; // 80% 더 빠르게
        }
        
        if (time > this.enemySpawnTimer) {
            this.enemySpawnTimer = time + spawnInterval;
            this.spawnEnemy();
        }
    }

    updateBossSpawn(time) {
        // 보스 스폰 비활성화 (게임이 끊기지 않도록)
        // 원하면 나중에 다시 활성화 가능
        /*
        // 30초마다 중간 보스
        if (!this.midBossActive && !this.bossActive && this.stageTime > 30000 && this.stageTime % 30000 < 1000) {
            this.spawnMidBoss();
        }

        // 60초마다 메인 보스
        if (!this.bossActive && this.stageTime > 60000 && this.stageTime % 60000 < 1000) {
            this.spawnMainBoss();
        }
        */
    }

    spawnEnemy() {
        // 사방에서 랜덤하게 적 스폰 (더 랜덤하게)
        // 0: 위, 1: 아래, 2: 왼쪽, 3: 오른쪽
        const side = Phaser.Math.Between(0, 3);
        let x, y, speedX, speedY;
        
        // 일정한 크기와 속도
        const radius = 10; // 모든 적이 같은 크기
        const color = 0xffff00; // 노란색
        const speed = 300; // 일정한 속도
        
        // 랜덤성 추가: 70%는 플레이어를 향해, 30%는 랜덤 방향
        const isRandomDirection = Math.random() < 0.3;
        
        // 스폰 위치와 방향 설정
        if (side === 0) {
            // 위에서
            x = Phaser.Math.Between(0, 800); // 화면 전체 너비에서 랜덤
            y = -30;
            if (isRandomDirection) {
                // 랜덤 방향 (아래쪽으로 약간 치우침)
                const randomAngle = Phaser.Math.Between(-Math.PI / 3, Math.PI / 3) + Math.PI / 2;
                speedX = Math.cos(randomAngle) * speed;
                speedY = Math.sin(randomAngle) * speed;
            } else {
                // 플레이어를 향해 이동
                const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
                speedX = Math.cos(angle) * speed;
                speedY = Math.sin(angle) * speed;
            }
        } else if (side === 1) {
            // 아래에서
            x = Phaser.Math.Between(0, 800);
            y = 630;
            if (isRandomDirection) {
                // 랜덤 방향 (위쪽으로 약간 치우침)
                const randomAngle = Phaser.Math.Between(-Math.PI / 3, Math.PI / 3) - Math.PI / 2;
                speedX = Math.cos(randomAngle) * speed;
                speedY = Math.sin(randomAngle) * speed;
            } else {
                const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
                speedX = Math.cos(angle) * speed;
                speedY = Math.sin(angle) * speed;
            }
        } else if (side === 2) {
            // 왼쪽에서
            x = -30;
            y = Phaser.Math.Between(0, 600); // 화면 전체 높이에서 랜덤
            if (isRandomDirection) {
                // 랜덤 방향 (오른쪽으로 약간 치우침)
                const randomAngle = Phaser.Math.Between(-Math.PI / 3, Math.PI / 3);
                speedX = Math.cos(randomAngle) * speed;
                speedY = Math.sin(randomAngle) * speed;
            } else {
                const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
                speedX = Math.cos(angle) * speed;
                speedY = Math.sin(angle) * speed;
            }
        } else {
            // 오른쪽에서
            x = 830;
            y = Phaser.Math.Between(0, 600);
            if (isRandomDirection) {
                // 랜덤 방향 (왼쪽으로 약간 치우침)
                const randomAngle = Phaser.Math.Between(-Math.PI / 3, Math.PI / 3) + Math.PI;
                speedX = Math.cos(randomAngle) * speed;
                speedY = Math.sin(randomAngle) * speed;
            } else {
                const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
                speedX = Math.cos(angle) * speed;
                speedY = Math.sin(angle) * speed;
            }
        }
        
        // 원형 적 생성
        const enemy = this.add.circle(x, y, radius, color);
        this.physics.add.existing(enemy);
        
        // 물리 엔진 활성화 확인
        if (!enemy.body) {
            console.error('적 물리 엔진 오류');
            return;
        }
        
        // 속도 설정
        enemy.body.setVelocityX(speedX);
        enemy.body.setVelocityY(speedY);
        enemy.body.setSize(radius * 2, radius * 2);
        enemy.body.setCollideWorldBounds(false);
        
        // 초기 위치 설정
        enemy.x = x;
        enemy.y = y;
        enemy.setDepth(5);
        enemy.health = 1;
        enemy.radius = radius;
        
        // 속도를 저장하여 수동 업데이트 가능하도록
        enemy.speedX = speedX;
        enemy.speedY = speedY;
        
        this.enemies.add(enemy);
    }

    // 적 미사일 발사 기능 제거 (피하기 게임)

    updateOptions() {
        // 옵션 위치 업데이트
        this.options.forEach((option, index) => {
            const angle = (index * 2 * Math.PI / this.options.length) + (this.time.now * 0.001);
            const radius = 40;
            option.setPosition(
                this.player.x + Math.cos(angle) * radius,
                this.player.y + Math.sin(angle) * radius
            );
        });
    }

    updateBossHealthBars() {
        // 모든 보스의 체력 바 업데이트
        this.bosses.children.entries.forEach(boss => {
            if (boss.active && boss.healthBar) {
                boss.healthBar.clear();
                const barWidth = boss.isBoss ? 200 : 150;
                const healthPercent = Math.max(0, boss.health / boss.maxHealth);
                
                // 배경 (빨간색)
                boss.healthBar.fillStyle(0xff0000, 1);
                boss.healthBar.fillRect(boss.x - barWidth / 2, boss.y - 60, barWidth, 10);
                
                // 체력 (초록색)
                boss.healthBar.fillStyle(0x00ff00, 1);
                boss.healthBar.fillRect(boss.x - barWidth / 2, boss.y - 60, barWidth * healthPercent, 10);
            }
        });
    }

    cleanupItems() {
        // 아이템이 화면 밖으로 나가면 제거
        this.items.children.entries.forEach(item => {
            if (item.active && item.y > 650) {
                item.destroy();
            }
        });
    }

    cleanupEnemies() {
        // 적이 화면 밖으로 나가면 제거 (단, 체력이 0이 아닌 경우만 - 죽은 적은 이미 파괴됨)
        this.enemies.children.entries.forEach(enemy => {
            if (enemy.active && enemy.y > 650 && enemy.health > 0) {
                enemy.destroy();
            }
        });
    }

    updateEnemyPositions(delta) {
        // 적 비행기 위치를 수동으로 업데이트 (물리 엔진이 제대로 작동하지 않을 경우)
        this.enemies.children.entries.forEach(enemy => {
            if (enemy.active && enemy.speedY) {
                // 수동으로 위치 업데이트
                enemy.y += enemy.speedY * (delta / 1000);
                enemy.x += (enemy.speedX || 0) * (delta / 1000);
                
                // 물리 엔진 위치도 동기화
                if (enemy.body) {
                    enemy.body.x = enemy.x;
                    enemy.body.y = enemy.y;
                }
            }
        });
    }

    updateBulletPositions(delta) {
        // 플레이어 탄환 위치를 수동으로 업데이트
        this.playerBullets.children.entries.forEach(bullet => {
            if (!bullet || !bullet.active) return;
            
            if (bullet.speedY !== undefined) {
                // 수동으로 위치 업데이트
                bullet.y += bullet.speedY * (delta / 1000);
                bullet.x += (bullet.speedX || 0) * (delta / 1000);
                
                // 물리 엔진 위치도 동기화
                if (bullet.body) {
                    bullet.body.x = bullet.x;
                    bullet.body.y = bullet.y;
                }
                
                // 화면 밖으로 나가면 제거
                if (bullet.y < -50 || bullet.y > 650 || bullet.x < -50 || bullet.x > 850) {
                    bullet.destroy();
                }
            }
        });
    }

    updateEnemyBulletPositions(delta) {
        // 적 탄환 위치를 수동으로 업데이트
        this.enemyBullets.children.entries.forEach(bullet => {
            if (!bullet || !bullet.active) return;
            
            if (bullet.speedY !== undefined || bullet.speedX !== undefined) {
                // 수동으로 위치 업데이트
                bullet.y += (bullet.speedY || 0) * (delta / 1000);
                bullet.x += (bullet.speedX || 0) * (delta / 1000);
                
                // 물리 엔진 위치도 동기화
                if (bullet.body) {
                    bullet.body.x = bullet.x;
                    bullet.body.y = bullet.y;
                }
                
                // 화면 밖으로 나가면 제거
                if (bullet.y < -50 || bullet.y > 650 || bullet.x < -50 || bullet.x > 850) {
                    bullet.destroy();
                }
            }
        });
    }

    checkBulletEnemyCollisions() {
        // 플레이어 탄환과 적 비행기 수동 충돌 판정
        this.playerBullets.children.entries.forEach(bullet => {
            if (!bullet || !bullet.active) return;
            
            // 탄환이 이미 파괴되었는지 확인
            if (bullet.destroyed) return;
            
            this.enemies.children.entries.forEach(enemy => {
                if (!enemy || !enemy.active) return;
                
                // 적이 이미 파괴되었는지 확인
                if (enemy.destroyed || enemy.health <= 0) return;
                
                // 두 점 사이의 거리 계산
                const dx = bullet.x - enemy.x;
                const dy = bullet.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 충돌 판정 (탄환 반지름 + 적 반지름)
                const bulletRadius = bullet.radius || 5;
                const enemyRadius = 20; // 적 비행기 크기의 반
                
                if (distance < bulletRadius + enemyRadius) {
                    // 충돌 발생
                    this.hitEnemy(bullet, enemy);
                    // 탄환을 파괴했으므로 이 탄환은 더 이상 충돌 체크하지 않음
                    bullet.destroyed = true;
                    return; // 이 적에 대한 루프 종료
                }
            });
        });
    }

    checkEnemyBulletPlayerCollisions() {
        // 적 탄환과 플레이어 수동 충돌 판정
        if (this.isInvincible || this.gameOver) return;
        
        this.enemyBullets.children.entries.forEach(bullet => {
            if (!bullet || !bullet.active) return;
            
            // 두 점 사이의 거리 계산
            const dx = bullet.x - this.player.x;
            const dy = bullet.y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 충돌 판정 (탄환 반지름 + 플레이어 히트박스)
            const bulletRadius = bullet.radius || 5;
            const playerRadius = 4; // 플레이어 히트박스 크기
            
            if (distance < bulletRadius + playerRadius) {
                // 충돌 발생
                this.hitPlayer(this.player, bullet);
            }
        });
    }

    checkEnemyPlayerCollisions() {
        // 적 비행기와 플레이어 수동 충돌 판정
        if (this.isInvincible || this.gameOver) return;
        
        this.enemies.children.entries.forEach(enemy => {
            if (!enemy || !enemy.active) return;
            if (enemy.health <= 0) return; // 이미 죽은 적은 충돌하지 않음
            
            // 두 점 사이의 거리 계산
            const dx = enemy.x - this.player.x;
            const dy = enemy.y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 충돌 판정 (적 반지름 + 플레이어 히트박스)
            const enemyRadius = enemy.radius || 12; // 적의 실제 반지름 사용
            const playerRadius = 8; // 플레이어 히트박스 크기 (원형)
            
            if (distance < enemyRadius + playerRadius) {
                // 충돌 발생
                this.hitPlayer(this.player, enemy);
            }
        });
    }

    hitEnemy(bullet, enemy) {
        // 이미 파괴된 탄환이나 적은 처리하지 않음
        if (!bullet || !bullet.active || !enemy || !enemy.active) return;
        if (enemy.health <= 0) return; // 이미 죽은 적은 처리하지 않음
        
        // 탄환 파괴
        if (bullet.active) {
            bullet.destroy();
        }
        
        // 적 체력 감소
        enemy.health--;
        
        if (enemy.health <= 0) {
            // 파티클 효과
            this.createExplosion(enemy.x, enemy.y);
            
            // 적 파괴
            if (enemy.active) {
                enemy.destroy();
            }
        }
    }

    hitBoss(bullet, boss) {
        bullet.destroy();
        boss.health--;
        
        if (boss.health <= 0) {
            if (boss.isBoss && boss.phase === 1) {
                // 2단계로 변신
                this.transformBoss(boss);
            } else {
                // 보스 파괴
                this.createExplosion(boss.x, boss.y);
                if (boss.healthBar) boss.healthBar.destroy();
                boss.destroy();
                this.bossActive = false;
                this.midBossActive = false;
            }
        }
    }

    spawnMidBoss() {
        this.midBossActive = true;
        const boss = this.add.rectangle(400, 100, 150, 80, 0xff6600);
        this.physics.add.existing(boss);
        boss.body.setVelocityY(50);
        boss.body.setVelocityX(100);
        boss.body.setCollideWorldBounds(true);
        boss.body.setBounce(1, 0);
        boss.body.setMaxVelocity(100, 50);
        boss.health = 50;
        boss.maxHealth = 50;
        boss.isBoss = false;
        boss.phase = 1;
        boss.shootTimer = 0;
        boss.healthBar = this.add.graphics();
        this.bosses.add(boss);

        // 체력 바 초기화
        boss.healthBar.fillStyle(0xff0000, 1);
        boss.healthBar.fillRect(boss.x - 75, boss.y - 60, 150, 10);

        // 보스가 화면 중앙에 도달하면 정지
        this.time.delayedCall(1000, () => {
            if (boss.active) {
                boss.body.setVelocity(0, 0);
                boss.y = 150;
            }
        });

        // 보스 좌우 이동 패턴
        this.time.addEvent({
            delay: 3000,
            callback: () => {
                if (boss.active && boss.y === 150) {
                    boss.body.setVelocityX(boss.body.velocity.x === 0 ? 100 : -boss.body.velocity.x);
                }
            },
            loop: true
        });

        // 보스 공격 패턴
        this.startBossAttack(boss);
    }

    spawnMainBoss() {
        this.bossActive = true;
        const boss = this.add.rectangle(400, -100, 200, 120, 0xff0000);
        this.physics.add.existing(boss);
        boss.body.setVelocityY(50);
        boss.body.setCollideWorldBounds(true);
        boss.body.setImmovable(true);
        boss.health = 200;
        boss.maxHealth = 200;
        boss.isBoss = true;
        boss.phase = 1;
        boss.shootTimer = 0;
        boss.healthBar = this.add.graphics();
        this.bosses.add(boss);

        // 체력 바 초기화
        boss.healthBar.fillStyle(0xff0000, 1);
        boss.healthBar.fillRect(boss.x - 100, boss.y - 60, 200, 10);

        // 보스가 화면 상단에 도달하면 정지
        this.time.delayedCall(2000, () => {
            if (boss.active) {
                boss.body.setVelocity(0, 0);
                boss.y = 100;
            }
        });

        // 보스 공격 패턴
        this.startBossAttack(boss);
    }

    transformBoss(boss) {
        // 2단계 변신
        boss.phase = 2;
        boss.health = 100;
        boss.maxHealth = 100;
        boss.setFillStyle(0xff00ff);
        boss.setSize(150, 100);
        
        // 체력 바 업데이트
        if (boss.healthBar) {
            boss.healthBar.clear();
            boss.healthBar.fillStyle(0xff0000, 1);
            boss.healthBar.fillRect(boss.x - 75, boss.y - 60, 150, 10);
            boss.healthBar.fillStyle(0x00ff00, 1);
            boss.healthBar.fillRect(boss.x - 75, boss.y - 60, 150, 10);
        }
        
        // 로봇 형태로 변신 (색상 변경으로 표현)
        this.createExplosion(boss.x, boss.y);
        
        // 더 강한 공격 패턴으로 변경
        this.startBossAttack(boss);
    }

    startBossAttack(boss) {
        if (!boss.active) return;

        // 탄막 패턴
        const pattern = () => {
            if (!boss.active) return;

            // 원형 탄막
            const bulletCount = boss.phase === 2 ? 12 : 8;
            for (let i = 0; i < bulletCount; i++) {
                const angle = (i * Math.PI * 2) / bulletCount;
                const bullet = this.add.circle(boss.x, boss.y + 40, 6, 0xff00ff);
                this.physics.add.existing(bullet);
                bullet.body.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
                bullet.body.setCollideWorldBounds(true);
                bullet.body.onWorldBounds = true;
                this.enemyBullets.add(bullet);
            }

            // 플레이어를 향한 탄환
            const angle = Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y);
            const bullet = this.add.circle(boss.x, boss.y + 40, 8, 0xff0000);
            this.physics.add.existing(bullet);
            bullet.body.setVelocity(Math.cos(angle) * 200, Math.sin(angle) * 200);
            bullet.body.setCollideWorldBounds(true);
            bullet.body.onWorldBounds = true;
            this.enemyBullets.add(bullet);

            // 다음 공격
            const delay = boss.phase === 2 ? 800 : 1000;
            this.time.delayedCall(delay, pattern);
        };

        this.time.delayedCall(2000, pattern);
    }

    hitPlayer(player, object) {
        // 게임 오버 상태면 처리하지 않음
        if (this.gameOver) return;
        
        // 이미 파괴된 객체는 처리하지 않음
        if (!object || !object.active) return;

        // 한 번 부딛히면 바로 게임 오버
        this.gameOver = true;
        this.showGameOver();

        // 충돌한 객체 파괴 (플레이어가 아닌 경우)
        if (object !== this.player && object.active) {
            object.destroy();
        }
    }

    dropItem(x, y) {
        const itemType = Phaser.Math.Between(1, 3);
        let color = 0xffff00; // Power Up
        if (itemType === 2) color = 0xff00ff; // Bomb
        if (itemType === 3) color = 0x00ffff; // Full Power

        const item = this.add.circle(x, y, 10, color);
        this.physics.add.existing(item);
        item.body.setVelocityY(100);
        item.itemType = itemType;
        this.items.add(item);
    }

    collectItem(player, item) {
        if (item.itemType === 1) {
            // Power Up
            this.powerLevel = Math.min(this.powerLevel + 1, 3);
            this.powerText.setText(`POWER: ${this.powerLevel}`);
        } else if (item.itemType === 2) {
            // Bomb
            this.bombs++;
            this.bombsText.setText(`BOMBS: ${this.bombs}`);
        } else if (item.itemType === 3) {
            // Full Power
            this.powerLevel = 3;
            this.powerText.setText(`POWER: ${this.powerLevel}`);
            // 옵션 추가 (비행기 모양)
            if (this.options.length < 2) {
                const optionGraphics = this.add.graphics();
                optionGraphics.fillStyle(0x00ff00, 1);
                optionGraphics.lineStyle(1, 0x00cc00, 1);
                
                // 작은 비행기 모양
                optionGraphics.beginPath();
                optionGraphics.moveTo(0, -8);
                optionGraphics.lineTo(-6, 6);
                optionGraphics.lineTo(-2, 4);
                optionGraphics.lineTo(2, 4);
                optionGraphics.lineTo(6, 6);
                optionGraphics.closePath();
                optionGraphics.fillPath();
                optionGraphics.strokePath();
                
                optionGraphics.setScale(0.6);
                this.options.push(optionGraphics);
            }
        }
        item.destroy();
    }

    createExplosion(x, y) {
        // 간단한 폭발 효과
        for (let i = 0; i < 8; i++) {
            const particle = this.add.circle(x, y, 3, 0xffff00);
            const angle = (i * Math.PI * 2) / 8;
            const speed = Phaser.Math.Between(50, 150);
            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                alpha: 0,
                duration: 500,
                onComplete: () => particle.destroy()
            });
        }
    }

    showGameOver() {
        // 최고 생존 시간 저장 및 업데이트
        let bestTime = parseFloat(localStorage.getItem('bestTime') || 0);
        const isNewRecord = this.survivalTime > bestTime;
        
        if (isNewRecord) {
            bestTime = this.survivalTime;
            localStorage.setItem('bestTime', bestTime.toString());
            console.log('새로운 최고 기록:', bestTime);
        }

        // 곰플레이어 스타일 - 깔끔한 게임 오버 화면
        const gameOverText = this.add.text(400, 250, 'GAME OVER', {
            fontSize: '56px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        const timeText = this.add.text(400, 320, `${this.survivalTime.toFixed(1)}s`, {
            fontSize: '42px',
            fill: isNewRecord ? '#00ff88' : '#ffffff', // 새 기록이면 초록색
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // 새 기록 표시
        if (isNewRecord) {
            this.add.text(400, 360, 'NEW RECORD!', {
                fontSize: '32px',
                fill: '#00ff88',
                fontFamily: 'Arial',
                fontWeight: 'bold'
            }).setOrigin(0.5);
        }
        
        // 최고 생존 시간 표시 (저장된 최신 값 사용)
        const bestTimeText = this.add.text(400, 400, `BEST: ${bestTime.toFixed(1)}s`, {
            fontSize: '28px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        const restartText = this.add.text(400, 450, 'CLICK TO RESTART', {
            fontSize: '20px',
            fill: '#aaaaaa',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            this.scene.start('MainMenu'); // 메인 메뉴로 돌아가서 best time 업데이트
        });
        
        this.input.keyboard.once('keydown-SPACE', () => {
            this.scene.start('MainMenu'); // 메인 메뉴로 돌아가서 best time 업데이트
        });
    }
}

// 게임 설정 및 초기화 (클래스 정의 후)
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#0f0f23',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MainMenu, GameScene]
};

const game = new Phaser.Game(config);
