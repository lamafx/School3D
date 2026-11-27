// Champs de distance signée (SDF) : briques de base pour sculpter le cœur provisoire.
// Convention : un point est un tableau [x, y, z] en centimètres ; distance négative = à l'intérieur.

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// Union et intersection adoucies (rayon de raccord k).
export const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smax = (a, b, k) => -smin(-a, -b, k);

export const sdSphere = (p, c, r) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r;

export function sdEllipsoid(p, c, r) {
  const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
  const k0 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  if (k0 < 1e-6) return -Math.min(r[0], r[1], r[2]);
  const k1 = Math.hypot(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
  return (k0 * (k0 - 1)) / k1;
}

// Cône arrondi entre deux sphères (a, r1) et (b, r2).
export function sdRoundCone(p, a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const pax = p[0] - a[0], pay = p[1] - a[1], paz = p[2] - a[2];
  if (l2 < 1e-9) return Math.hypot(pax, pay, paz) - Math.max(r1, r2);
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

// Courbe lissée (Catmull-Rom) passant par des points de contrôle, avec rayon interpolé.
export function lisser(points, rayons, parSegment = 6) {
  const n = points.length;
  const P = (i) => points[clamp(i, 0, n - 1)];
  const pts = [], rs = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < parSegment; s++) {
      const t = s / parSegment, t2 = t * t, t3 = t2 * t;
      const q = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        q[c] = 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t
          + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2
          + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
      }
      pts.push(q);
      rs.push(mix(rayons[i], rayons[i + 1], t));
    }
  }
  pts.push(points[n - 1].slice());
  rs.push(rayons[n - 1]);
  return { pts, rs };
}

// Tube suivant une courbe. Renvoie une fonction distance, avec un rejet rapide par boîte englobante.
export function tube(points, rayons, parSegment = 6) {
  const r = Array.isArray(rayons) ? rayons : points.map(() => rayons);
  const { pts, rs } = lisser(points, r, parSegment);
  const rmax = Math.max(...rs);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let c = 0; c < 3; c++) {
    lo[c] = Math.min(lo[c], p[c] - rmax);
    hi[c] = Math.max(hi[c], p[c] + rmax);
  }
  const f = (p) => {
    const dx = Math.max(lo[0] - p[0], 0, p[0] - hi[0]);
    const dy = Math.max(lo[1] - p[1], 0, p[1] - hi[1]);
    const dz = Math.max(lo[2] - p[2], 0, p[2] - hi[2]);
    const hors = Math.hypot(dx, dy, dz);
    if (hors > 1.2) return hors;
    let d = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const v = sdRoundCone(p, pts[i], pts[i + 1], rs[i], rs[i + 1]);
      if (v < d) d = v;
    }
    return d;
  };
  f.pts = pts;
  f.rs = rs;
  f.debut = pts[0];
  f.fin = pts[pts.length - 1];
  f.dirFin = norm(sub(pts[pts.length - 1], pts[pts.length - 2]));
  f.dirDebut = norm(sub(pts[0], pts[1]));
  return f;
}

// Demi-espace : négatif derrière le plan (du côté opposé à la normale).
export const plan = (p, point, normale) =>
  (p[0] - point[0]) * normale[0] + (p[1] - point[1]) * normale[1] + (p[2] - point[2]) * normale[2];

export function gradient(f, p, e = 0.02) {
  const g = [
    f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]),
    f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]),
    f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e]),
  ];
  return norm(g);
}

// Avance depuis `origine` dans `direction` jusqu'à franchir la surface (changement de signe), puis affine.
export function projeter(f, origine, direction, portee = 12, pas = 0.05) {
  const dir = norm(direction);
  const s0 = Math.sign(f(origine));
  let t = 0;
  while (t < portee) {
    t += pas;
    const p = add(origine, mul(dir, t));
    if (Math.sign(f(p)) !== s0) {
      let a = t - pas, b = t;
      for (let i = 0; i < 18; i++) {
        const m = (a + b) / 2;
        if (Math.sign(f(add(origine, mul(dir, m)))) === s0) a = m; else b = m;
      }
      return add(origine, mul(dir, (a + b) / 2));
    }
  }
  return null;
}

// Bruit de valeur 3D et bruit fractal, pour varier les couleurs.
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
export function bruit(p) {
  const xi = Math.floor(p[0]), yi = Math.floor(p[1]), zi = Math.floor(p[2]);
  const xf = p[0] - xi, yf = p[1] - yi, zf = p[2] - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return mix(
    mix(mix(c(0, 0, 0), c(1, 0, 0), u), mix(c(0, 1, 0), c(1, 1, 0), u), v),
    mix(mix(c(0, 0, 1), c(1, 0, 1), u), mix(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
export function fbm(p, octaves = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) {
    s += a * bruit([p[0] * f, p[1] * f, p[2] * f]);
    a *= 0.5;
    f *= 2.03;
  }
  return s;
}
