// Rounds: the match state machine. One place owns the clock, the score, the
// credits, the bomb and every round transition, so main.js never branches on
// round logic inline.
// Phases: 'buy' (15 s, shop open, frozen spawns) -> 'live' (100 s) -> 'over'
// (4 s banner, then next buy or match end). First team to 5 round wins takes
// the match. Cobalt plants the bomb; if it explodes, Cobalt wins the round.
// If Amber defuses, Amber wins. Eliminating the other team wins at once,
// unless the bomb is planted — then Amber must defuse before it blows.
export const BUY_SECONDS = 15;
export const ROUND_SECONDS = 100;
export const BOMB_SECONDS = 35;
export const PLANT_SECONDS = 3;
export const DEFUSE_SECONDS = 5;
export const WIN_ROUNDS = 5;
export const ROUND_WIN_CREDITS = 900;
export const ROUND_LOSE_CREDITS = 500;
export const KILL_CREDITS = 150;
export const PLANT_CREDITS = 300;

export function createRounds() {
  const state = {
    phase: 'buy',
    phaseLeft: BUY_SECONDS,
    round: 1,
    score: { amber: 0, cobalt: 0 },
    credits: 1000,
    kills: 0,
    bomb: { planted: false, site: null, timer: 0, plantProgress: 0, defuseProgress: 0 },
    lastResult: null,
    matchOver: false,
    matchWinner: null,
  };

  function startRound() {
    state.phase = 'live';
    state.phaseLeft = ROUND_SECONDS;
    state.bomb.planted = false;
    state.bomb.site = null;
    state.bomb.timer = 0;
    state.bomb.plantProgress = 0;
    state.bomb.defuseProgress = 0;
  }

  function endRound(winner, reason) {
    if (state.phase === 'over') return;
    state.phase = 'over';
    state.phaseLeft = 4;
    state.score[winner] += 1;
    state.lastResult = { winner, reason, round: state.round };
    state.credits += winner === 'amber' ? ROUND_WIN_CREDITS : ROUND_LOSE_CREDITS;
    if (state.score[winner] >= WIN_ROUNDS) {
      state.matchOver = true;
      state.matchWinner = winner;
    }
  }

  function nextRound() {
    if (state.matchOver) return;
    state.round += 1;
    state.phase = 'buy';
    state.phaseLeft = BUY_SECONDS;
    state.bomb.planted = false;
    state.bomb.site = null;
    state.bomb.timer = 0;
    state.bomb.plantProgress = 0;
    state.bomb.defuseProgress = 0;
    state.lastResult = null;
  }

  function step(dt) {
    if (state.phase === 'over') {
      state.phaseLeft -= dt;
      if (state.phaseLeft <= 0) nextRound();
      return;
    }
    if (state.phase === 'buy') {
      state.phaseLeft -= dt;
      if (state.phaseLeft <= 0) startRound();
      return;
    }
    // live
    state.phaseLeft -= dt;
    if (state.bomb.planted) {
      state.bomb.timer -= dt;
      if (state.bomb.timer <= 0) endRound('cobalt', 'The charge detonated at Site ' + state.bomb.site + '.');
    } else if (state.phaseLeft <= 0) {
      endRound('amber', 'Time expired — Amber held the yard.');
    }
  }

  return {
    state,
    startRound,
    endRound,
    nextRound,
    step,
    plantBomb(site) {
      state.bomb.planted = true;
      state.bomb.site = site;
      state.bomb.timer = BOMB_SECONDS;
      state.bomb.defuseProgress = 0;
    },
    addKillCredits() { state.credits += KILL_CREDITS; },
    addPlantCredits() { state.credits += PLANT_CREDITS; },
    spend(amount) {
      if (state.credits < amount) return false;
      state.credits -= amount;
      return true;
    },
    resetMatch() {
      state.phase = 'buy';
      state.phaseLeft = BUY_SECONDS;
      state.round = 1;
      state.score.amber = 0;
      state.score.cobalt = 0;
      state.credits = 1000;
      state.kills = 0;
      state.bomb.planted = false;
      state.bomb.site = null;
      state.bomb.timer = 0;
      state.lastResult = null;
      state.matchOver = false;
      state.matchWinner = null;
    },
  };
}
