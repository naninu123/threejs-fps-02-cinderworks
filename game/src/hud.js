// The DOM HUD: crosshair, hit marker, health, ammo, round timer, score,
// credits, team counts, kill feed, bomb status, buy menu and the overlay
// panel. It never touches the simulation; main.js pushes numbers in and
// reads callbacks out. Every setter caches its last value so the DOM is
// only touched when something actually changes.
const COPY = {
  start: {
    title: 'Cinderworks',
    copy: 'Amber vs Cobalt, first to 5 rounds. Plant the charge or wipe the other team. Click to play.',
    action: 'Click to play',
  },
  paused: {
    title: 'Cinderworks',
    copy: 'Paused. Click to resume.',
    action: 'Click to resume',
  },
  dead: {
    title: 'You are down',
    copy: 'Your squad fights on. Spectate until the round ends.',
    action: 'Keep watching',
  },
  match: {
    title: 'Match over',
    copy: 'The yard is decided.',
    action: 'Play again',
  },
};

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const title = $('overlay-title');
  const copy = $('overlay-copy');
  const play = $('play');
  const ammo = $('ammo');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const weaponName = $('weapon-name');
  const healthValue = $('health-value');
  const healthBar = $('health-bar');
  const timerValue = $('timer-value');
  const scoreAmber = $('score-amber');
  const scoreCobalt = $('score-cobalt');
  const creditsValue = $('credits-value');
  const aliveAmber = $('alive-amber');
  const aliveCobalt = $('alive-cobalt');
  const roundLabel = $('round-label');
  const bombStatus = $('bomb-status');
  const killfeed = $('killfeed');
  const banner = $('banner');
  const buyMenu = $('buy-menu');
  const buyCredits = $('buy-credits');
  const grenadeCount = $('grenade-count');
  const hitmarker = $('hitmarker');
  let hitTimer = 0;
  let bannerTimer = 0;
  const last = {};

  function setText(el, key, value) {
    if (last[key] === value) return;
    last[key] = value;
    el.textContent = value;
  }

  return {
    setAmmo(mag, reserve, name) {
      setText(ammoMag, 'mag', String(mag));
      setText(ammoReserve, 'reserve', `/ ${reserve}`);
      setText(weaponName, 'weapon', name);
      ammo.classList.toggle('empty', mag === 0);
    },
    setHealth(value) {
      setText(healthValue, 'health', String(value));
      healthBar.style.width = `${Math.max(0, value)}%`;
      healthBar.classList.toggle('low', value <= 30);
    },
    setTimer(seconds, phase) {
      const s = Math.max(0, Math.ceil(seconds));
      const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      setText(timerValue, 'timer', text);
      timerValue.classList.toggle('bomb', phase === 'bomb');
    },
    setScore(amber, cobalt) {
      setText(scoreAmber, 'sa', String(amber));
      setText(scoreCobalt, 'sc', String(cobalt));
    },
    setCredits(value) {
      setText(creditsValue, 'credits', `$${value}`);
      setText(buyCredits, 'buycredits', `$${value}`);
    },
    setAlive(amber, cobalt) {
      setText(aliveAmber, 'aa', `Amber ${amber}`);
      setText(aliveCobalt, 'ac', `Cobalt ${cobalt}`);
    },
    setRound(round) { setText(roundLabel, 'round', `ROUND ${round}`); },
    setGrenades(n) { setText(grenadeCount, 'gren', `◉ ${n}`); },
    setBomb(text) { setText(bombStatus, 'bomb', text); },
    killfeed(text) {
      const line = document.createElement('div');
      line.textContent = text;
      killfeed.prepend(line);
      while (killfeed.children.length > 5) killfeed.removeChild(killfeed.lastChild);
      setTimeout(() => line.remove(), 6000);
    },
    banner(text, holdMs = 2600) {
      banner.textContent = text;
      banner.classList.add('on');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => banner.classList.remove('on'), holdMs);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        hitmarker.classList.remove('on');
        hitmarker.style.transform = '';
      }, holdMs);
    },
    showBuy(show) { buyMenu.hidden = !show; },
    onBuy(handler) {
      buyMenu.querySelectorAll('[data-buy]').forEach((button) => {
        button.addEventListener('click', () => handler(button.dataset.buy));
      });
    },
    showOverlay(mode, detail) {
      const text = COPY[mode];
      title.textContent = text.title;
      copy.textContent = detail || text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() { overlay.hidden = true; },
    onPlay(handler) { play.addEventListener('click', handler); },
  };
}
