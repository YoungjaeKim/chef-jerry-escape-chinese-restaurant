const wait = (ms) =>
  new Promise((resolve) => {
    const start = performance.now();
    const tick = (now) => {
      if (now - start >= ms) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

const BOSS_MAX = 1000;
const CASHIER_MAX = 5000;
const PLAYER_MAX = 1000;
const CANNON_DAMAGE = 100;
const ROBOT_MAX = 7000;
const CHEF_MAX = 8500;
const SHURIKEN_DAMAGE = 10;
const ROBOT_HIT = 200;

const game = document.getElementById("game");
const captions = {
  foyer: document.getElementById("foyer-caption"),
  taken: document.getElementById("taken-line"),
  cage: document.getElementById("cage-caption"),
  board: document.getElementById("board-caption"),
  kitchen: document.getElementById("kitchen-caption"),
  below: document.getElementById("below-caption"),
  outdoor: document.getElementById("outdoor-caption"),
};

const state = {
  phase: "title",
  armed: false,
  bossHp: BOSS_MAX,
  bossMax: BOSS_MAX,
  playerHp: PLAYER_MAX,
  firing: false,
  kx: 0,
  kz: 0,
  dodge: 0,
  shurikenTimer: 0,
  robotSeq: 0,
  fireworkTimer: 0,
  chefSeq: 0,
};

const heldKeys = new Set();
const MOVE_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function showScene(id) {
  document.querySelectorAll(".scene").forEach((scene) => {
    const on = scene.id === id;
    scene.classList.toggle("is-active", on);
    scene.toggleAttribute("hidden", !on);
  });
}

function audioContext() {
  if (!game._ac) {
    game._ac = new (window.AudioContext || window.webkitAudioContext)();
  }
  return game._ac;
}

function scream() {
  const ac = audioContext();
  const t = ac.currentTime;
  const len = 0.95;
  const samples = Math.floor(ac.sampleRate * len);
  const buffer = ac.createBuffer(1, samples, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i += 1) data[i] = Math.random() * 2 - 1;

  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 5;
  band.frequency.setValueAtTime(780, t);
  band.frequency.exponentialRampToValueAtTime(1600, t + 0.16);
  band.frequency.exponentialRampToValueAtTime(420, t + 0.9);
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.28, t + 0.05);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.92);
  noise.connect(band).connect(noiseGain).connect(ac.destination);
  noise.start(t);
  noise.stop(t + len);

  const voice = ac.createOscillator();
  voice.type = "sawtooth";
  voice.frequency.setValueAtTime(420, t);
  voice.frequency.exponentialRampToValueAtTime(760, t + 0.14);
  voice.frequency.exponentialRampToValueAtTime(190, t + 0.88);
  const voiceGain = ac.createGain();
  voiceGain.gain.setValueAtTime(0.0001, t);
  voiceGain.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  voice.connect(voiceGain).connect(ac.destination);
  voice.start(t);
  voice.stop(t + len);
}

function blip(freq, duration, type = "sawtooth", gain = 0.05) {
  const ac = audioContext();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

function buzz() {
  blip(90, 0.18, "sawtooth", 0.07);
  blip(140, 0.22, "square", 0.04);
}

function resetOpeningVisuals() {
  document.getElementById("front-door").classList.remove("is-open");
  document.getElementById("kitchen-mouth").classList.remove("is-open");
  document.getElementById("chef").classList.remove("is-rushing");
  document.getElementById("hands").classList.remove("is-grab");
}

async function playOpening() {
  if (state.phase !== "title") return;
  state.phase = "opening";
  resetOpeningVisuals();
  game.classList.remove("is-black");
  showScene("scene-street");
  blip(90, 0.4, "triangle", 0.03);
  await wait(1800);
  if (state.phase !== "opening") return;
  document.getElementById("front-door").classList.add("is-open");
  blip(140, 0.25, "square", 0.04);
  await wait(1100);
  if (state.phase !== "opening") return;
  showScene("scene-foyer");
  captions.foyer.textContent = "텅 빈 홀. 기름 냄새와 육수가 공기를 적신다.";
  await wait(1800);
  captions.foyer.textContent = "주방에서 무거운 발소리가 가까워진다.";
  blip(70, 0.5, "sawtooth", 0.06);
  await wait(1400);
  document.getElementById("kitchen-mouth").classList.add("is-open");
  captions.foyer.textContent = "셰프가 달려든다.";
  document.getElementById("chef").classList.add("is-rushing");
  game.classList.add("is-shaking");
  blip(40, 0.7, "sawtooth", 0.08);
  await wait(1100);
  document.getElementById("hands").classList.add("is-grab");
  captions.foyer.textContent = "당신은 비명을 지른다.";
  scream();
  await wait(1100);
  game.classList.add("is-black");
  await wait(500);
  game.classList.remove("is-shaking");
  captions.taken.innerHTML = "의식이 끊긴다.";
  showScene("scene-taken");
  await wait(1200);
  enterCage();
}

function enterCage() {
  state.phase = "cage";
  state.armed = false;
  state.bossHp = BOSS_MAX;
  state.bossMax = BOSS_MAX;
  state.playerHp = PLAYER_MAX;
  state.firing = false;
  stopRobotAttacks();
  stopFireworks();
  game.classList.remove("is-black", "is-looking");
  document.getElementById("floor-saw").classList.remove("is-gone");
  document.getElementById("player-arm").classList.remove("is-held", "is-cutting");
  document.getElementById("player-arm").style.transform = "";
  document.getElementById("cage-cut").classList.remove("is-open");
  document.getElementById("btn-plank").hidden = true;
  document.getElementById("btn-stairs").hidden = true;
  document.getElementById("btn-kitchen-stairs").hidden = true;
  document.getElementById("waiter").classList.remove("is-hit", "is-down");
  document.getElementById("btn-cannon").classList.remove("is-gone");
  document.getElementById("held-bazooka").classList.remove("is-held");
  document.getElementById("held-bazooka").style.transform = "";
  state.kx = 0;
  state.kz = 0;
  applyKitchenCam();
  updateBossHud();
  updatePlayerHud();
  captions.cage.textContent = "거대한 새장 안이다. 발치에 전기톱이 놓여 있다.";
  showScene("scene-cage");
}

function gripChainsaw() {
  if (state.phase !== "cage" || state.armed) return;
  state.armed = true;
  state.phase = "armed";
  document.getElementById("floor-saw").classList.add("is-gone");
  document.getElementById("player-arm").classList.add("is-held");
  game.classList.add("is-looking");
  captions.cage.textContent = "오른손에 전기톱의 무게가 실린다. 새장을 자를 수 있다.";
  blip(90, 0.2, "square", 0.05);
  blip(55, 0.45, "sawtooth", 0.04);
}

function cutCage() {
  if (state.phase !== "armed") return;
  state.phase = "cutting";
  const arm = document.getElementById("player-arm");
  arm.classList.add("is-cutting");
  arm.style.transform = "";
  game.classList.add("is-shaking");
  buzz();
  captions.cage.textContent = "오른손의 전기톱이 쇠창살을 물어뜯는다.";
  window.setTimeout(() => {
    document.getElementById("cage-cut").classList.add("is-open");
    document.getElementById("btn-plank").hidden = false;
    game.classList.remove("is-shaking");
    state.phase = "cut";
    captions.cage.textContent = "잘린 자리에 나무 판자가 드러난다.";
  }, 380);
}

function followPlank() {
  if (state.phase !== "cut") return;
  state.phase = "board";
  captions.board.textContent = "판자를 따라 걷는다.";
  showScene("scene-board");
  window.setTimeout(() => {
    if (state.phase !== "board") return;
    document.getElementById("btn-stairs").hidden = false;
    captions.board.textContent = "판자 끝에 계단이 나타난다.";
  }, 700);
}

function showStairs() {
  if (state.phase !== "board") return;
  state.phase = "stairs";
  showScene("scene-stairs");
}

function enterKitchen() {
  if (state.phase !== "stairs") return;
  state.phase = "kitchen";
  state.bossHp = BOSS_MAX;
  state.bossMax = BOSS_MAX;
  state.kx = 0;
  state.kz = 0;
  document.getElementById("btn-cannon").classList.remove("is-gone");
  document.getElementById("held-bazooka").classList.remove("is-held");
  document.getElementById("waiter").classList.remove("is-hit", "is-down");
  document.getElementById("btn-kitchen-stairs").hidden = true;
  applyKitchenCam();
  updateBossHud();
  updatePlayerHud();
  captions.kitchen.textContent =
    "천장을 거의 긁는 웨이터. 음식 대포는 저쪽에 있다. WASD로 걸어가라.";
  showScene("scene-kitchen");
}

function applyKitchenCam() {
  const world = document.getElementById("kitchen-world");
  world.style.transform = `translate3d(${-state.kx * 42}vw, ${state.kz * 5}vh, ${state.kz * 240}px)`;
}

function nearCannon() {
  return state.kx > 0.34 && state.kz > 0.14;
}

function nearDeepStairs() {
  return state.kz > 1.05;
}

function pickupCannon() {
  if (state.phase !== "kitchen") return;
  if (!nearCannon()) {
    captions.kitchen.textContent = "너무 멀다. WASD로 음식 대포까지 걸어가라.";
    return;
  }
  state.phase = "kitchen-armed";
  document.getElementById("btn-cannon").classList.add("is-gone");
  document.getElementById("held-bazooka").classList.add("is-held");
  captions.kitchen.textContent = "바주카를 들었다. 클릭하면 햄버거가 날아간다.";
  blip(70, 0.2, "square", 0.05);
}

function updateBossHud() {
  const fill = document.getElementById("hp-fill");
  const text = document.getElementById("hp-text");
  const ratio = Math.max(state.bossHp, 0) / (state.bossMax || BOSS_MAX);
  if (fill) fill.style.transform = `scaleX(${ratio})`;
  if (text) text.textContent = `${Math.max(state.bossHp, 0)} / ${state.bossMax}`;
  const cFill = document.getElementById("cashier-hp-fill");
  const cText = document.getElementById("cashier-hp-text");
  if (cFill) cFill.style.transform = `scaleX(${ratio})`;
  if (cText) cText.textContent = `${Math.max(state.bossHp, 0)} / ${state.bossMax}`;
  const oFill = document.getElementById("outdoor-hp-fill");
  const oText = document.getElementById("outdoor-hp-text");
  if (oFill) oFill.style.transform = `scaleX(${ratio})`;
  if (oText) oText.textContent = `${Math.max(state.bossHp, 0)} / ${state.bossMax}`;
}

function updatePlayerHud() {
  const ratio = Math.max(state.playerHp, 0) / PLAYER_MAX;
  ["player-hp-fill", "player-hp-fill-2", "player-hp-fill-3"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.transform = `scaleX(${ratio})`;
  });
  ["player-hp-text", "player-hp-text-2", "player-hp-text-3"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${Math.max(state.playerHp, 0)} / ${PLAYER_MAX}`;
  });
}

function fireCannon() {
  if (state.phase === "cashier") {
    fireAtCashier();
    return;
  }
  if (state.phase === "robot" || state.phase === "chef-final") {
    fireAtOutdoor();
    return;
  }
  if (state.phase !== "kitchen-armed" || state.firing || state.bossHp <= 0) return;
  state.firing = true;
  const shot = document.getElementById("food-shot");
  shot.classList.remove("is-flying");
  void shot.offsetWidth;
  shot.classList.add("is-flying");
  blip(180, 0.12, "square", 0.06);
  window.setTimeout(() => {
    state.bossHp = Math.max(0, state.bossHp - CANNON_DAMAGE);
    updateBossHud();
    const waiter = document.getElementById("waiter");
    waiter.classList.add("is-hit");
    window.setTimeout(() => waiter.classList.remove("is-hit"), 180);
    if (state.bossHp <= 0) {
      waiter.classList.add("is-down");
      state.phase = "kitchen-won";
      document.getElementById("btn-kitchen-stairs").hidden = false;
      captions.kitchen.textContent =
        "웨이터가 쓰러진다. 안쪽에 계단이 보인다. WASD로 다가가라.";
      blip(90, 0.5, "triangle", 0.06);
    } else {
      captions.kitchen.textContent = `햄버거가 맞았다. 체력 ${state.bossHp}.`;
    }
    state.firing = false;
    shot.classList.remove("is-flying");
  }, 420);
}

function fireAtCashier() {
  if (state.phase !== "cashier" || state.firing || state.bossHp <= 0 || state.playerHp <= 0) {
    return;
  }
  state.firing = true;
  const shot = document.getElementById("cashier-shot");
  shot.classList.remove("is-flying");
  void shot.offsetWidth;
  shot.classList.add("is-flying");
  blip(180, 0.12, "square", 0.06);
  window.setTimeout(() => {
    state.bossHp = Math.max(0, state.bossHp - CANNON_DAMAGE);
    updateBossHud();
    const cashier = document.getElementById("cashier");
    cashier.classList.add("is-hit");
    window.setTimeout(() => cashier.classList.remove("is-hit"), 180);
    if (state.bossHp <= 0) {
      cashier.classList.add("is-down");
      stopShurikens();
      state.phase = "cashier-won";
      captions.below.textContent = "계산자가 쓰러진다. 앞쪽이 출구다.";
      blip(90, 0.5, "triangle", 0.06);
      walkToExit();
    } else {
      captions.below.textContent = `햄버거가 맞았다. 계산자 ${state.bossHp}.`;
    }
    state.firing = false;
    shot.classList.remove("is-flying");
  }, 420);
}

function aimArm(event) {
  const x = event.clientX / window.innerWidth - 0.5;
  const y = event.clientY / window.innerHeight - 0.5;
  if (state.phase === "armed") {
    document.getElementById("player-arm").style.transform =
      `translate(${x * 28}px, ${y * 18}px) rotate(${8 + x * 10}deg)`;
  } else if (
    state.phase === "kitchen-armed" ||
    state.phase === "cashier" ||
    state.phase === "robot" ||
    state.phase === "chef-final"
  ) {
    const gunId =
      state.phase === "cashier"
        ? "cashier-bazooka"
        : state.phase === "robot" || state.phase === "chef-final"
          ? "outdoor-bazooka"
          : "held-bazooka";
    const gun = document.getElementById(gunId);
    gun.style.transform = `translate(${x * 24}px, ${y * 16}px) rotate(${6 + x * 8}deg)`;
  }
}

function onPlayerInput(event) {
  if (event.type === "keydown" && event.repeat) return;
  if (event.type === "keydown" && MOVE_CODES.has(event.code)) return;
  if (event.target && event.target.closest && event.target.closest("button")) return;
  if (state.phase === "cage") gripChainsaw();
  else if (state.phase === "armed") cutCage();
  else if (state.phase === "kitchen") pickupCannon();
  else if (state.phase === "kitchen-armed") fireCannon();
  else if (state.phase === "kitchen-won") takeDeepStairs();
  else if (state.phase === "cashier") fireCannon();
  else if (state.phase === "robot" || state.phase === "chef-final") fireCannon();
}

function takeDeepStairs() {
  if (state.phase !== "kitchen-won") return;
  if (!nearDeepStairs()) {
    captions.kitchen.textContent = "계단은 더 안쪽에 있다. WASD로 걸어가라.";
    return;
  }
  state.phase = "stairs-deep";
  showScene("scene-stairs-deep");
}

function enterBelow() {
  if (state.phase !== "stairs-deep") return;
  state.phase = "cashier";
  state.bossMax = CASHIER_MAX;
  state.bossHp = CASHIER_MAX;
  document.getElementById("cashier").classList.remove("is-hit", "is-down");
  document.getElementById("cashier-view").classList.remove("is-walking-out");
  document.getElementById("shuriken-layer").innerHTML = "";
  updateBossHud();
  updatePlayerHud();
  captions.below.textContent =
    "계산자가 영수증 표창을 던진다. A·D로 피하고, 음식 대포로 쏴라.";
  showScene("scene-below");
  startShurikens();
}

function stopShurikens() {
  if (state.shurikenTimer) {
    window.clearInterval(state.shurikenTimer);
    state.shurikenTimer = 0;
  }
}

function startShurikens() {
  stopShurikens();
  state.shurikenTimer = window.setInterval(throwReceipt, 2800);
  throwReceipt();
}

function robotFighting(seq) {
  return (
    state.phase === "robot" &&
    state.robotSeq === seq &&
    state.bossHp > 0 &&
    state.playerHp > 0
  );
}

function resetRobotPose() {
  const mech = document.getElementById("mech");
  const pan = document.getElementById("robot-pan");
  if (mech) mech.classList.remove("is-spinning-joints");
  if (pan) {
    pan.classList.remove("is-swing");
    pan.style.setProperty("--pan-x", "0cm");
    pan.style.setProperty("--pan-rot", "0deg");
  }
}

function stopRobotAttacks() {
  stopShurikens();
  state.robotSeq += 1;
  resetRobotPose();
}

async function startRobotAttacks() {
  stopRobotAttacks();
  const seq = state.robotSeq;
  while (robotFighting(seq)) {
    await robotAttackCycle(seq);
    if (!robotFighting(seq)) return;
    await wait(700);
  }
}

async function robotAttackCycle(seq) {
  if (!robotFighting(seq)) return;
  captions.outdoor.textContent = "왼팔 발사기가 영수증 표창을 쏜다.";
  throwReceipt();
  await wait(1100);
  if (!robotFighting(seq)) return;
  captions.outdoor.textContent = "관절이 오른쪽으로 한 바퀴 돈다.";
  const mech = document.getElementById("mech");
  mech.classList.remove("is-spinning-joints");
  void mech.offsetWidth;
  mech.classList.add("is-spinning-joints");
  await wait(1400);
  mech.classList.remove("is-spinning-joints");
  if (!robotFighting(seq)) return;
  captions.outdoor.textContent = "오른팔 프라이팬이 다섯 번 휘두른다.";
  for (let n = 1; n <= 5; n += 1) {
    if (!robotFighting(seq)) return;
    await swingPanStep(n);
  }
  resetRobotPose();
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function throwReceipt() {
  const robotFight = state.phase === "robot";
  if (
    (state.phase !== "cashier" && !robotFight) ||
    state.bossHp <= 0 ||
    state.playerHp <= 0
  ) {
    return;
  }
  const layer = document.getElementById(
    robotFight ? "robot-shuriken-layer" : "shuriken-layer",
  );
  const origin = document.getElementById(robotFight ? "robot-launcher" : "cashier");
  const hurt = document.getElementById(robotFight ? "outdoor-hurtbox" : "player-hurtbox");
  const layerBox = layer.getBoundingClientRect();
  const hand = origin.getBoundingClientRect();
  const startX = hand.left + hand.width * (robotFight ? 0.85 : 0.72) - layerBox.left - 29;
  const startY = hand.top + hand.height * (robotFight ? 0.35 : 0.38) - layerBox.top - 29;
  const targetX = layerBox.width * (0.18 + Math.random() * 0.64) - 29;
  const targetY = layerBox.height * 0.84 - 29;
  const duration = 5600;
  const fightPhase = state.phase;

  const star = document.createElement("div");
  star.className = "receipt-star";
  star.style.left = `${startX}px`;
  star.style.top = `${startY}px`;
  layer.appendChild(star);
  if (robotFight) {
    origin.classList.add("is-firing");
    window.setTimeout(() => origin.classList.remove("is-firing"), 280);
  } else {
    origin.classList.add("is-throwing");
    window.setTimeout(() => origin.classList.remove("is-throwing"), 420);
  }
  blip(420, 0.1, "square", 0.035);

  const t0 = performance.now();
  let struck = false;
  const fly = (now) => {
    if (state.phase !== fightPhase || !star.isConnected) return;
    const p = Math.min(1, (now - t0) / duration);
    star.style.left = `${startX + (targetX - startX) * p}px`;
    star.style.top = `${startY + (targetY - startY) * p}px`;
    star.style.transform = `rotate(${p * 320}deg) scale(${0.45 + p * 0.85})`;
    if (!struck && p > 0.62 && p < 0.97) {
      if (rectsOverlap(star.getBoundingClientRect(), hurt.getBoundingClientRect())) {
        struck = true;
        hurtPlayer(
          robotFight ? ROBOT_HIT : SHURIKEN_DAMAGE,
          "영수증 표창에 맞았다",
        );
        star.remove();
        return;
      }
    }
    if (p >= 1) {
      star.remove();
      return;
    }
    requestAnimationFrame(fly);
  };
  requestAnimationFrame(fly);
}

async function swingPanStep(n) {
  const pan = document.getElementById("robot-pan");
  const hurt = document.getElementById("outdoor-hurtbox");
  pan.style.setProperty("--pan-x", `${n}cm`);
  pan.style.setProperty("--pan-rot", `${n}deg`);
  pan.classList.remove("is-swing");
  void pan.offsetWidth;
  pan.classList.add("is-swing");
  blip(80, 0.2, "sawtooth", 0.05);
  await wait(380);
  if (state.phase !== "robot" || state.playerHp <= 0) return;
  if (rectsOverlap(pan.getBoundingClientRect(), hurt.getBoundingClientRect())) {
    hurtPlayer(ROBOT_HIT, "프라이팬에 맞았다");
  }
  await wait(520);
  pan.classList.remove("is-swing");
}

function hurtPlayer(amount, reason) {
  state.playerHp = Math.max(0, state.playerHp - amount);
  updatePlayerHud();
  game.classList.add("is-shaking");
  window.setTimeout(() => game.classList.remove("is-shaking"), 280);
  const line = `${reason}. 체력 ${state.playerHp}.`;
  if (state.phase === "cashier") captions.below.textContent = line;
  else captions.outdoor.textContent = line;
  blip(200, 0.12, "sawtooth", 0.05);
  if (state.playerHp <= 0) {
    stopShurikens();
    stopRobotAttacks();
    state.phase = "dead";
    if (captions.outdoor && document.getElementById("scene-outdoor").classList.contains("is-active")) {
      captions.outdoor.textContent = "쓰러졌다.";
    } else {
      captions.below.textContent = "쓰러졌다. 계산자의 영수증이 쌓인다.";
    }
  }
}

async function walkToExit() {
  await wait(700);
  if (state.phase !== "cashier-won") return;
  document.getElementById("cashier-view").classList.add("is-walking-out");
  captions.below.textContent = "출구를 향해 걸어 나간다.";
  await wait(2200);
  if (state.phase !== "cashier-won") return;
  enterOutdoor();
}

function enterOutdoor() {
  stopChefJajang();
  state.phase = "robot";
  state.bossMax = ROBOT_MAX;
  state.bossHp = ROBOT_MAX;
  document.getElementById("cashier-view").classList.remove("is-walking-out");
  const mech = document.getElementById("mech");
  mech.classList.remove("is-hit", "is-fallen", "is-exploding");
  document.getElementById("mech-glass").classList.remove("is-shattered");
  document.getElementById("pilot-chef").classList.remove("is-ejected");
  document.getElementById("final-chef").classList.remove("is-out", "is-flying", "is-jajang");
  document.getElementById("robot-shuriken-layer").innerHTML = "";
  document.getElementById("outdoor-boss-name").textContent = "셰프 로봇";
  updateBossHud();
  updatePlayerHud();
  captions.outdoor.textContent =
    "야외다. 발사기 한 발, 관절이 오른쪽으로 한 바퀴, 프라이팬 다섯 번. 맞으면 체력 200.";
  showScene("scene-outdoor");
  startRobotAttacks();
}

async function fireAtOutdoor() {
  if (
    (state.phase !== "robot" && state.phase !== "chef-final") ||
    state.firing ||
    state.bossHp <= 0 ||
    state.playerHp <= 0
  ) {
    return;
  }
  state.firing = true;
  const shot = document.getElementById("outdoor-shot");
  shot.classList.remove("is-flying");
  void shot.offsetWidth;
  shot.classList.add("is-flying");
  blip(180, 0.12, "square", 0.06);
  window.setTimeout(() => {
    state.bossHp = Math.max(0, state.bossHp - CANNON_DAMAGE);
    updateBossHud();
    if (state.phase === "robot") {
      const mech = document.getElementById("mech");
      mech.classList.add("is-hit");
      window.setTimeout(() => mech.classList.remove("is-hit"), 180);
      if (state.bossHp <= 0) {
        beatRobot();
      } else {
        captions.outdoor.textContent = `햄버거가 맞았다. 로봇 ${state.bossHp}.`;
      }
    } else {
      const chef = document.getElementById("final-chef");
      chef.classList.add("is-hit");
      window.setTimeout(() => chef.classList.remove("is-hit"), 180);
      if (state.bossHp <= 0) {
        beatChef();
      } else {
        captions.outdoor.textContent = `햄버거가 맞았다. 셰프 ${state.bossHp}.`;
      }
    }
    state.firing = false;
    shot.classList.remove("is-flying");
  }, 420);
}

function beatRobot() {
  stopRobotAttacks();
  document.getElementById("robot-shuriken-layer").innerHTML = "";
  const mech = document.getElementById("mech");
  mech.classList.add("is-fallen");
  document.getElementById("mech-glass").classList.add("is-shattered");
  document.getElementById("pilot-chef").classList.add("is-ejected");
  captions.outdoor.textContent = "유리가 깨지며 셰프가 뛰쳐나온다. 로봇이 뒤로 넘어진다.";
  window.setTimeout(() => {
    if (state.phase !== "robot") return;
    document.getElementById("final-chef").classList.add("is-out");
    state.phase = "chef-final";
    state.bossMax = CHEF_MAX;
    state.bossHp = CHEF_MAX;
    document.getElementById("outdoor-boss-name").textContent = "셰프 제리";
    updateBossHud();
    captions.outdoor.textContent = "마지막 보스, 셰프 제리다.";
    startChefJajang();
  }, 1100);
}

function stopFireworks() {
  if (state.fireworkTimer) {
    window.clearInterval(state.fireworkTimer);
    state.fireworkTimer = 0;
  }
  const layer = document.getElementById("fireworks");
  if (layer) {
    layer.innerHTML = "";
    layer.hidden = true;
  }
  const retry = document.getElementById("btn-retry");
  if (retry) retry.hidden = true;
}

function popFireworkBurst() {
  if (state.phase !== "victory") return;
  const layer = document.getElementById("fireworks");
  if (!layer) return;
  layer.hidden = false;
  const colors = ["#ff5a5a", "#ffd24a", "#7cff7c", "#7ec8ff", "#ff8ad8", "#fff"];
  const burst = document.createElement("div");
  burst.className = "firework";
  burst.style.left = `${10 + Math.random() * 80}%`;
  burst.style.top = `${6 + Math.random() * 38}%`;
  const n = 16;
  for (let p = 0; p < n; p += 1) {
    const spark = document.createElement("span");
    spark.className = "spark";
    const ang = (p / n) * Math.PI * 2;
    const dist = 70 + Math.random() * 50;
    spark.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
    spark.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
    spark.style.background = colors[p % colors.length];
    burst.appendChild(spark);
  }
  layer.appendChild(burst);
  window.setTimeout(() => burst.remove(), 1200);
  blip(520 + Math.random() * 280, 0.18, "triangle", 0.05);
  blip(180, 0.22, "square", 0.03);
}

function startFireworks() {
  stopFireworks();
  const layer = document.getElementById("fireworks");
  layer.hidden = false;
  for (let i = 0; i < 5; i += 1) {
    window.setTimeout(popFireworkBurst, i * 160);
  }
  state.fireworkTimer = window.setInterval(popFireworkBurst, 520);
}

function stopChefJajang() {
  state.chefSeq += 1;
  document.getElementById("final-chef")?.classList.remove("is-jajang");
}

function chefFighting(seq) {
  return (
    state.phase === "chef-final" &&
    state.chefSeq === seq &&
    state.bossHp > 0 &&
    state.playerHp > 0
  );
}

async function startChefJajang() {
  stopChefJajang();
  const seq = state.chefSeq;
  while (chefFighting(seq)) {
    const chef = document.getElementById("final-chef");
    chef.classList.remove("is-jajang");
    void chef.offsetWidth;
    chef.classList.add("is-jajang");
    captions.outdoor.textContent = "눈에서 짜장국물이 쏟아진다.";
    blip(90, 0.35, "sawtooth", 0.04);
    await wait(2000);
    if (!chefFighting(seq)) return;
    chef.classList.remove("is-jajang");
    captions.outdoor.textContent = "짜장국물이 멈춘다.";
    await wait(10000);
  }
}

function restartGame() {
  stopRobotAttacks();
  stopShurikens();
  stopFireworks();
  stopChefJajang();
  heldKeys.clear();
  state.dodge = 0;
  state.firing = false;
  ["player-hurtbox", "outdoor-hurtbox"].forEach((id) => {
    const box = document.getElementById(id);
    if (box) box.style.transform = "";
  });
  game.classList.remove("is-black", "is-looking", "is-shaking");
  state.phase = "title";
  playOpening();
}

function beatChef() {
  stopChefJajang();
  state.phase = "victory";
  document.getElementById("robot-shuriken-layer").innerHTML = "";
  document.getElementById("mech").classList.add("is-exploding");
  const chef = document.getElementById("final-chef");
  chef.classList.add("is-out", "is-flying");
  captions.outdoor.textContent = "로봇이 터진다. 셰프가 하늘로 날아간다.";
  blip(40, 0.8, "sawtooth", 0.09);
  startFireworks();
  window.setTimeout(() => {
    if (state.phase !== "victory") return;
    document.getElementById("btn-retry").hidden = false;
    captions.outdoor.textContent = "축하 폭죽이 터진다.";
  }, 900);
}

function tickMove() {
  if (
    state.phase === "kitchen" ||
    state.phase === "kitchen-armed" ||
    state.phase === "kitchen-won"
  ) {
    let dx = 0;
    let dz = 0;
    if (heldKeys.has("KeyW") || heldKeys.has("ArrowUp")) dz += 0.016;
    if (heldKeys.has("KeyS") || heldKeys.has("ArrowDown")) dz -= 0.016;
    if (heldKeys.has("KeyD") || heldKeys.has("ArrowRight")) dx += 0.016;
    if (heldKeys.has("KeyA") || heldKeys.has("ArrowLeft")) dx -= 0.016;
    if (dx || dz) {
      state.kx = Math.max(-0.4, Math.min(2, state.kx + dx));
      state.kz = Math.max(0, Math.min(1.7, state.kz + dz));
      applyKitchenCam();
      if (state.phase === "kitchen" && nearCannon()) {
        captions.kitchen.textContent = "음식 대포 앞이다. 클릭하거나 E로 들어라.";
      } else if (state.phase === "kitchen-won" && nearDeepStairs()) {
        captions.kitchen.textContent = "계단 앞이다. 내려갈 수 있다.";
      }
    }
  }
  if (state.phase === "cashier" || state.phase === "robot" || state.phase === "chef-final") {
    if (heldKeys.has("KeyA") || heldKeys.has("ArrowLeft")) state.dodge = -1;
    else if (heldKeys.has("KeyD") || heldKeys.has("ArrowRight")) state.dodge = 1;
    else state.dodge = 0;
    const box = document.getElementById(
      state.phase === "cashier" ? "player-hurtbox" : "outdoor-hurtbox",
    );
    if (box) box.style.transform = `translateX(${state.dodge * 150}px)`;
  }
  requestAnimationFrame(tickMove);
}

tickMove();

document.getElementById("btn-start").addEventListener("click", () => {
  audioContext().resume();
  playOpening();
});

document.getElementById("btn-retry").addEventListener("click", (event) => {
  event.stopPropagation();
  audioContext().resume();
  restartGame();
});

document.getElementById("btn-plank").addEventListener("click", (event) => {
  event.stopPropagation();
  followPlank();
});

document.getElementById("btn-stairs").addEventListener("click", (event) => {
  event.stopPropagation();
  showStairs();
});

document.getElementById("btn-down").addEventListener("click", (event) => {
  event.stopPropagation();
  enterKitchen();
});

document.getElementById("btn-cannon").addEventListener("click", (event) => {
  event.stopPropagation();
  pickupCannon();
});

document.getElementById("btn-kitchen-stairs").addEventListener("click", (event) => {
  event.stopPropagation();
  takeDeepStairs();
});

document.getElementById("btn-deep-down").addEventListener("click", (event) => {
  event.stopPropagation();
  enterBelow();
});

window.addEventListener("keydown", (event) => {
  heldKeys.add(event.code);
  if (event.code === "KeyE") pickupCannon();
});
window.addEventListener("keyup", (event) => {
  heldKeys.delete(event.code);
});

window.addEventListener("mousemove", (event) => {
  if (state.phase === "cage") gripChainsaw();
  else aimArm(event);
});
window.addEventListener("mousedown", onPlayerInput);
window.addEventListener("keydown", onPlayerInput);
window.addEventListener(
  "wheel",
  () => {
    if (state.phase === "cage") gripChainsaw();
  },
  { passive: true },
);
