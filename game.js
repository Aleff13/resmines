const TILE_SIZE = 24;
const MAP_WIDTH = 100;
const MAP_HEIGHT = 1000;
const MAX_STACK = 8;
const HOTBAR_SLOTS = 5;

const ITEM = {
  GOLD: "gold",
  IRON: "iron",
  COIN: "coin"
};

const TILE = {
  EMPTY: 0,
  DIRT: 1,
  STONE: 2,
  ORE: 3,
  IRON: 4,
  GOLD: 5,
  COIN: 6
};

const notyf = new Notyf({ duration: 5000 }); // 5000ms = 5s

class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
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

    notyf.error('Full stack reached, please remove some items to add more 😅');
    return false;
  }

  create() {
    /* =================================================
       MAPA STEAMWORLD STYLE
    ================================================= */

    this.map = [];
    this.inventory = [];
    this.tiles = this.physics.add.staticGroup();
    this.digDir = { x: 0, y: 0 };
    this.coins = 0;
    this.digPower = 1;

    this.keys = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });

    this.shopText = this.add.text(500, 10, "Press E to shop", {
        fontSize: "14px",
        color: "#ffffff"
    }).setScrollFactor(0);

    this.hudText = this.add.text(10, 10, "", {
        fontSize: "14px",
        color: "#ffffff",
    }).setScrollFactor(0).setDepth(1000);

    this.keyE = this.input.keyboard.addKey("E");

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      this.inventory.push({
        item: null,
        quantity: 0
      });
    }


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

        this.map[y][x] = tile;

        if (tile !== TILE.EMPTY) {
          this.createTile(x, y, tile);
        }
      }
    }

    /* =================================================
       PLAYER
    ================================================= */

    this.player = this.add.rectangle(
        MAP_WIDTH * TILE_SIZE * 0.5,
        5 * TILE_SIZE,
        TILE_SIZE * 0.8,
        TILE_SIZE * 0.9,
        0x33ccff
        );

    this.player.setStrokeStyle(2, 0x000000, 0.6);

    this.physics.add.existing(this.player);

    this.player.body.setGravityY(700);
    this.player.body.setCollideWorldBounds(true);

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

    const tile = this.buildTile(x, y, color, type);

    this.physics.add.existing(tile, true);

    tile.tileX = x;
    tile.tileY = y;
    tile.tileType = type;
    tile.hp = hp;

    this.tiles.add(tile);
  }

    buildTile(x, y, color, type) {
        if(type === TILE.COIN) {
            return this.add.text(
                x * TILE_SIZE + 4,
                y * TILE_SIZE - 2,
                "¢",
                { fontSize: "12px", color: "#ffff00" }
            ).setOrigin(0);
        }

        return this.add.rectangle(
            x * TILE_SIZE,
            y * TILE_SIZE,
            TILE_SIZE,
            TILE_SIZE,
            color
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
        `Coins: ${this.coins}\nDig Power: ${this.digPower}`
    );

    // apertou E perto da loja
    if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
        const price = this.digPower * 10;

        if (this.coins >= price) {
            this.coins -= price;
            this.digPower += 1;

            notyf.success(`Upgrade de picareta comprado! Dig Power: ${this.digPower}`);

        } else {
            notyf.error("Moedas insuficientes");
        }
    }
    const speed = 140;
    this.player.body.setVelocityX(0);

    if (Phaser.Input.Keyboard.JustDown(this.digKey)) {
    this.dig();
    }

    // esquerda
    if (this.cursors.left.isDown || this.keys.left.isDown) {
    this.player.body.setVelocityX(-speed);
    this.facing = -1;
    }

    // direita
        if (this.cursors.right.isDown || this.keys.right.isDown) {
    this.player.body.setVelocityX(speed);
    this.facing = 1;
    }

    // pulo
    if (
    (this.cursors.up.isDown || this.keys.up.isDown) &&
    this.player.body.blocked.down
    ) {
    this.player.body.setVelocityY(-320);
    }

    if (Phaser.Input.Keyboard.JustDown(this.digKey)) {
      this.dig();
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
