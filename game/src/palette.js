// Cinderworks palette: a dusk industrial yard — cold steel, amber hazard light,
// teal team accents. One place owns every colour; the CSS in index.html mirrors
// the same six names, and no other colour literal appears in the game code.
export const PALETTE = {
  canvas: '#2a2118',
  surface: '#38302a',
  hairline: '#4d4234',
  ink: '#ece5d8',
  muted: '#a89a83',
  accent: '#f08a1d',
  ember: '#e2481f',
  amberTeam: '#f0a830',
  tealTeam: '#2fa8a0',
};

export function shade(name) {
  return PALETTE[name];
}
