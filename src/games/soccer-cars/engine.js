// Turbo Soccer — moteur du jeu (physique + rendu canvas).
// Deux voitures vues de dessus s'affrontent autour d'un ballon de soccer;
// frapper le ballon avec le NEZ de la voiture donne un coup bien plus puissant
// qu'un simple contact. Aucune dépendance: canvas 2D + requestAnimationFrame.

// --- Dimensions logiques du terrain (unités arbitraires, mises à l'échelle au rendu) ---
export const FIELD_W = 1000;
export const FIELD_H = 600;
const GOAL_W = 250; // hauteur de l'ouverture du but
const GOAL_DEPTH = 66; // profondeur de la cage
const POST_R = 8; // rayon des poteaux
const HUD_H = 84; // bandeau du haut (score/temps)
const PAD = 14; // marge autour du terrain

const BALL_R = 24;
const CAR_R = 24; // cercle de collision de la voiture
const CAR_LEN = 66;
const CAR_WID = 38;

const ACCEL = 980;
const REVERSE_ACCEL = 620;
const BOOST_ACCEL = 850;
const MAX_FWD = 430;
const MAX_FWD_BOOST = 680;
const MAX_REV = 250;
const TURN_RATE = 3.8; // rad/s à pleine vitesse
const GRIP = 8; // amortissement latéral (dérive)
const ROLL_DRAG = 0.55; // frottement de roulement
const BOOST_MAX = 100;
const BOOST_BURN = 42; // par seconde
const BOOST_REGEN = 16; // par seconde

const BALL_DRAG = 0.42;
const BALL_MAX_SPEED = 1250;
const WALL_BOUNCE = 0.78;
const NOSE_CONE = Math.cos((58 * Math.PI) / 180); // le "nez" = ±58° devant

const MATCH_TIME = 120; // secondes

const GOAL_TOP = (FIELD_H - GOAL_W) / 2;
const GOAL_BOT = GOAL_TOP + GOAL_W;

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function len(x, y) {
  return Math.hypot(x, y);
}

// Différence d'angle normalisée dans [-π, π].
function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function makeCar(idx) {
  return {
    idx, // 0 = bleu (défend le but gauche), 1 = rouge (défend le but droit)
    x: 0,
    y: 0,
    angle: 0,
    vx: 0,
    vy: 0,
    boost: BOOST_MAX,
    boosting: false,
    // entrées courantes (fusion clavier + tactile + IA)
    throttle: 0,
    steer: 0,
    wantBoost: false,
  };
}

export class SoccerGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ mode: 'solo'|'duo', onState?: (s: string) => void }} opts
   */
  constructor(canvas, { mode, onState } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = mode === 'duo' ? 'duo' : 'solo';
    this.onState = onState || (() => {});

    this.cars = [makeCar(0), makeCar(1)];
    this.ball = { x: 0, y: 0, vx: 0, vy: 0, spin: 0 };
    this.score = [0, 0];
    this.timeLeft = MATCH_TIME;
    this.goldenGoal = false;
    this.state = 'countdown'; // countdown | play | goal | over
    this.stateT = 3.2; // temps restant dans l'état courant
    this.lastScorer = -1;
    this.winner = -1;
    this.particles = [];
    this.shake = 0;

    this.keys = new Set();
    this.touch = [
      { left: false, right: false, boost: false, active: false },
      { left: false, right: false, boost: false, active: false },
    ];

    this._raf = 0;
    this._lastTs = 0;
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    this._onResize = () => this._resize();

    this._resetPositions();
  }

  start() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('resize', this._onResize);
    this._resize();
    this._lastTs = performance.now();
    const loop = (ts) => {
      const dt = clamp((ts - this._lastTs) / 1000, 0, 0.045);
      this._lastTs = ts;
      this._update(dt);
      this._draw();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('resize', this._onResize);
  }

  rematch() {
    this.score = [0, 0];
    this.timeLeft = MATCH_TIME;
    this.goldenGoal = false;
    this.winner = -1;
    this.particles = [];
    this.cars.forEach((c) => {
      c.boost = BOOST_MAX;
    });
    this._resetPositions();
    this._setState('countdown', 3.2);
  }

  /** Entrées tactiles: p = 0|1, patch = { left?, right?, boost? } */
  setTouch(p, patch) {
    Object.assign(this.touch[p], patch);
    this.touch[p].active = true;
  }

  _setState(s, t) {
    this.state = s;
    this.stateT = t;
    this.onState(s);
  }

  _key(e, down) {
    const codes = [
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    ];
    if (!codes.includes(e.code)) return;
    e.preventDefault();
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
  }

  _resetPositions() {
    const [c1, c2] = this.cars;
    c1.x = 170;
    c1.y = FIELD_H / 2;
    c1.angle = 0;
    c1.vx = c1.vy = 0;
    c2.x = FIELD_W - 170;
    c2.y = FIELD_H / 2;
    c2.angle = Math.PI;
    c2.vx = c2.vy = 0;
    this.ball.x = FIELD_W / 2;
    this.ball.y = FIELD_H / 2;
    this.ball.vx = this.ball.vy = 0;
  }

  // ------------------------------------------------------------------
  // Entrées
  // ------------------------------------------------------------------

  _readInputs() {
    const k = this.keys;
    const solo = this.mode === 'solo';
    const [c1, c2] = this.cars;

    // Joueur 1 (bleu): WASD/ZQSD (position physique) + Shift gauche.
    // En solo, les flèches pilotent aussi le joueur 1.
    let up = k.has('KeyW') || (solo && k.has('ArrowUp'));
    let down = k.has('KeyS') || (solo && k.has('ArrowDown'));
    let left = k.has('KeyA') || (solo && k.has('ArrowLeft'));
    let right = k.has('KeyD') || (solo && k.has('ArrowRight'));
    let boost = k.has('ShiftLeft') || k.has('Space') || (solo && k.has('ShiftRight'));
    const t1 = this.touch[0];
    if (t1.active) {
      left = left || t1.left;
      right = right || t1.right;
      boost = boost || t1.boost;
      if (!up && !down) up = true; // en tactile la voiture avance toute seule
    }
    c1.throttle = (up ? 1 : 0) - (down ? 1 : 0);
    c1.steer = (right ? 1 : 0) - (left ? 1 : 0);
    c1.wantBoost = boost;

    if (solo) {
      this._aiInputs(c2);
    } else {
      let up2 = k.has('ArrowUp');
      let down2 = k.has('ArrowDown');
      let left2 = k.has('ArrowLeft');
      let right2 = k.has('ArrowRight');
      let boost2 = k.has('ShiftRight');
      const t2 = this.touch[1];
      if (t2.active) {
        left2 = left2 || t2.left;
        right2 = right2 || t2.right;
        boost2 = boost2 || t2.boost;
        if (!up2 && !down2) up2 = true;
      }
      c2.throttle = (up2 ? 1 : 0) - (down2 ? 1 : 0);
      c2.steer = (right2 ? 1 : 0) - (left2 ? 1 : 0);
      c2.wantBoost = boost2;
    }
  }

  // IA simple: se placer derrière le ballon (côté de son propre but),
  // puis foncer dessus en direction du but adverse.
  _aiInputs(car) {
    const b = this.ball;
    const goalX = 0; // but adverse (celui du joueur 1, à gauche)
    const gy = FIELD_H / 2;

    // Direction ballon -> but adverse
    let dx = goalX - b.x;
    let dy = gy - b.y;
    const dl = len(dx, dy) || 1;
    dx /= dl;
    dy /= dl;

    // Point cible: derrière le ballon par rapport au but adverse.
    const behindX = b.x - dx * (BALL_R + CAR_R + 26);
    const behindY = b.y - dy * (BALL_R + CAR_R + 26);

    // La voiture est-elle du bon côté (entre son but et le ballon)?
    const onGoodSide = car.x > b.x - 10;
    let tx;
    let ty;
    if (onGoodSide) {
      tx = b.x - dx * 4;
      ty = b.y - dy * 4;
    } else {
      // contourner: viser le point derrière le ballon, décalé verticalement
      tx = clamp(behindX, 40, FIELD_W - 40);
      ty = behindY + (b.y < FIELD_H / 2 ? 70 : -70);
    }
    // Urgence défensive: ballon proche de notre but -> aller dessus direct.
    if (b.x > FIELD_W - 240) {
      tx = b.x;
      ty = b.y;
    }

    const want = Math.atan2(ty - car.y, tx - car.x);
    const diff = angDiff(want, car.angle);
    car.steer = clamp(diff * 3, -1, 1);
    const dist = len(tx - car.x, ty - car.y);
    // Marche arrière si la cible est franchement derrière et proche.
    if (Math.abs(diff) > 2.4 && dist < 190) {
      car.throttle = -1;
      car.steer = -car.steer;
    } else {
      car.throttle = Math.abs(diff) > 1.5 ? 0.35 : 1;
    }
    car.wantBoost =
      Math.abs(diff) < 0.35 && dist > 220 && car.boost > 30 && onGoodSide;
  }

  // ------------------------------------------------------------------
  // Physique
  // ------------------------------------------------------------------

  _update(dt) {
    if (this.state === 'countdown') {
      this.stateT -= dt;
      if (this.stateT <= 0) this._setState('play', 0);
      this._readInputs(); // laisser tourner les moteurs (mais voitures figées)
    } else if (this.state === 'goal') {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this._resetPositions();
        this._setState('countdown', 3.2);
      }
    } else if (this.state === 'play') {
      this._readInputs();
      if (!this.goldenGoal) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          if (this.score[0] !== this.score[1]) {
            this.winner = this.score[0] > this.score[1] ? 0 : 1;
            this._setState('over', 0);
          } else {
            this.goldenGoal = true; // prochain but gagne
          }
        }
      }
      this._physics(dt);
    }

    // Particules et tremblement d'écran vivent dans tous les états.
    this.shake = Math.max(0, this.shake - dt * 30);
    this.particles = this.particles.filter((p) => {
      p.t -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      return p.t > 0;
    });
  }

  _physics(dt) {
    for (const car of this.cars) this._updateCar(car, dt);
    this._carVsCar(dt);
    for (const car of this.cars) this._carVsBall(car);
    this._updateBall(dt);
  }

  _updateCar(car, dt) {
    const f = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    let fwd = car.vx * f.x + car.vy * f.y; // vitesse signée vers l'avant
    let lat = -car.vx * f.y + car.vy * f.x; // vitesse latérale (dérive)

    // Boost
    car.boosting = car.wantBoost && car.boost > 0 && car.throttle >= 0;
    if (car.boosting) {
      car.boost = Math.max(0, car.boost - BOOST_BURN * dt);
      fwd += BOOST_ACCEL * dt;
    } else {
      car.boost = Math.min(BOOST_MAX, car.boost + BOOST_REGEN * dt);
    }

    // Accélération / marche arrière
    if (car.throttle > 0) fwd += ACCEL * car.throttle * dt;
    else if (car.throttle < 0) fwd += REVERSE_ACCEL * car.throttle * dt;

    // Frottements
    fwd *= Math.exp(-ROLL_DRAG * dt);
    lat *= Math.exp(-GRIP * dt);
    const maxF = car.boosting ? MAX_FWD_BOOST : MAX_FWD;
    fwd = clamp(fwd, -MAX_REV, maxF);

    // Direction: proportionnelle à la vitesse, inversée en marche arrière.
    const speedFactor = clamp(Math.abs(fwd) / 170, 0, 1);
    car.angle += car.steer * TURN_RATE * speedFactor * Math.sign(fwd || 1) * dt;

    const f2 = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    car.vx = f2.x * fwd - f2.y * lat;
    car.vy = f2.y * fwd + f2.x * lat;
    car.x += car.vx * dt;
    car.y += car.vy * dt;

    this._collideArena(car, CAR_R, 0.35);
  }

  _carVsCar() {
    const [a, b] = this.cars;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = len(dx, dy);
    const minD = CAR_R * 2;
    if (d === 0 || d >= minD) return;
    const nx = dx / d;
    const ny = dy / d;
    const overlap = minD - d;
    a.x -= (nx * overlap) / 2;
    a.y -= (ny * overlap) / 2;
    b.x += (nx * overlap) / 2;
    b.y += (ny * overlap) / 2;
    const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rel < 0) {
      const j = (-(1 + 0.4) * rel) / 2;
      a.vx -= j * nx;
      a.vy -= j * ny;
      b.vx += j * nx;
      b.vy += j * ny;
    }
  }

  _carVsBall(car) {
    const ball = this.ball;
    const dx = ball.x - car.x;
    const dy = ball.y - car.y;
    const d = len(dx, dy);
    const minD = CAR_R + BALL_R;
    if (d === 0 || d >= minD) return;
    const nx = dx / d;
    const ny = dy / d;

    // Sortir le ballon de la voiture.
    ball.x = car.x + nx * minD;
    ball.y = car.y + ny * minD;

    // Impulsion de contact (la voiture est bien plus lourde que le ballon).
    const rel = (ball.vx - car.vx) * nx + (ball.vy - car.vy) * ny;
    if (rel < 0) {
      ball.vx -= (1 + 0.55) * rel * nx;
      ball.vy -= (1 + 0.55) * rel * ny;
    }

    // COUP DU NEZ: si le contact est dans le cône avant de la voiture,
    // le ballon part en flèche dans la direction de la frappe.
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    if (nx * fx + ny * fy > NOSE_CONE) {
      const fwd = Math.max(0, car.vx * fx + car.vy * fy);
      const kick = 170 + fwd * 1.05 + (car.boosting ? 220 : 0);
      ball.vx += nx * kick * 0.55 + fx * kick * 0.45;
      ball.vy += ny * kick * 0.55 + fy * kick * 0.45;
      // léger recul + étincelles pour le ressenti
      car.vx -= fx * kick * 0.08;
      car.vy -= fy * kick * 0.08;
      this.shake = Math.min(6, 2 + kick / 120);
      this._sparks(ball.x, ball.y, 8, car.idx === 0 ? '#7db4ff' : '#ffb37d');
    }
  }

  _updateBall(dt) {
    const b = this.ball;
    b.vx *= Math.exp(-BALL_DRAG * dt);
    b.vy *= Math.exp(-BALL_DRAG * dt);
    const sp = len(b.vx, b.vy);
    if (sp > BALL_MAX_SPEED) {
      b.vx = (b.vx / sp) * BALL_MAX_SPEED;
      b.vy = (b.vy / sp) * BALL_MAX_SPEED;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin += (sp * dt) / BALL_R; // rotation visuelle ~ distance / rayon

    this._collideArena(b, BALL_R, WALL_BOUNCE);

    // BUT! Le ballon doit franchir entièrement la ligne.
    if (b.x + BALL_R < 0) this._goal(1); // but gauche -> point pour le rouge
    else if (b.x - BALL_R > FIELD_W) this._goal(0);
  }

  // Collision d'un cercle (voiture ou ballon) avec les murs de l'arène,
  // y compris l'intérieur des cages et les poteaux.
  _collideArena(o, r, e) {
    const inMouth = o.y > GOAL_TOP && o.y < GOAL_BOT;

    if (o.x >= 0 && o.x <= FIELD_W) {
      // Terrain principal: haut/bas toujours, gauche/droite sauf l'ouverture.
      if (o.y - r < 0) {
        o.y = r;
        if (o.vy < 0) o.vy = -o.vy * e;
      } else if (o.y + r > FIELD_H) {
        o.y = FIELD_H - r;
        if (o.vy > 0) o.vy = -o.vy * e;
      }
      if (!inMouth) {
        if (o.x - r < 0) {
          o.x = r;
          if (o.vx < 0) o.vx = -o.vx * e;
        } else if (o.x + r > FIELD_W) {
          o.x = FIELD_W - r;
          if (o.vx > 0) o.vx = -o.vx * e;
        }
      }
    } else {
      // À l'intérieur d'une cage: parois haut/bas + fond.
      if (o.y - r < GOAL_TOP) {
        o.y = GOAL_TOP + r;
        if (o.vy < 0) o.vy = -o.vy * e;
      } else if (o.y + r > GOAL_BOT) {
        o.y = GOAL_BOT - r;
        if (o.vy > 0) o.vy = -o.vy * e;
      }
      if (o.x < 0 && o.x - r < -GOAL_DEPTH) {
        o.x = -GOAL_DEPTH + r;
        if (o.vx < 0) o.vx = -o.vx * e;
      } else if (o.x > FIELD_W && o.x + r > FIELD_W + GOAL_DEPTH) {
        o.x = FIELD_W + GOAL_DEPTH - r;
        if (o.vx > 0) o.vx = -o.vx * e;
      }
    }

    // Poteaux (petits cercles aux coins des ouvertures).
    for (const px of [0, FIELD_W]) {
      for (const py of [GOAL_TOP, GOAL_BOT]) {
        const dx = o.x - px;
        const dy = o.y - py;
        const d = len(dx, dy);
        const minD = r + POST_R;
        if (d > 0 && d < minD) {
          const nx = dx / d;
          const ny = dy / d;
          o.x = px + nx * minD;
          o.y = py + ny * minD;
          const rel = o.vx * nx + o.vy * ny;
          if (rel < 0) {
            o.vx -= (1 + e) * rel * nx;
            o.vy -= (1 + e) * rel * ny;
          }
        }
      }
    }
  }

  _goal(scorer) {
    this.score[scorer] += 1;
    this.lastScorer = scorer;
    this.shake = 8;
    const gx = scorer === 1 ? 0 : FIELD_W;
    this._sparks(gx, FIELD_H / 2, 60, scorer === 0 ? '#5ea2ff' : '#ff7a6b', 420);
    this._sparks(gx, FIELD_H / 2, 30, '#ffd24a', 380);
    if (this.goldenGoal) {
      this.winner = scorer;
      this._setState('over', 0);
    } else {
      this._setState('goal', 2.2);
    }
  }

  _sparks(x, y, n, color, speed = 260) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 60,
        t: 0.5 + Math.random() * 0.9,
        color,
        r: 2 + Math.random() * 3.5,
      });
    }
  }

  // ------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this._dpr = dpr;
  }

  _draw() {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const worldW = FIELD_W + 2 * (GOAL_DEPTH + PAD);
    const worldH = FIELD_H + HUD_H + 2 * PAD;
    const scale = Math.min(cw / worldW, ch / worldH);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.translate(
      (cw - worldW * scale) / 2,
      (ch - worldH * scale) / 2
    );
    ctx.scale(scale, scale);
    // Origine du monde: coin haut-gauche du terrain.
    ctx.translate(GOAL_DEPTH + PAD, HUD_H + PAD);
    if (this.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake
      );
    }

    this._drawField(ctx);
    this._drawGoals(ctx);
    for (const car of this.cars) this._drawCar(ctx, car);
    this._drawBall(ctx);

    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.t, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this._drawHud(ctx);
    this._drawBanners(ctx);
  }

  _drawField(ctx) {
    // Pelouse à bandes
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#2c8f4e' : '#33a35a';
      ctx.fillRect((FIELD_W / 8) * i, 0, FIELD_W / 8, FIELD_H);
    }
    // Lignes
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, FIELD_W - 4, FIELD_H - 4);
    ctx.beginPath();
    ctx.moveTo(FIELD_W / 2, 0);
    ctx.lineTo(FIELD_W / 2, FIELD_H);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(FIELD_W / 2, FIELD_H / 2, 80, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(FIELD_W / 2, FIELD_H / 2, 6, 0, TAU);
    ctx.fill();
    // Surfaces de réparation
    for (const side of [0, 1]) {
      const x = side === 0 ? 0 : FIELD_W - 150;
      ctx.strokeRect(x, FIELD_H / 2 - 170, 150, 340);
    }
  }

  _drawGoals(ctx) {
    for (const side of [0, 1]) {
      const x0 = side === 0 ? -GOAL_DEPTH : FIELD_W;
      // fond de cage
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x0, GOAL_TOP, GOAL_DEPTH, GOAL_W);
      // filet
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 1; i < 5; i++) {
        const x = x0 + (GOAL_DEPTH / 5) * i;
        ctx.moveTo(x, GOAL_TOP);
        ctx.lineTo(x, GOAL_BOT);
      }
      for (let i = 1; i < 8; i++) {
        const y = GOAL_TOP + (GOAL_W / 8) * i;
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + GOAL_DEPTH, y);
      }
      ctx.stroke();
      // cadre + poteaux (couleur de l'attaquant qui doit marquer ici)
      ctx.strokeStyle = side === 0 ? '#ff7a6b' : '#5ea2ff';
      ctx.lineWidth = 5;
      ctx.strokeRect(x0, GOAL_TOP, GOAL_DEPTH, GOAL_W);
      ctx.fillStyle = '#f4f7ea';
      for (const py of [GOAL_TOP, GOAL_BOT]) {
        ctx.beginPath();
        ctx.arc(side === 0 ? 0 : FIELD_W, py, POST_R, 0, TAU);
        ctx.fill();
      }
    }
  }

  _drawCar(ctx, car) {
    const main = car.idx === 0 ? '#2f6fd8' : '#e2483b';
    const dark = car.idx === 0 ? '#1d4a99' : '#a02c23';
    const nose = car.idx === 0 ? '#9cc4ff' : '#ffc09c';

    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Flamme de boost
    if (car.boosting && this.state === 'play') {
      const fl = 18 + Math.random() * 16;
      const grad = ctx.createLinearGradient(-CAR_LEN / 2, 0, -CAR_LEN / 2 - fl, 0);
      grad.addColorStop(0, 'rgba(255,210,74,0.95)');
      grad.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-CAR_LEN / 2, -8);
      ctx.lineTo(-CAR_LEN / 2 - fl, 0);
      ctx.lineTo(-CAR_LEN / 2, 8);
      ctx.closePath();
      ctx.fill();
    }

    // Ombre
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 4, CAR_LEN / 2 + 2, CAR_WID / 2 + 2, 0, 0, TAU);
    ctx.fill();

    // Roues
    ctx.fillStyle = '#181818';
    for (const wx of [-CAR_LEN / 2 + 12, CAR_LEN / 2 - 14]) {
      ctx.fillRect(wx - 6, -CAR_WID / 2 - 3, 13, 6);
      ctx.fillRect(wx - 6, CAR_WID / 2 - 3, 13, 6);
    }

    // Carrosserie
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.roundRect(-CAR_LEN / 2, -CAR_WID / 2, CAR_LEN, CAR_WID, 10);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.stroke();

    // NEZ (l'arme du jeu!) — pare-choc avant surligné
    ctx.fillStyle = nose;
    ctx.beginPath();
    ctx.roundRect(CAR_LEN / 2 - 10, -CAR_WID / 2 + 2, 9, CAR_WID - 4, 4);
    ctx.fill();

    // Habitacle
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.roundRect(-CAR_LEN / 2 + 14, -CAR_WID / 2 + 7, 28, CAR_WID - 14, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.roundRect(CAR_LEN / 2 - 30, -CAR_WID / 2 + 8, 10, CAR_WID - 16, 3);
    ctx.fill();

    ctx.restore();
  }

  _drawBall(ctx) {
    const b = this.ball;
    ctx.save();
    ctx.translate(b.x, b.y);
    // ombre
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 5, BALL_R, BALL_R * 0.85, 0, 0, TAU);
    ctx.fill();
    // ballon
    const grad = ctx.createRadialGradient(-7, -8, 4, 0, 0, BALL_R + 4);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#cfd6cf');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, TAU);
    ctx.fill();
    // motif (pentagones stylisés qui tournent avec le ballon)
    ctx.rotate(b.spin);
    ctx.fillStyle = '#22302a';
    for (let i = 0; i < 5; i++) {
      const a = (TAU / 5) * i;
      const px = Math.cos(a) * BALL_R * 0.62;
      const py = Math.sin(a) * BALL_R * 0.62;
      ctx.beginPath();
      ctx.arc(px, py, BALL_R * 0.24, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R * 0.26, 0, TAU);
    ctx.fill();
    ctx.rotate(-b.spin);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  _drawHud(ctx) {
    const cy = -HUD_H / 2 - 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Temps (ou BUT EN OR)
    if (this.goldenGoal) {
      ctx.font = "800 24px 'Trebuchet MS', system-ui, sans-serif";
      ctx.fillStyle = '#ffd24a';
      ctx.fillText('⚡ BUT EN OR ⚡', FIELD_W / 2, cy);
    } else {
      ctx.font = "700 30px 'Trebuchet MS', system-ui, sans-serif";
      const t = Math.ceil(this.timeLeft);
      const mm = Math.floor(t / 60);
      const ss = String(t % 60).padStart(2, '0');
      ctx.fillStyle = this.timeLeft < 15 ? '#ff7a6b' : '#f4f7ea';
      ctx.fillText(`${mm}:${ss}`, FIELD_W / 2, cy);
    }

    // Scores
    ctx.font = "800 42px 'Trebuchet MS', system-ui, sans-serif";
    ctx.fillStyle = '#5ea2ff';
    ctx.fillText(String(this.score[0]), FIELD_W / 2 - 160, cy);
    ctx.fillStyle = '#ff7a6b';
    ctx.fillText(String(this.score[1]), FIELD_W / 2 + 160, cy);

    ctx.font = "700 17px 'Trebuchet MS', system-ui, sans-serif";
    ctx.fillStyle = '#9cc4ff';
    ctx.textAlign = 'left';
    ctx.fillText('BLEU', 8, cy - 14);
    ctx.fillStyle = '#ffc09c';
    ctx.textAlign = 'right';
    ctx.fillText(this.mode === 'solo' ? 'ROBOT' : 'ROUGE', FIELD_W - 8, cy - 14);

    // Jauges de boost
    for (const car of this.cars) {
      const w = 170;
      const x = car.idx === 0 ? 8 : FIELD_W - 8 - w;
      const y = cy + 4;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, 12, 6);
      ctx.fill();
      ctx.fillStyle = car.idx === 0 ? '#5ea2ff' : '#ff7a6b';
      const bw = (w - 4) * (car.boost / BOOST_MAX);
      if (bw > 2) {
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, bw, 8, 4);
        ctx.fill();
      }
    }
    ctx.textAlign = 'left';
  }

  _drawBanners(ctx) {
    const cx = FIELD_W / 2;
    const cy = FIELD_H / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.state === 'countdown') {
      const n = Math.ceil(this.stateT);
      const label = this.stateT <= 0.6 ? 'GO!' : String(Math.min(3, n));
      ctx.font = "900 120px 'Trebuchet MS', system-ui, sans-serif";
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillText(label, cx + 4, cy + 4);
      ctx.fillStyle = '#ffd24a';
      ctx.fillText(label, cx, cy);
    } else if (this.state === 'goal') {
      const who = this.lastScorer === 0 ? 'BLEU' : this.mode === 'solo' ? 'ROBOT' : 'ROUGE';
      ctx.font = "900 96px 'Trebuchet MS', system-ui, sans-serif";
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillText('BUUUT!', cx + 4, cy - 26 + 4);
      ctx.fillStyle = this.lastScorer === 0 ? '#5ea2ff' : '#ff7a6b';
      ctx.fillText('BUUUT!', cx, cy - 26);
      ctx.font = "800 34px 'Trebuchet MS', system-ui, sans-serif";
      ctx.fillStyle = '#f4f7ea';
      ctx.fillText(`Point pour ${who}`, cx, cy + 48);
    } else if (this.state === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-GOAL_DEPTH - PAD, -HUD_H - PAD, FIELD_W + 2 * (GOAL_DEPTH + PAD), FIELD_H + HUD_H + 2 * PAD);
      const who = this.winner === 0 ? 'BLEU' : this.mode === 'solo' ? 'ROBOT' : 'ROUGE';
      ctx.font = "900 76px 'Trebuchet MS', system-ui, sans-serif";
      ctx.fillStyle = this.winner === 0 ? '#5ea2ff' : '#ff7a6b';
      ctx.fillText(`${who} GAGNE! 🏆`, cx, cy - 40);
      ctx.font = "800 40px 'Trebuchet MS', system-ui, sans-serif";
      ctx.fillStyle = '#f4f7ea';
      ctx.fillText(`${this.score[0]} — ${this.score[1]}`, cx, cy + 24);
    }
    ctx.textAlign = 'left';
  }
}
