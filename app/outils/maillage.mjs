// Fabrication de maillages : surface d'un champ de distance (marching cubes), tubes et feuillets de valvule.
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';
import { add, sub, mul, dot, cross, norm, gradient } from './sdf.mjs';

// Coins et arêtes du cube dans la convention des tables.
const COINS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
// Chaque arête : [coin de départ, axe]
const ARETES = [[0, 0], [1, 1], [3, 0], [0, 1], [4, 0], [5, 1], [7, 0], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2]];

export function mailler(f, lo, hi, cellule) {
  const nx = Math.ceil((hi[0] - lo[0]) / cellule);
  const ny = Math.ceil((hi[1] - lo[1]) / cellule);
  const nz = Math.ceil((hi[2] - lo[2]) / cellule);
  const sx = nx + 1, sy = ny + 1, sz = nz + 1;
  const champ = new Float32Array(sx * sy * sz);
  for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) {
    champ[i + sx * (j + sy * k)] = f([lo[0] + i * cellule, lo[1] + j * cellule, lo[2] + k * cellule]);
  }

  const positions = [];
  const cache = new Map();
  const pas = [1, sx, sx * sy];
  const sommet = (i, j, k, axe) => {
    const q = i + sx * (j + sy * k);
    const cle = q * 3 + axe;
    let idx = cache.get(cle);
    if (idx !== undefined) return idx;
    const a = champ[q], b = champ[q + pas[axe]];
    const t = a / (a - b);
    const p = [lo[0] + i * cellule, lo[1] + j * cellule, lo[2] + k * cellule];
    p[axe] += t * cellule;
    idx = positions.length / 3;
    positions.push(p[0], p[1], p[2]);
    cache.set(cle, idx);
    return idx;
  };

  const tris = [];
  const ar = new Array(12);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let cas = 0;
    for (let c = 0; c < 8; c++) {
      const o = COINS[c];
      if (champ[i + o[0] + sx * (j + o[1] + sy * (k + o[2]))] < 0) cas |= 1 << c;
    }
    const bits = edgeTable[cas];
    if (bits === 0) continue;
    for (let e = 0; e < 12; e++) {
      if (bits & (1 << e)) {
        const o = COINS[ARETES[e][0]];
        ar[e] = sommet(i + o[0], j + o[1], k + o[2], ARETES[e][1]);
      }
    }
    for (let t = cas * 16; triTable[t] !== -1; t += 3) {
      const a = ar[triTable[t]], b = ar[triTable[t + 1]], c = ar[triTable[t + 2]];
      if (a !== b && b !== c && a !== c) tris.push(a, b, c);
    }
  }

  const nv = positions.length / 3;
  const normales = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) {
    const g = gradient(f, [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]], cellule * 0.35);
    normales[v * 3] = g[0]; normales[v * 3 + 1] = g[1]; normales[v * 3 + 2] = g[2];
  }
  // Oriente chaque triangle vers l'extérieur (dans le sens du gradient).
  const P = (v) => [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]];
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    const n = cross(sub(P(b), P(a)), sub(P(c), P(a)));
    const s = n[0] * (normales[a * 3] + normales[b * 3] + normales[c * 3])
      + n[1] * (normales[a * 3 + 1] + normales[b * 3 + 1] + normales[c * 3 + 1])
      + n[2] * (normales[a * 3 + 2] + normales[b * 3 + 2] + normales[c * 3 + 2]);
    if (s < 0) { tris[t + 1] = c; tris[t + 2] = b; }
  }
  return { positions: new Float32Array(positions), normales, indices: new Uint32Array(tris) };
}

// Boîte englobante d'un champ, trouvée par balayage grossier.
export function boite(f, lo, hi, pas = 0.3, seuil = 0.36) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let z = lo[2]; z <= hi[2]; z += pas) for (let y = lo[1]; y <= hi[1]; y += pas) for (let x = lo[0]; x <= hi[0]; x += pas) {
    if (f([x, y, z]) < seuil) {
      if (x < mn[0]) mn[0] = x; if (y < mn[1]) mn[1] = y; if (z < mn[2]) mn[2] = z;
      if (x > mx[0]) mx[0] = x; if (y > mx[1]) mx[1] = y; if (z > mx[2]) mx[2] = z;
    }
  }
  if (!isFinite(mn[0])) return null;
  const m = pas + 0.1;
  return { lo: [mn[0] - m, mn[1] - m, mn[2] - m], hi: [mx[0] + m, mx[1] + m, mx[2] + m] };
}

// Tube fermé le long d'une suite de points (rayon par point).
export function maillerTube(pts, rs, cotes = 8) {
  const n = pts.length;
  const positions = [], normales = [], indices = [];
  const tang = (i) => norm(sub(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]));
  let T = tang(0);
  let N = norm(cross(T, Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  for (let i = 0; i < n; i++) {
    T = tang(i);
    N = norm(sub(N, mul(T, dot(N, T))));
    const B = cross(T, N);
    for (let j = 0; j < cotes; j++) {
      const a = (j / cotes) * Math.PI * 2;
      const r = add(mul(N, Math.cos(a)), mul(B, Math.sin(a)));
      const p = add(pts[i], mul(r, rs[i]));
      positions.push(p[0], p[1], p[2]);
      normales.push(r[0], r[1], r[2]);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < cotes; j++) {
    const j1 = (j + 1) % cotes;
    const a = i * cotes + j, b = i * cotes + j1, c = (i + 1) * cotes + j, d = (i + 1) * cotes + j1;
    indices.push(a, b, c, b, d, c);
  }
  const t0 = tang(0), t1 = tang(n - 1);
  const s = positions.length / 3;
  positions.push(...pts[0]); normales.push(-t0[0], -t0[1], -t0[2]);
  positions.push(...pts[n - 1]); normales.push(t1[0], t1[1], t1[2]);
  for (let j = 0; j < cotes; j++) {
    const j1 = (j + 1) % cotes;
    indices.push(s, j1, j);
    indices.push(s + 1, (n - 1) * cotes + j, (n - 1) * cotes + j1);
  }
  return { positions: new Float32Array(positions), normales: new Float32Array(normales), indices: new Uint32Array(indices) };
}

export function fusionner(maillages) {
  let nv = 0, ni = 0;
  for (const m of maillages) { nv += m.positions.length / 3; ni += m.indices.length; }
  const positions = new Float32Array(nv * 3), normales = new Float32Array(nv * 3), indices = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const m of maillages) {
    positions.set(m.positions, ov * 3);
    normales.set(m.normales, ov * 3);
    for (let i = 0; i < m.indices.length; i++) indices[oi + i] = m.indices[i] + ov;
    ov += m.positions.length / 3;
    oi += m.indices.length;
  }
  return { positions, normales, indices };
}

export function normalesDepuisTriangles(positions, indices) {
  const n = new Float32Array(positions.length);
  const P = (v) => [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]];
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    const fn = cross(sub(P(b), P(a)), sub(P(c), P(a)));
    for (const v of [a, b, c]) { n[v * 3] += fn[0]; n[v * 3 + 1] += fn[1]; n[v * 3 + 2] += fn[2]; }
  }
  for (let v = 0; v < n.length / 3; v++) {
    const l = Math.hypot(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]) || 1;
    n[v * 3] /= l; n[v * 3 + 1] /= l; n[v * 3 + 2] /= l;
  }
  return n;
}

// Feuillets d'une valvule : `nombre` lames attachées sur un anneau, qui pendent le long de `axe`.
// fermeture = 0 : lames plaquées contre la paroi (valvule ouverte) ; 1 : lames jointes au centre (fermée).
export function maillerValvule({ centre, axe, rayon, longueur, nombre, fermeture, nu = 9, ns = 7 }) {
  const A = norm(axe);
  const U = norm(cross(A, Math.abs(A[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const W = cross(A, U);
  const positions = [], indices = [];
  const etendue = ((Math.PI * 2) / nombre) * 0.93;
  for (let k = 0; k < nombre; k++) {
    const a0 = (k / nombre) * Math.PI * 2 + 0.4;
    const base = positions.length / 3;
    for (let is = 0; is <= ns; is++) for (let iu = 0; iu <= nu; iu++) {
      const u = iu / nu, s = is / ns;
      const bord = 1 - Math.pow(Math.abs(u * 2 - 1), 2.2) * 0.22 * (1 - fermeture);
      const sl = s * bord;
      const a = a0 + u * etendue;
      const rad = rayon * (1 - fermeture * Math.pow(sl, 0.85) * 0.985);
      const h = longueur * sl * (1 - 0.45 * fermeture);
      const p = add(add(centre, mul(A, h)), add(mul(U, Math.cos(a) * rad), mul(W, Math.sin(a) * rad)));
      positions.push(p[0], p[1], p[2]);
    }
    for (let is = 0; is < ns; is++) for (let iu = 0; iu < nu; iu++) {
      const a = base + is * (nu + 1) + iu, b = a + 1, c = a + (nu + 1), d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const pos = new Float32Array(positions), ind = new Uint32Array(indices);
  return { positions: pos, normales: normalesDepuisTriangles(pos, ind), indices: ind };
}
