const TILE_SIZE = 16;
const MAP_WIDTH = 100;
const MAP_HEIGHT = 1000;
const MAX_STACK = 8;
const HOTBAR_SLOTS = 2;

const ITEM = {
  GOLD: "gold",
  IRON: "iron",
  COIN: "coin"
};

const messages = {
    saveSuccess: "Game saved!",
    loadSuccess: "Game loaded!",
    noSave: "No saved game found!",
    itemAdded: (amount, item) => `${amount} ${item} added to inventory!`,
    inventoryFull: 'Full stack reached, please remove some items to add more 😅',
    upgradeBought: (digPower) => `Upgrade de picareta comprado! Dig Power: ${digPower}`,
    notEnoughCoins: "Moedas insuficientes",
    noItemsToSell: "Nenhum item para vender!",
    soldItems: (amount, item, earnedCoins) => `Vendeu ${amount} ${item} por ${earnedCoins}¢`
};

const TILE = {
  EMPTY: 0,
  DIRT: 1,
  STONE: 2,
  ORE: 3,
  IRON: 4,
  GOLD: 5,
  COIN: 6,
  WATER: 7
};

//todo: create files to organize code better (e.g., game scene, player, inventory, tiles, etc.)

// Notification setup
const notyf = new Notyf({ duration: 5000 }); // 5000ms = 5s

//todo: improve message handler

class GameScene extends Phaser.Scene {
    constructor() {
        super("game");
    }

    preload() {
        this.load.spritesheet("player_walk", "assets/player/knight/Run.png", {
            frameWidth: 144,
            frameHeight: 144 // Corrigido de 54 para 55
        });
        
        // Faça o mesmo para o idle se ele vier do mesmo arquivo ou tiver a mesma proporção
        this.load.spritesheet("player_idle", "assets/player/knight/Idle.png", {
            frameWidth: 144,
            frameHeight: 144
        });

        this.load.spritesheet("player_jump", "assets/player/knight/Jump.png", {
            frameWidth: 144,
            frameHeight: 144
        });

        this.load.spritesheet("player_attack", "assets/player/knight/Attack 1.png", {
            frameWidth: 144,
            frameHeight: 144
        });

        this.load.spritesheet("player_fall", "assets/player/knight/Fall.png", {
            frameWidth: 144,
            frameHeight: 144
        });

        this.load.spritesheet("coins", "assets/tiles/coin.png", {
            frameWidth: 16,
            frameHeight: 16
        });

        this.load.image("dirt", "assets/tiles/dirt.png");
        this.load.image("stone", "assets/tiles/stone.png");
        this.load.image("gold", "assets/tiles/gold.png");
        this.load.image("iron", "assets/tiles/iron.png");
        this.load.image("water", "assets/tiles/water.png");

        this.load.audio("slash", "assets/sounds/slash.wav");
        this.load.audio("background_music", "assets/sounds/background.wav");
        this.load.audio("footsteps", "assets/sounds/footsteps.wav");

    }

    //todo: refactor save/load to be more efficient encripting the map to improve performance and reduce storage space, maybe using a simple RLE compression for the map data
    saveState() {
        const state = {
            map: this.map,
            inventory: this.inventory,
            coins: this.coins,
            digPower: this.playerStats.digPower,
            playerPosition: {
                x: this.player.x,
                y: this.player.y
            }
        };

        localStorage.setItem("gameState", JSON.stringify(state));
        notyf.success(messages.saveSuccess);
    }

    loadState() {
        const stateJSON = localStorage.getItem("gameState");
        if (!stateJSON) {
            notyf.error(messages.noSave);
            return;
        }

        const state = JSON.parse(stateJSON);
        this.map = state.map;
        this.inventory = state.inventory;
        this.coins = state.coins;
        this.playerStats.digPower = state.digPower;
        this.player.x = state.playerPosition.x;
        this.player.y = state.playerPosition.y;

        notyf.success("Loading game state...", { duration: 4000 });

        // Rebuild tiles based on loaded map
        this.tiles.clear(true, true);
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const tileType = this.map[y][x];
                if (tileType !== TILE.EMPTY) {
                    this.createTile(x, y, tileType);
                }
            }
        }

        this.updateHUD();
        notyf.success(messages.loadSuccess, { duration: 4000 });
    }

    addItemToInventory(itemType, amout = 1) {
        for(let slot of this.inventory) {
            if(slot.item === itemType && slot.amount < MAX_STACK) {
                slot.amount = Math.min(slot.amount + amout, MAX_STACK);
                this.updateHUD();
                notyf.success(`${amout} ${itemType} added to inventory!`);
                return true;
            }
        }

        for(let slot of this.inventory) {
            if(slot.item === null) {
                slot.item = itemType;
                slot.amount = amout;
                this.updateHUD();
                notyf.success(`${amout} ${itemType} added to inventory!`);

                return true;
            }
        }

        notyf.error(messages.inventoryFull);
        return false;
    }

    create() {
        /* =================================================
        MAPA STEAMWORLD STYLE
        ================================================= */

        this.map = [];
        this.inventory = [];
        this.tiles = this.physics.add.staticGroup();
        this.waterTiles = this.physics.add.group();

        this.digDir = { x: 0, y: 0 };
        this.coins = 0;
        this.isAttacking = false;
        this.isWalkingSoundPlaying = false;

        // this.playerStats.digPower = 1;

        this.keys = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.shopText = this.add.text(500, 10, "E to shop", {
            fontSize: "14px",
            color: "#ffffff"
        }).setScrollFactor(0);
        this.shopText = this.add.text(500, 30, "R to sell gems", {
            fontSize: "14px",
            color: "#ffffff"
        }).setScrollFactor(0);

        this.shopText = this.add.text(500, 50, "P to SAVE", {
            fontSize: "14px",
            color: "#ffffff"
        }).setScrollFactor(0);

        this.shopText = this.add.text(500, 70, "L to LOAD", {
            fontSize: "14px",
            color: "#ffffff"
        }).setScrollFactor(0);

        this.hudText = this.add.text(10, 10, "", {
            fontSize: "14px",
            color: "#ffffff",
        }).setScrollFactor(0).setDepth(1000);

        this.keyE = this.input.keyboard.addKey("E");
        this.keyR = this.input.keyboard.addKey("R");
        this.saveKey = this.input.keyboard.addKey("P");
        this.loadKey = this.input.keyboard.addKey("L");

        for (let i = 0; i < HOTBAR_SLOTS; i++) {
            this.inventory.push({
                item: null,
                quantity: 0
            });
        }

        this.anims.create({
            key: "coin_anim",
            frames: this.anims.generateFrameNumbers("coins", {
                start: 0,
                end: 6
            }),
            frameRate: 7,
            repeat: -1
        });

        for (let y = 0; y < MAP_HEIGHT; y++) {
        this.map[y] = [];

        for (let x = 0; x < MAP_WIDTH; x++) {
            let tile = TILE.EMPTY;

            if (y > 6 && y <= 18) tile = TILE.DIRT;
            else if (y > 18 && y <= 35) tile = TILE.STONE;
            else if (y > 35) {
            tile = Math.random() < 0.15 ? TILE.IRON : TILE.STONE;
            }


            // cavernas
            if (y > 12 && Math.random() < 0.05) tile = TILE.COIN;

            if (y > 13 && Math.random() < 0.03) tile = TILE.IRON;
            if (y > 13 && Math.random() < 0.02) tile = TILE.GOLD;

            if (y > 20 && Math.random() < 0.02) {
                for (let i = 0; i < 5; i++) {
                    if (x + i < MAP_WIDTH) {
                        this.map[y][x + i] = TILE.WATER;
                        this.createTile(x + i, y, TILE.WATER);
                    }
                }
            }

            this.map[y][x] = tile;

            if (tile !== TILE.EMPTY) {
                this.createTile(x, y, tile);
            }
        }
        }

        /* =================================================
        PLAYER
        ================================================= */
        
        this.anims.create({
            key: "idle",
            frames: this.anims.generateFrameNumbers("player_idle", {
                start: 0,
                end: 6
            }),
            frameRate: 7,
            repeat: -1
        });

        // this.anims.create({
        //     key: "idle",
        //     frames: [{ key: "player_idle", frame: 0 }],
        //     frameRate: 1
        // });

        this.anims.create({
            key: "walk",
            frames: this.anims.generateFrameNumbers("player_walk", {
                start: 0,
                end: 6 // Se a folha tem 24 frames no total
            }),
            frameRate: 7,
            repeat: -1
        });

        this.anims.create({
            key: "jump",
            frames: this.anims.generateFrameNumbers("player_jump", {
                start: 0,
                end: 3 // Se a folha tem 24 frames no total
            }),
            frameRate: 4,
            repeat: -1
        });

        this.anims.create({
            key: "attack",
            frames: this.anims.generateFrameNumbers("player_attack", {
                start: 0,
                end: 9 // Se a folha tem 24 frames no total
            }),
            frameRate: 28,
            repeat: 0
        });

        this.anims.create({
            key: "fall",
            frames: this.anims.generateFrameNumbers("player_fall", {
                start: 0,
                end: 3
            }),
            frameRate: 4,
            repeat: -1
        });



        this.player = this.physics.add.sprite(
            MAP_WIDTH * TILE_SIZE * 0.5,
            1 * TILE_SIZE,
            "player_idle"
        );

        this.player.setScale(0.8);
        this.player.setCollideWorldBounds(true);
        this.player.body.setGravityY(700);

        this.slashSound = this.sound.add("slash", {
            volume: 0.5
        });

        this.footstepsSound = this.sound.add("footsteps", {
            volume: 0.8,
            loop: true
        });

        this.backgroundMusic = this.sound.add("background_music", {
            volume: 0.4,
            loop: true,
        });
        this.backgroundMusic.play();

        // this.player = this.add.rectangle(
        //     MAP_WIDTH * TILE_SIZE * 0.5,
        //     5 * TILE_SIZE,
        //     TILE_SIZE * 0.8,
        //     TILE_SIZE * 0.9,
        //     0x33ccff
        //     );

        // this.player.setStrokeStyle(2, 0x000000, 0.6);

        this.player.body.setGravityY(700);
        this.player.body.setCollideWorldBounds(true);
        this.physics.add.existing(this.player);
        this.player.body.setSize(15, 18); // Tamanho da caixa de colisão (menor que o sprite)
        // this.player.body.setOffset(10, 10);

        this.physics.add.collider(this.player, this.tiles);
        this.physics.world.setBounds(
        0,
        0,
        MAP_WIDTH * TILE_SIZE,
        MAP_HEIGHT * TILE_SIZE
        );

        this.facing = 1; // 1 = direita | -1 = esquerda

        /* =================================================
        INPUT
        ================================================= */
        this.cursors = this.input.keyboard.createCursorKeys();
        this.digKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.X
        );
        //shift key
        this.shiftKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SHIFT
        );

        /* =================================================
        CÂMERA
        ================================================= */
        this.cameras.main.startFollow(this.player);
        // this.cameras.main.setBounds(
        //   0, 0,
        //   MAP_WIDTH,
        //   MAP_HEIGHT * TILE_SIZE * 100
        // );
        this.cameras.main.setRoundPixels(true);

        /* =================================================
        PLAYER STATS
        ================================================= */
        this.playerStats = {
            digPower: 1,
            gold: 0
        };

        this.particles = this.add.particles(
        0,
        0,
        "__WHITE",
            {
                lifespan: 300,
                speed: { min: 30, max: 80 },
                scale: { start: 0.5, end: 0 },
                gravityY: 300,
                quantity: 5,
                tint: 0xffffff,
                blendMode: Phaser.BlendModes.NORMAL
            }
        );



        this.createHUD();
    }

    createHUD() {
        this.hud = this.add.container(0, 0);
        this.hud.setScrollFactor(0);

        this.hudSlots = [];

        const startX = 200;
        const startY = 320;
        const slotSize = 36;

        for (let i = 0; i < HOTBAR_SLOTS; i++) {
            const bg = this.add.rectangle(
            startX + i * (slotSize + 4),
            startY,
            slotSize,
            slotSize,
            0x222222
            ).setStrokeStyle(2, 0xffffff);

            const text = this.add.text(
            bg.x - 14,
            bg.y - 12,
            "",
            { fontSize: "14px", color: "#ffffff" }
            );

            this.hud.add(bg);
            this.hud.add(text);

            this.hudSlots.push({ bg, text });
        }

        this.updateHUD();
    }

    updateHUD() {
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const slot = this.inventory[i];
        const hudSlot = this.hudSlots[i];

        if (slot.item) {
        let label = "";

        if (slot.item === ITEM.GOLD) label = "Au";
        if (slot.item === ITEM.IRON) label = "Fe";

        hudSlot.text.setText(`${label}\n${slot.amount}`);
        } else {
        hudSlot.text.setText("");
        }
    }
    }

    createTile(x, y, type) {
        let color = 0x8b5a2b;
        let hp = 2;

        if (type === TILE.STONE) {
            color = 0x666666;
            hp = 4;
        }
        if (type === TILE.ORE) {
            color = 0xffcc00;
            hp = 3;
        }

        if(type === TILE.IRON) {
            color = 0xfcc4c0;
            hp = 5;
        }

        if(type === TILE.GOLD) {
            color = 0xffd700;
            hp = 6;
        }

        //const tile = this.buildTile(x, y, color, type);
        const tile = this.buildTile(x, y, type);

        tile.tileX = x;
        tile.tileY = y;
        tile.tileType = type;
        tile.hp = hp;

        if(type === TILE.WATER) {
            this.waterTiles.add(tile);
        }
        else if (type !== TILE.COIN) {
            this.physics.add.existing(tile, true);
            this.tiles.add(tile);
        }

    }

    // buildTile(x, y, color, type) {
    //     if(type === TILE.COIN) {
    //         return this.add.text(
    //             x * TILE_SIZE + 4,
    //             y * TILE_SIZE - 2,
    //             "¢",
    //             { fontSize: "12px", color: "#ffff00" }
    //         ).setOrigin(0);
    //     }

    //     return this.add.rectangle(
    //         x * TILE_SIZE,
    //         y * TILE_SIZE,
    //         TILE_SIZE,
    //         TILE_SIZE,
    //         color
    //     ).setOrigin(0);
    // }

    buildTile(x, y, type) {

    let key = null;

    if (type === TILE.DIRT) key = "dirt";
    if (type === TILE.STONE) key = "stone";
    if (type === TILE.GOLD) key = "gold";
    if (type === TILE.IRON) key = "iron";
    if (type === TILE.WATER) key = "water";

    // if (type === TILE.COIN) {
    //     return this.add.text(
    //         x * TILE_SIZE,
    //         y * TILE_SIZE,
    //         "¢",
    //         { fontSize: "12px", color: "#ffff00" }
    //     ).setOrigin(0);
    // }

    if (type === TILE.COIN) {
        const coin = this.physics.add.staticSprite(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            "coins"
        );

        coin.setOrigin(0.5);
        coin.anims.play("coin_anim", true);

        this.tweens.add({
            targets: coin,
            y: coin.y - 2,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        coin.tileX = x;
        coin.tileY = y;
        coin.tileType = type;
        coin.hp = 1;

        this.tiles.add(coin);
        return coin;
    }

    return this.add.image(
        x * TILE_SIZE,
        y * TILE_SIZE,
        key
    ).setOrigin(0);
}

    dig() {
        const px = Math.floor(this.player.x / TILE_SIZE);
        const py = Math.floor(this.player.y / TILE_SIZE);

        let dx = 0;
        let dy = 0;

        if (this.cursors.left.isDown || this.keys.left.isDown) dx = -1;
        else if (this.cursors.right.isDown || this.keys.right.isDown) dx = 1;
        else if (this.cursors.up.isDown || this.keys.up.isDown) dy = -1;
        else if (this.cursors.down.isDown || this.keys.down.isDown) dy = 1;
        else dx = this.facing;


        const tx = px + dx;
        const ty = py + dy;

        if (
            tx < 0 || tx >= MAP_WIDTH ||
            ty < 0 || ty >= MAP_HEIGHT
        ) return;

        const tileType = this.map[ty][tx];
        if (tileType === TILE.EMPTY) return;

        const tile = this.tiles.getChildren().find(t =>
            t.tileX === tx && t.tileY === ty
        );
        if (!tile) return;

        tile.hp -= this.playerStats.digPower;

        this.tweens.add({
            targets: tile,
            scaleX: 0.85,
            scaleY: 0.85,
            duration: 50,
            yoyo: true
        });

        tile.scaleX = tile.hp / 4;
        tile.scaleY = tile.hp / 4;

        if (tile.hp <= 0) {
            this.map[ty][tx] = TILE.EMPTY;
            this.tiles.remove(tile, true, true);

            if (tile.tileType === TILE.COIN) {
                notyf.success("You found a coin! +1¢");
                this.coins += 1;
            }

            if (tile.tileType === TILE.GOLD) {
                this.addItemToInventory(ITEM.GOLD, 1);
            }

            if (tile.tileType === TILE.IRON) {
                    this.addItemToInventory(ITEM.IRON, 1);
            }
        }
        this.particles.emitParticleAt(
            tile.x + TILE_SIZE / 2,
            tile.y + TILE_SIZE / 2
        );
    }

    update() {
        this.hudText.setText(
            `Coins: ${this.coins}\nDig Power: ${this.playerStats.digPower}`
        );

        const speed = 140;
        this.player.body.setVelocityX(0);

        // apertou E perto da loja
        this.buyUpgrade();
        this.sellGems()
        this.handleSave();
        this.handleLoad();
        this.handleDig();
        this.handleMovements();

        // if (Phaser.Input.Keyboard.JustDown(this.digKey)) {
        //     this.dig();
        // }
    }

    // handleMovements(speed) {
    //     if (this.cursors.left.isDown || this.keys.left.isDown) {
    //         this.player.body.setVelocityX(-speed);
    //         this.facing = -1;
    //     }

    //     // direita
    //     if (this.cursors.right.isDown || this.keys.right.isDown) {
    //         this.player.body.setVelocityX(speed);
    //         this.facing = 1;
    //     }

    //     // pulo
    //     if ((this.cursors.up.isDown || this.keys.up.isDown) &&
    //         this.player.body.blocked.down) {
    //         this.player.body.setVelocityY(-320);
    //     }
    // }

//     handleMovements(speed) {

//     this.player.body.setVelocityX(0);
//     this.player.anims.play("idle", true);

//     if (this.cursors.left.isDown || this.keys.left.isDown) {
//         this.player.body.setVelocityX(-speed);
//         this.player.setFlipX(false);
//         this.player.anims.play("walk", true);
//         // this.facing = -1;
//     }
//     if (this.cursors.right.isDown || this.keys.right.isDown) {
//         this.player.body.setVelocityX(speed);
//         this.player.setFlipX(true);
//         this.player.anims.play("walk", true);
//         // this.facing = 1;
//     }
//     if ((this.cursors.up.isDown || this.keys.up.isDown) &&
//         this.player.body.blocked.down) {
//         this.player.body.setVelocityY(-320);
//     }
//     // else {
//     //     this.player.anims.play("idle", true);
//     // }
// }

handleMovements() {

    
    const isRunning = this.shiftKey.isDown;
    const speed = isRunning ? 200 : 100;
    const timeScaleWalkingAnim = isRunning ? 1.8 : 1;

    if (this.isAttacking) {
        // this.player.setVelocityX(0);
        return;
    }

    const onGround = this.player.body.blocked.down;

    // Movimento horizontal
    if (this.cursors.left.isDown || this.keys.left.isDown) {
        this.player.body.setVelocityX(-speed);
        this.player.setFlipX(true);
    } 
    else if (this.cursors.right.isDown || this.keys.right.isDown) {
        this.player.body.setVelocityX(speed);
        this.player.setFlipX(false);
    } 
    else {
        this.player.body.setVelocityX(0);
    }

    // Pulo
    if ((this.cursors.up.isDown || this.keys.up.isDown) && onGround) {
        this.player.body.setVelocityY(-320);
    }

    // 🎬 CONTROLE DE ANIMAÇÃO (SEPARADO DO MOVIMENTO)

    if (!onGround) {
        this.player.anims.play("jump", true);

        if (this.isWalkingSoundPlaying) {
            this.footstepsSound.stop();
            this.isWalkingSoundPlaying = false;
        }
    }
    else if (this.player.body.velocity.x !== 0) {
        this.player.anims.play("walk", true);

        this.player.anims.timeScale = timeScaleWalkingAnim;

        this.footstepsSound.setVolume(
            Math.abs(this.player.body.velocity.x) / 200
        );

        if (!this.isWalkingSoundPlaying) {
            this.footstepsSound.play();
            this.isWalkingSoundPlaying = true;
        }
    }
    else if (this.player.body.velocity.x === 0) {
        this.player.anims.play("idle", true);

        if (this.isWalkingSoundPlaying) {
            this.footstepsSound.stop();
            this.isWalkingSoundPlaying = false;
        }
    }
}


handleDig() {

    if (this.isAttacking) return;

    if (Phaser.Input.Keyboard.JustDown(this.digKey)) {

        this.isAttacking = true;

        this.player.setVelocityX(0);

        this.player.anims.play("attack", true);

        this.dig();
        this.slashSound.play();

        this.player.once("animationcomplete-attack", () => {
            this.isAttacking = false;
        });
    }
}

    handleSave() {
        if (!Phaser.Input.Keyboard.JustDown(this.saveKey)) {
            return;
        }
        this.saveState();
    }

    handleLoad() {
        if (!Phaser.Input.Keyboard.JustDown(this.loadKey)) {
            return;
        }
        this.loadState();
    }

    buyUpgrade() {
        if (!Phaser.Input.Keyboard.JustDown(this.keyE)) {
            return;
        }

        const price = this.playerStats.digPower * 5; // preço aumenta a cada upgrade

        if (this.coins >= price) {
            this.coins -= price;
            this.playerStats.digPower += 1;

            notyf.success(messages.upgradeBought(this.playerStats.digPower));
        } else {
            notyf.error(messages.notEnoughCoins);
        }
        
    }


    //refactor: reestruturar a estrutura de dados de itens para manipulação mais fácil
    sellGems(){
        if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
            if(this.inventory.every(slot => slot.item === null)) {
                notyf.error(messages.noItemsToSell);
                return;
            }

            for(let slot of this.inventory) {
                if(slot.item === ITEM.GOLD) {
                    const amount = slot.amount;
                    const earnedCoins = amount * 5;
                    this.coins += earnedCoins;
                    slot.item = null;
                    slot.amount = 0;
                    this.updateHUD();
                    notyf.success(`Vendeu ${amount} Au por ${earnedCoins}¢`);
                    return;
                }
                if(slot.item === ITEM.IRON) {
                    const amount = slot.amount;
                    const earnedCoins = amount * 2;
                    this.coins += earnedCoins;
                    slot.item = null;
                    slot.amount = 0;
                    this.updateHUD();
                    notyf.success(`Vendeu ${amount} Au por ${earnedCoins}¢`);
                    return;
                }
            }
        }
    }
}

/* =====================================================
   CONFIG PHASER
===================================================== */
const config = {
  type: Phaser.AUTO,
  width: 640,
  height: 360,
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: GameScene
};

const game = new Phaser.Game(config);
