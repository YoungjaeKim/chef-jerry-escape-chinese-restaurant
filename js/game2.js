const wait = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const PLAYER_MAX = 5000;
const GIANT_MAX = 5;
const GIANT_HIT = 300;
const CHEF_PUNCH = 500;

const game = document.getElementById("game");
const caption = document.getElementById("opening-caption");
const cavernCaption = document.getElementById("cavern-caption");
const arenaCaption = document.getElementById("arena-caption");
const retry = document.getElementById("btn-retry");
const hallExit = document.getElementById("btn-hall-exit");
const retryEnd = document.getElementById("btn-retry-end");
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

const state = {
  phase: "title",
  kx: 0,
  kz: 0,
  dodge: 0,
  armed: false,
  firing: false,
  hunt: false,
  skAlive: [true, true, true],
  playerHp: PLAYER_MAX,
  giantHp: GIANT_MAX,
  punchLane: 0,
};

let fireworkTimer = 0;
let punchTimer = 0;
let chefSeq = 0;
let openingLock = false;

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

function blip(freq, dur, type, gain) {
  const ac = audioContext();
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function fireworksLayer() {
  const arena = document.getElementById("scene-arena");
  if (arena && arena.classList.contains("is-active")) {
    return document.getElementById("arena-fireworks");
  }
  return document.getElementById("fireworks");
}

function stopFireworks() {
  if (fireworkTimer) {
    window.clearInterval(fireworkTimer);
    fireworkTimer = 0;
  }
  ["fireworks", "arena-fireworks"].forEach((id) => {
    const layer = document.getElementById(id);
    if (layer) {
      layer.innerHTML = "";
      layer.hidden = true;
    }
  });
}

function popFireworkBurst() {
  const layer = fireworksLayer();
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
  const layer = fireworksLayer();
  if (layer) layer.hidden = false;
  for (let i = 0; i < 5; i += 1) {
    window.setTimeout(popFireworkBurst, i * 160);
  }
  fireworkTimer = window.setInterval(popFireworkBurst, 520);
}

function applyCavernCam() {
  const world = document.getElementById("cavern-world");
  world.classList.toggle("is-inside", inHall());
  world.style.transform = `translate3d(${-state.kx * 48}vw, ${state.kz * 6}vh, ${state.kz * 420}px)`;
}

function inHall() {
  return state.kz >= 0.55;
}

function nearBow() {
  return state.kz > 0.72 && state.kz < 1.35 && state.kx > 0.12;
}

function setCavernLine(text) {
  cavernCaption.textContent = text;
}

function setArenaLine(text) {
  arenaCaption.textContent = text;
}

function updateArenaHud() {
  const pFill = document.getElementById("arena-player-fill");
  const pText = document.getElementById("arena-player-text");
  if (pFill) pFill.style.transform = `scaleX(${Math.max(state.playerHp, 0) / PLAYER_MAX})`;
  if (pText) pText.textContent = `${Math.max(state.playerHp, 0)} / ${PLAYER_MAX}`;
  const bFill = document.getElementById("arena-boss-fill");
  const bText = document.getElementById("arena-boss-text");
  const max = state.phase === "chef" || state.phase === "victory" ? 5 : GIANT_MAX;
  const hp = state.phase === "chef" || state.phase === "victory" ? Math.max(5 - chefSeq, 0) : state.giantHp;
  if (bFill) bFill.style.transform = `scaleX(${Math.max(hp, 0) / max})`;
  if (bText) {
    if (state.phase === "chef") bText.textContent = "짜장 5회";
    else if (state.phase === "victory") bText.textContent = "0 / 5";
    else bText.textContent = `${Math.max(state.giantHp, 0)} / ${GIANT_MAX}`;
  }
}

function clearPunchHot() {
  document.querySelectorAll(".punch-zone").forEach((zone) => zone.classList.remove("is-hot"));
}

function stopGiantPunches() {
  if (punchTimer) {
    window.clearTimeout(punchTimer);
    punchTimer = 0;
  }
  const giant = document.getElementById("giant-sk");
  giant.classList.remove("is-punch", "is-hit");
  clearPunchHot();
}

function enterCavern() {
  game.classList.remove("is-black");
  state.phase = "land";
  state.kx = 0;
  state.kz = 0;
  state.dodge = 0;
  state.armed = false;
  state.firing = false;
  state.hunt = false;
  state.skAlive = [true, true, true];
  hallExit.hidden = true;
  document.getElementById("btn-bow").classList.remove("is-gone");
  document.getElementById("held-bow").classList.remove("is-held");
  document.getElementById("arrow-shot").classList.remove("is-flying");
  document.querySelectorAll("#cavern-world .skeleton").forEach((sk) => {
    sk.classList.remove("is-hunt", "is-near", "is-shatter", "is-gone");
  });
  applyCavernCam();
  setCavernLine("떨어지다 멈췄다. 앞에 통로가 있다. WASD로 걸어가라.");
  showScene("scene-cavern");
  blip(110, 0.28, "triangle", 0.04);
}

function pickupBow() {
  if (state.phase !== "land" && state.phase !== "hall") return;
  if (state.armed) return;
  if (!nearBow()) {
    if (inHall()) setCavernLine("활은 옆에 있다. WASD로 가까이 가라.");
    return;
  }
  state.armed = true;
  state.hunt = true;
  state.phase = "armed";
  document.getElementById("btn-bow").classList.add("is-gone");
  document.getElementById("held-bow").classList.add("is-held");
  document.querySelectorAll("#cavern-world .skeleton").forEach((sk, i) => {
    if (!state.skAlive[i]) return;
    sk.classList.add("is-hunt");
  });
  setCavernLine("활을 들었다. 해골이 다가온다. 클릭하면 쏜다.");
  blip(160, 0.18, "square", 0.05);
  window.setTimeout(() => {
    if (!state.hunt) return;
    document.querySelectorAll("#cavern-world .skeleton").forEach((sk, i) => {
      if (!state.skAlive[i]) return;
      sk.classList.add("is-near");
    });
  }, 700);
}

function shatterSkeleton(index) {
  if (!state.skAlive[index]) return;
  state.skAlive[index] = false;
  const sk = document.getElementById(`sk-${index}`);
  sk.classList.remove("is-hunt");
  sk.classList.add("is-shatter");
  blip(90, 0.22, "sawtooth", 0.06);
  blip(240, 0.18, "triangle", 0.04);
  window.setTimeout(() => {
    sk.classList.add("is-gone");
  }, 700);
  const left = state.skAlive.filter(Boolean).length;
  if (left === 0) {
    state.hunt = false;
    state.phase = "cleared";
    setCavernLine("해골이 조각나 사라졌다. 출구가 열렸다.");
    hallExit.hidden = false;
  } else {
    setCavernLine(`해골이 조각난다. 남은 해골 ${left}.`);
  }
}

function fireHallBow() {
  if (state.phase !== "armed") return;
  if (state.firing) return;
  state.firing = true;
  const shot = document.getElementById("arrow-shot");
  shot.classList.remove("is-flying");
  void shot.offsetWidth;
  shot.classList.add("is-flying");
  blip(420, 0.12, "square", 0.04);
  window.setTimeout(() => {
    const target = [1, 0, 2].find((i) => state.skAlive[i]);
    if (target !== undefined) shatterSkeleton(target);
    state.firing = false;
    shot.classList.remove("is-flying");
  }, 280);
}

function hurtPlayer(amount, reason) {
  if (state.playerHp <= 0) return;
  state.playerHp = Math.max(0, state.playerHp - amount);
  updateArenaHud();
  setArenaLine(`${reason} 체력 ${state.playerHp}.`);
  game.classList.add("is-shaking");
  window.setTimeout(() => game.classList.remove("is-shaking"), 280);
  blip(70, 0.28, "sawtooth", 0.06);
  if (state.playerHp <= 0) {
    state.phase = "dead";
    stopGiantPunches();
    chefSeq += 1;
    setArenaLine("쓰러졌다.");
    retryEnd.hidden = false;
  }
}

async function giantPunchOnce() {
  if (state.phase !== "giant" || state.playerHp <= 0) return;
  const lanes = [-1, 0, 1];
  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  state.punchLane = lane;
  clearPunchHot();
  const zone = document.querySelector(`.punch-zone[data-lane="${lane}"]`);
  if (zone) zone.classList.add("is-hot");
  setArenaLine("빨간 바닥에 펀치가 떨어진다. A·D로 피하라.");
  await wait(800);
  if (state.phase !== "giant" || state.playerHp <= 0) return;
  const giant = document.getElementById("giant-sk");
  giant.classList.remove("is-punch");
  void giant.offsetWidth;
  giant.classList.add("is-punch");
  blip(50, 0.28, "square", 0.07);
  await wait(220);
  if (state.phase !== "giant" || state.playerHp <= 0) return;
  if (state.dodge === lane) {
    hurtPlayer(GIANT_HIT, "펀치에 맞았다.");
  }
  await wait(280);
  giant.classList.remove("is-punch");
  clearPunchHot();
}

function loopGiantPunches() {
  stopGiantPunches();
  const run = async () => {
    if (state.phase !== "giant" || state.playerHp <= 0) return;
    await giantPunchOnce();
    if (state.phase !== "giant" || state.playerHp <= 0) return;
    punchTimer = window.setTimeout(run, 700);
  };
  punchTimer = window.setTimeout(run, 600);
}

function enterArena() {
  hallExit.hidden = true;
  retryEnd.hidden = true;
  stopGiantPunches();
  stopFireworks();
  chefSeq += 1;
  state.phase = "giant";
  state.playerHp = PLAYER_MAX;
  state.giantHp = GIANT_MAX;
  state.dodge = 0;
  state.firing = false;
  document.getElementById("arena-boss-name").textContent = "거대해골";
  const giant = document.getElementById("giant-sk");
  giant.classList.remove("is-down", "is-hit", "is-punch");
  const chef = document.getElementById("arena-chef");
  chef.classList.remove("is-out", "is-dropping", "is-smash", "is-jajang", "is-down", "is-flying");
  document.getElementById("arena-view").classList.remove("is-walking-out", "is-to-exit");
  document.getElementById("arena-hurtbox").style.transform = "";
  updateArenaHud();
  setArenaLine("셰프와 싸웠던 곳이다. 거대해골이 펀치만 날린다. 클릭으로 활을 쏴라.");
  showScene("scene-arena");
  loopGiantPunches();
}

function fireArenaBow() {
  if (state.phase !== "giant") return;
  if (state.firing || state.giantHp <= 0 || state.playerHp <= 0) return;
  state.firing = true;
  const shot = document.getElementById("arena-arrow");
  shot.classList.remove("is-flying");
  void shot.offsetWidth;
  shot.classList.add("is-flying");
  blip(420, 0.12, "square", 0.04);
  window.setTimeout(() => {
    if (state.phase === "giant" && state.giantHp > 0) {
      state.giantHp -= 1;
      const giant = document.getElementById("giant-sk");
      giant.classList.add("is-hit");
      window.setTimeout(() => giant.classList.remove("is-hit"), 160);
      updateArenaHud();
      setArenaLine(`화살이 꽂혔다. 거대해골 ${state.giantHp}.`);
      if (state.giantHp <= 0) beatGiant();
    }
    state.firing = false;
    shot.classList.remove("is-flying");
  }, 280);
}

async function beatGiant() {
  stopGiantPunches();
  const giant = document.getElementById("giant-sk");
  giant.classList.add("is-down");
  setArenaLine("거대해골이 쓰러졌다. 출구로 간다.");
  document.getElementById("arena-view").classList.add("is-to-exit", "is-walking-out");
  blip(80, 0.4, "triangle", 0.05);
  state.phase = "to-exit";
  await wait(1800);
  if (state.phase !== "to-exit") return;
  startChefAmbush();
}

async function startChefAmbush() {
  if (state.playerHp <= 0) return;
  state.phase = "chef";
  chefSeq += 1;
  const seq = chefSeq;
  document.getElementById("arena-boss-name").textContent = "셰프 제리";
  updateArenaHud();
  const chef = document.getElementById("arena-chef");
  chef.classList.remove("is-down", "is-jajang", "is-smash");
  chef.classList.add("is-out", "is-dropping");
  setArenaLine("출구 앞에서 셰프가 하늘에서 떨어진다.");
  blip(40, 0.5, "sawtooth", 0.07);
  await wait(700);
  if (seq !== chefSeq || state.phase !== "chef") return;

  const lanes = [-1, 0, 1];
  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  state.punchLane = lane;
  clearPunchHot();
  const zone = document.querySelector(`.punch-zone[data-lane="${lane}"]`);
  if (zone) zone.classList.add("is-hot");
  setArenaLine("아주 쌘 펀치다. 빨간 바닥을 피해라.");
  await wait(700);
  if (seq !== chefSeq || state.phase !== "chef") return;
  chef.classList.add("is-smash");
  blip(36, 0.45, "square", 0.09);
  await wait(200);
  if (seq !== chefSeq || state.phase !== "chef") return;
  if (state.dodge === lane) {
    hurtPlayer(CHEF_PUNCH, "셰프의 펀치에 맞았다.");
  } else {
    setArenaLine("펀치를 피했다.");
  }
  clearPunchHot();
  await wait(500);
  if (seq !== chefSeq || state.playerHp <= 0) return;

  for (let i = 0; i < 5; i += 1) {
    if (seq !== chefSeq || state.playerHp <= 0) return;
    chef.classList.remove("is-jajang");
    void chef.offsetWidth;
    chef.classList.add("is-jajang");
    setArenaLine(`눈에서 짜장국물이 쏟아진다. (${i + 1} / 5)`);
    blip(90, 0.35, "sawtooth", 0.04);
    await wait(2000);
  }
  if (seq !== chefSeq || state.playerHp <= 0) return;
  chef.classList.remove("is-jajang", "is-smash");
  chef.classList.add("is-down");
  state.phase = "victory";
  setArenaLine("셰프가 쓰러진다. 축하 폭죽이 터진다.");
  startFireworks();
  retryEnd.hidden = false;
}

function restartGame() {
  stopGiantPunches();
  stopFireworks();
  chefSeq += 1;
  openingLock = false;
  retryEnd.hidden = true;
  hallExit.hidden = true;
  retry.hidden = true;
  playOpening();
}

function tickMove() {
  if (state.phase === "land" || state.phase === "hall" || state.phase === "armed" || state.phase === "cleared") {
    let dx = 0;
    let dz = 0;
    if (heldKeys.has("KeyW") || heldKeys.has("ArrowUp")) dz += 0.014;
    if (heldKeys.has("KeyS") || heldKeys.has("ArrowDown")) dz -= 0.014;
    if (heldKeys.has("KeyD") || heldKeys.has("ArrowRight")) dx += 0.014;
    if (heldKeys.has("KeyA") || heldKeys.has("ArrowLeft")) dx -= 0.014;
    if (dx || dz) {
      state.kx = Math.max(-0.42, Math.min(0.55, state.kx + dx));
      state.kz = Math.max(0, Math.min(1.7, state.kz + dz));
      applyCavernCam();
      if (!state.armed) {
        if (inHall() && state.phase === "land") {
          state.phase = "hall";
          setCavernLine("긴 복도다. 큰 해골 셋, 옆에 활이 있다.");
        } else if (nearBow()) {
          setCavernLine("활 앞이다. 클릭하거나 E로 들어라.");
        }
      }
    }
  }
  if (state.phase === "giant" || state.phase === "chef") {
    if (heldKeys.has("KeyA") || heldKeys.has("ArrowLeft")) state.dodge = -1;
    else if (heldKeys.has("KeyD") || heldKeys.has("ArrowRight")) state.dodge = 1;
    else state.dodge = 0;
    const box = document.getElementById("arena-hurtbox");
    if (box) box.style.transform = `translateX(${state.dodge * 150}px)`;
  }
  requestAnimationFrame(tickMove);
}

async function playOpening() {
  if (openingLock) return;
  openingLock = true;

  const view = document.getElementById("opening-view");
  const worldGround = document.getElementById("outdoor-ground");
  const mech = document.getElementById("mech");
  const chef = document.getElementById("final-chef");

  showScene("scene-opening");
  retry.hidden = true;
  retryEnd.hidden = true;
  view.classList.remove("is-falling");
  worldGround.classList.remove("is-cracking", "is-open");
  game.classList.remove("is-black", "is-shaking");
  chef.classList.remove("is-out", "is-flying");
  mech.classList.remove("is-exploding");
  void chef.offsetWidth;
  void mech.offsetWidth;

  mech.classList.add("is-exploding");
  chef.classList.add("is-out", "is-flying");
  caption.textContent = "로봇이 터진다. 셰프가 하늘로 날아간다.";
  blip(40, 0.8, "sawtooth", 0.09);
  startFireworks();

  await wait(900);
  retry.hidden = false;
  caption.textContent = "축하 폭죽이 터진다.";
  await wait(3000);

  retry.hidden = true;
  stopFireworks();
  caption.textContent = "발밑 바닥이 갈라진다.";
  worldGround.classList.add("is-cracking");
  blip(70, 0.35, "square", 0.05);
  await wait(700);

  worldGround.classList.add("is-open");
  caption.textContent = "바닥이 열린다.";
  blip(40, 0.9, "sawtooth", 0.07);
  await wait(900);

  view.classList.add("is-falling");
  caption.textContent = "떨어진다.";
  blip(90, 0.4, "triangle", 0.04);
  await wait(5000);

  enterCavern();
}

document.getElementById("btn-start").addEventListener("click", () => {
  audioContext().resume();
  playOpening();
});

if (new URLSearchParams(location.search).get("continue") === "1") {
  audioContext().resume();
  playOpening();
}

retry.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
});

hallExit.addEventListener("click", (event) => {
  event.stopPropagation();
  audioContext().resume();
  enterArena();
});

retryEnd.addEventListener("click", (event) => {
  event.stopPropagation();
  audioContext().resume();
  restartGame();
});

document.getElementById("btn-bow").addEventListener("click", (event) => {
  event.stopPropagation();
  audioContext().resume();
  pickupBow();
});

window.addEventListener("keydown", (event) => {
  heldKeys.add(event.code);
  if (MOVE_CODES.has(event.code)) event.preventDefault();
  if (event.code === "KeyE") pickupBow();
});

window.addEventListener("keyup", (event) => {
  heldKeys.delete(event.code);
});

window.addEventListener("mousedown", () => {
  if (state.phase === "armed") fireHallBow();
  else if (state.phase === "giant") fireArenaBow();
  else pickupBow();
});

tickMove();
