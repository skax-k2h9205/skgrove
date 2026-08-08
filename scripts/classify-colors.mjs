import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const rootStart = css.indexOf(':root {');
const rootEnd = css.indexOf('\n}', rootStart);
const body = css.slice(0, rootStart) + css.slice(rootEnd);

const counts = new Map();
for (const raw of body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
  let h = raw.slice(1).toLowerCase();
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  h = h.slice(0, 6);
  counts.set(h, (counts.get(h) ?? 0) + 1);
}

function hsl(h) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let hue;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return [((hue * 60) + 360) % 360, s * 100, l * 100];
}

// 채도가 낮은 색은 색상값과 무관하게 중립면이다. 기존 팔레트가
// 녹색을 표면에 썼기 때문에 저채도 '녹색' 이 다수 섞여 있다.
function propose(h) {
  const [hue, sat, light] = hsl(h);
  if (sat <= 18) {
    if (light >= 96) return '--color-surface';
    if (light >= 88) return '--color-page';
    if (light >= 78) return '--color-sunken';
    if (light >= 60) return '--color-border-strong';
    if (light >= 34) return '--color-muted';
    return '--color-ink';
  }
  if (light >= 88) {
    if (hue >= 85 && hue <= 175) return '--tint-moss';
    if (hue > 175 && hue <= 260) return '--tint-info';
    if (hue > 330 || hue <= 15) return '--tint-danger';
    if (hue > 15 && hue <= 45) return '--tint-clay';
    return '--tint-pending';
  }
  if (hue >= 85 && hue <= 175) return light <= 25 ? '--color-moss-strong' : '--color-moss';
  if (hue > 175 && hue <= 260) return '--color-info';
  if (hue > 330 || hue <= 15) return '--color-danger';
  if (hue > 15 && hue <= 45) return '--color-clay';
  return '--color-pending';
}

const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log('| 횟수 | 기존 | H/S/L | 제안 토큰 | 확정 |');
console.log('|---:|---|---|---|---|');
for (const [h, c] of rows) {
  const [hu, sa, li] = hsl(h).map(Math.round);
  console.log(`| ${c} | \`#${h}\` | ${hu}/${sa}/${li} | \`${propose(h)}\` | |`);
}
console.error(`총 ${rows.length}색 / ${[...counts.values()].reduce((a, b) => a + b, 0)}회`);
