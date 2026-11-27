// Génère le cœur provisoire : public/modeles/coeur.glb
// Chaque pièce est un maillage nommé par son identifiant (voir src/donnees/coeur.js).
// Le jour où un modèle réaliste est prêt, il suffit qu'il reprenne les mêmes noms de pièces pour le remplacer.
//
// Repère (cm) : x vers la droite de l'observateur (gauche du patient), y vers le haut, z vers l'observateur (face avant).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  smin, smax, sdSphere, sdEllipsoid, sdRoundCone, tube, plan, gradient, projeter, fbm, lisser,
  add, sub, mul, norm, mix, smoothstep, len,
} from './sdf.mjs';
import { mailler, boite, maillerTube, fusionner, maillerValvule } from './maillage.mjs';
import { ecrireGlb } from './glb.mjs';

const t0 = Date.now();

// ───────────────────────── Ventricules ─────────────────────────
const BASE = 1.0; // hauteur du plan qui sépare oreillettes et ventricules
const LV_A = [1.85, 0, -0.1], LV_B = [1.75, -4.6, 0.25];
const RV_A = [-2.3, 0, 0.1], RV_B = [0.2, -3.9, 0.6];

const dVGext = (p) => sdRoundCone(p, [1.5, 0.2, -0.1], [1.7, -5.4, 0.3], 2.75, 1.15);
const dVDext = (p) => sdRoundCone(p, [-1.75, 0.2, 0.3], [0.6, -4.6, 0.6], 2.45, 0.9);
const dCone = (p) => smax(sdRoundCone(p, [-1.9, -0.6, 0.7], [-1.4, 1.25, 1.05], 1.5, 1.2), p[1] - 1.55, 0.2);
const dVent = (p) => smin(smax(smin(dVGext(p), dVDext(p), 0.9), p[1] - BASE, 0.35), dCone(p), 0.5);

const dVGc = (p) => sdRoundCone(p, LV_A, LV_B, 1.45, 0.45); // cavité gauche (forme principale)
const dVDc = (p) => sdRoundCone(p, RV_A, RV_B, 1.6, 0.45); // cavité droite (forme principale)
const dChasseG = (p) => sdRoundCone(p, [1.5, -0.3, 0.0], [0.6, 0.9, 0.2], 0.9, 0.86); // vers l'aorte
const dChasseD = (p) => sdRoundCone(p, [-1.9, -0.7, 0.6], [-1.4, 1.2, 1.05], 1.0, 0.8); // vers l'artère pulmonaire
const cavVG = (p) => Math.min(smax(dVGc(p), p[1] - 0.72, 0.25), dChasseG(p));
const cavVD = (p) => Math.min(smax(dVDc(p), p[1] - 0.72, 0.25), dChasseD(p));

// ───────────────────────── Vaisseaux ─────────────────────────
function vaisseau(points, rayons, epaisseur, { ouvert = true } = {}) {
  const r = Array.isArray(rayons) ? rayons : points.map(() => rayons);
  const ext = tube(points, r);
  let ptsL = points, rL = r.map((v) => v - epaisseur);
  if (ouvert) {
    ptsL = [...points, add(ext.fin, mul(ext.dirFin, 1.4))];
    rL = [...rL, rL[rL.length - 1]];
  }
  const lumiere = tube(ptsL, rL);
  const rFin = r[r.length - 1];
  // Extrémité ouverte : on retire la calotte arrondie au-delà du plan de coupe terminal.
  const solide = ouvert
    ? (p) => Math.max(ext(p), -Math.max(-plan(p, ext.fin, ext.dirFin), sdSphere(p, ext.fin, rFin * 1.8)))
    : ext;
  return { ext, lumiere, solide };
}

const ao = vaisseau(
  [[0.6, 0.7, 0.2], [0.5, 2.5, 0.2], [0.1, 4.4, 0.1], [0.6, 6.0, -0.5], [1.9, 6.5, -1.4], [3.1, 5.9, -2.2], [3.5, 4.9, -2.5]],
  [1.08, 1.05, 1.0, 1.0, 0.98, 0.95, 0.93], 0.24);
const aoB1 = vaisseau([[0.5, 5.6, -0.3], [0.3, 6.9, -0.2], [0.1, 8.0, -0.1]], 0.5, 0.17);
const aoB2 = vaisseau([[1.5, 6.2, -1.1], [1.6, 7.3, -1.1], [1.7, 8.2, -1.1]], 0.42, 0.16);
const aoB3 = vaisseau([[2.5, 6.1, -1.8], [2.8, 7.1, -1.9], [3.1, 8.0, -2.0]], 0.45, 0.16);
const AORTE = [ao, aoB1, aoB2, aoB3];

const apTronc = vaisseau(
  [[-1.4, 0.9, 1.05], [-1.2, 2.3, 1.5], [-0.3, 3.3, 2.1], [0.9, 4.0, 2.0], [1.7, 4.4, 1.3]],
  [0.97, 0.95, 0.92, 0.9, 0.85], 0.22, { ouvert: false });
const apG = vaisseau([[1.7, 4.4, 1.3], [3.0, 4.7, 0.6], [4.4, 4.6, -0.2]], 0.62, 0.19);
const apD = vaisseau([[1.7, 4.4, 1.3], [1.95, 4.5, -0.3], [1.2, 4.4, -1.5], [-0.4, 4.3, -1.85], [-1.7, 4.25, -1.75]], 0.6, 0.19);
const PULMONAIRE = [apTronc, apG, apD];

const vcs = vaisseau([[-2.9, 3.3, -0.4], [-2.85, 5.4, -0.4], [-2.8, 7.2, -0.4]], 0.78, 0.21);
const vci = vaisseau([[-2.9, 1.9, -1.3], [-3.1, 0.6, -2.6], [-3.2, -1.0, -3.0]], 0.82, 0.21);
const VP = [
  vaisseau([[4.0, 3.0, -0.8], [5.2, 3.2, -1.0], [6.2, 3.4, -1.2]], 0.46, 0.17),
  vaisseau([[4.0, 2.0, -1.0], [5.2, 1.8, -1.3], [6.2, 1.6, -1.6]], 0.46, 0.17),
  vaisseau([[2.3, 3.0, -1.5], [1.0, 3.2, -2.6], [-0.4, 3.3, -3.0], [-1.6, 3.4, -3.1]], 0.46, 0.17),
  vaisseau([[2.3, 1.9, -1.6], [1.0, 1.9, -2.7], [-0.4, 1.8, -3.1], [-1.6, 1.7, -3.2]], 0.46, 0.17),
];

const unionExt = (liste) => (p) => { let d = Infinity; for (const v of liste) { const x = v.ext(p); if (x < d) d = x; } return d; };
const unionSolide = (liste, k = 0.25) => (p) => { let d = Infinity; for (const v of liste) d = d === Infinity ? v.solide(p) : smin(d, v.solide(p), k); return d; };
const dAoExt = unionExt(AORTE);
const dApExt = unionExt(PULMONAIRE);
const dVpExt = unionExt(VP);

// ───────────────────────── Oreillettes ─────────────────────────
const OD_C = [-2.8, 2.3, -0.4], OG_C = [2.9, 2.3, -0.6];
const dODbrut = (p) => smin(sdEllipsoid(p, OD_C, [1.9, 1.9, 1.8]), sdSphere(p, [-1.9, 2.9, 1.0], 0.85), 0.6);
const dOGbrut = (p) => smin(sdEllipsoid(p, OG_C, [2.0, 1.7, 1.7]), sdSphere(p, [3.9, 2.7, 0.6], 0.8), 0.6);
const corps = (brut) => (p) => {
  const d = brut(p);
  if (d > 0.5) return d;
  return Math.max(d, -dVent(p), -dAoExt(p), -dApExt(p));
};
const dOD = corps(dODbrut), dOG = corps(dOGbrut);
const PAROI_OREILLETTE = 0.3;
const cavOD = (p) => dOD(p) + PAROI_OREILLETTE;
const cavOG = (p) => dOG(p) + PAROI_OREILLETTE;

// Orifices auriculo-ventriculaires
const TRI = { centre: [-2.7, BASE, -0.55], rayon: 0.82 };
const MIT = { centre: [2.45, BASE, -0.45], rayon: 0.8 };
const orifice = (o) => (p) => sdRoundCone(p, [o.centre[0], 0.3, o.centre[2]], [o.centre[0], 1.7, o.centre[2]], o.rayon, o.rayon);
const orTri = orifice(TRI), orMit = orifice(MIT);

// ───────────────────────── Sang : toutes les cavités et lumières ─────────────────────────
const LUMIERES = [...AORTE, ...PULMONAIRE, vcs, vci, ...VP].map((v) => v.lumiere);
const sang = (p) => {
  let d = Math.min(cavVG(p), cavVD(p), cavOD(p), cavOG(p), orTri(p), orMit(p));
  for (const l of LUMIERES) { const v = l(p); if (v < d) d = v; }
  return d;
};

// Évalue d'abord la forme principale ; le reste seulement près de la surface.
const piece = (principal, ...retraits) => (p) => {
  let d = principal(p);
  if (d > 0.4) return d;
  for (const r of retraits) { const v = -r(p); if (v > d) d = v; }
  return d;
};

const EP_CLOISON = 1.0;
const PROF_CLOISON = 0.6; // la cloison reste à l'intérieur : elle n'affleure jamais la surface du cœur
const paroiVent = piece(dVent, sang);
const zoneCloison = (p) => Math.max(dVGc(p) - EP_CLOISON, dVDc(p) - EP_CLOISON, dVent(p) + PROF_CLOISON);
const horsCloison = (p) => -zoneCloison(p);
const dCloison = (p) => { const d = paroiVent(p); return d > 0.4 ? d : Math.max(d, zoneCloison(p)); };
const dVG = (p) => { const d = paroiVent(p); return d > 0.4 ? d : Math.max(d, horsCloison(p), dVGc(p) - dVDc(p)); };
const dVD = (p) => { const d = paroiVent(p); return d > 0.4 ? d : Math.max(d, horsCloison(p), dVDc(p) - dVGc(p)); };

// ───────────────────────── Couleurs ─────────────────────────
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const melange = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const C = {
  muscle1: hex('#7f2a27'), muscle2: hex('#b24a3d'), gras1: hex('#c48f45'), gras2: hex('#e4c078'),
  endo1: hex('#9c3d3a'), endo2: hex('#c56d60'),
  od1: hex('#7a2c2c'), od2: hex('#a54a41'),
  ao1: hex('#c0432f'), ao2: hex('#de6d50'), aoInt: hex('#a93a33'),
  ap1: hex('#6a67a3'), ap2: hex('#9a8cc0'), apInt: hex('#75699a'),
  vc1: hex('#4d5c9c'), vc2: hex('#7a87bd'), vcInt: hex('#5a5f93'),
  vp1: hex('#bd5a55'), vp2: hex('#dc8a7c'), vpInt: hex('#a94a48'),
};
const couleurVentricule = (p) => {
  if (dVent(p) < -0.07) return melange(C.endo1, C.endo2, fbm(mul(p, 2.4)));
  const muscle = melange(C.muscle1, C.muscle2, fbm(mul(p, 1.4)));
  const sillonAV = Math.exp(-Math.max(0, BASE - p[1]) / 0.6);
  const sillonIV = Math.exp(-Math.abs(dVGc(p) - dVDc(p)) / 0.5);
  const g = fbm(mul(p, 0.85)) + 0.36 * sillonAV + 0.3 * sillonIV;
  const gras = smoothstep(0.68, 0.84, g);
  return melange(muscle, melange(C.gras1, C.gras2, fbm(mul(p, 3.1))), gras * 0.94);
};
const couleurOreillette = (d) => (p) => {
  if (d(p) < -0.07) return melange(C.endo1, C.endo2, fbm(mul(p, 2.4)));
  const base = melange(C.od1, C.od2, fbm(mul(p, 1.6)));
  const gras = smoothstep(0.68, 0.84, fbm(mul(p, 0.9)) + 0.3 * Math.exp(-Math.max(0, p[1] - BASE) / 0.6));
  return melange(base, melange(C.gras1, C.gras2, fbm(mul(p, 3.1))), gras * 0.85);
};
const couleurVaisseau = (ext, c1, c2, cInt) => (p) =>
  ext(p) < -0.05 ? cInt : melange(c1, c2, fbm([p[0] * 1.2, p[1] * 3.0, p[2] * 1.2]));

// ───────────────────────── Pièces sculptées ─────────────────────────
const SCULPTEES = [
  { id: 'ventricule_gauche', sdf: dVG, cellule: 0.12, couleur: couleurVentricule },
  { id: 'ventricule_droit', sdf: dVD, cellule: 0.12, couleur: couleurVentricule },
  { id: 'cloison', sdf: dCloison, cellule: 0.12, couleur: couleurVentricule },
  { id: 'oreillette_droite', sdf: piece(dOD, sang), cellule: 0.1, couleur: couleurOreillette(dOD) },
  { id: 'oreillette_gauche', sdf: piece(dOG, sang), cellule: 0.1, couleur: couleurOreillette(dOG) },
  { id: 'aorte', sdf: piece(unionSolide(AORTE), sang, dVent), cellule: 0.095, couleur: couleurVaisseau(dAoExt, C.ao1, C.ao2, C.aoInt) },
  { id: 'artere_pulmonaire', sdf: piece(unionSolide(PULMONAIRE), sang, dVent, dAoExt), cellule: 0.095, couleur: couleurVaisseau(dApExt, C.ap1, C.ap2, C.apInt) },
  { id: 'veine_cave_superieure', sdf: piece(vcs.solide, sang, dOD), cellule: 0.09, couleur: couleurVaisseau(vcs.ext, C.vc1, C.vc2, C.vcInt) },
  { id: 'veine_cave_inferieure', sdf: piece(vci.solide, sang, dOD, dVent), cellule: 0.09, couleur: couleurVaisseau(vci.ext, C.vc1, C.vc2, C.vcInt) },
  { id: 'veines_pulmonaires', sdf: piece(unionSolide(VP, 0.1), sang, dOG), cellule: 0.075, couleur: couleurVaisseau(dVpExt, C.vp1, C.vp2, C.vpInt) },
];

// Extérieur du cœur : hors de toute paroi et hors du sang.
const toutSolide = (p) => Math.min(dVent(p), dODbrut(p), dOGbrut(p), dAoExt(p), dApExt(p), vcs.ext(p), vci.ext(p), dVpExt(p));
const horsCoeur = (p) => Math.min(toutSolide(p), sang(p)) > 0.03;

// ───────────────────────── Outils communs ─────────────────────────
const versLineaire = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function couleurs(m, fn) {
  const nv = m.positions.length / 3;
  const out = new Uint8Array(nv * 4);
  for (let v = 0; v < nv; v++) {
    const c = fn([m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]]);
    out[v * 4] = Math.round(versLineaire(c[0]) * 255);
    out[v * 4 + 1] = Math.round(versLineaire(c[1]) * 255);
    out[v * 4 + 2] = Math.round(versLineaire(c[2]) * 255);
    out[v * 4 + 3] = 255;
  }
  return out;
}

function estFerme(indices) {
  const aretes = new Map();
  for (let t = 0; t < indices.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = indices[t + e], b = indices[t + ((e + 1) % 3)];
    const cle = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    aretes.set(cle, (aretes.get(cle) || 0) + 1);
  }
  for (const n of aretes.values()) if (n !== 2) return false;
  return true;
}

// Points d'ancrage possibles pour l'étiquette : répartis sur la pièce, en commençant par la face avant.
function ancres(m, combien, exterieur) {
  const nv = m.positions.length / 3;
  const pasEch = Math.max(1, Math.floor(nv / 2500));
  const cand = [];
  for (let v = 0; v < nv; v += pasEch) cand.push(v);
  const P = (v) => [m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]];
  const N = (v) => [m.normales[v * 3], m.normales[v * 3 + 1], m.normales[v * 3 + 2]];
  let centre = [0, 0, 0];
  for (const v of cand) centre = add(centre, P(v));
  centre = mul(centre, 1 / cand.length);
  const choisis = [];
  const dist = cand.map(() => Infinity);
  let courant = 0, meilleur = -Infinity;
  cand.forEach((v, i) => { const s = P(v)[2] + N(v)[2] * 2; if (s > meilleur) { meilleur = s; courant = i; } });
  for (let k = 0; k < Math.min(combien, cand.length); k++) {
    choisis.push(cand[courant]);
    const pc = P(cand[courant]);
    let loin = -1, iLoin = 0;
    cand.forEach((v, i) => {
      const d = len(sub(P(v), pc));
      if (d < dist[i]) dist[i] = d;
      if (dist[i] > loin) { loin = dist[i]; iLoin = i; }
    });
    courant = iLoin;
  }
  const arr = (x) => Math.round(x * 1000) / 1000;
  return {
    centre: centre.map(arr),
    ancres: choisis.map((v) => {
      const p = P(v), n = N(v);
      const ext = exterieur === undefined ? horsCoeur(add(p, mul(n, 0.4))) : exterieur;
      return [...p.map(arr), ...n.map(arr), ext ? 1 : 0];
    }),
  };
}

const noeuds = [];
const stats = [];
function ajouter(nom, pieceId, m, { couleur, cible, exterieur, nbAncres = 12, ferme } = {}) {
  const f = ferme === undefined ? estFerme(m.indices) : ferme;
  noeuds.push({
    nom,
    positions: m.positions, normales: m.normales, indices: m.indices,
    couleurs: couleurs(m, couleur),
    cible,
    extras: { piece: pieceId, ferme: f, ...ancres(m, nbAncres, exterieur) },
  });
  stats.push({ nom, triangles: m.indices.length / 3, ferme: f });
}

// ───────────────────────── 1. Pièces sculptées ─────────────────────────
const MONDE = { lo: [-6.6, -8, -5], hi: [7.6, 9.5, 4.6] };
for (const s of SCULPTEES) {
  const b = boite(s.sdf, MONDE.lo, MONDE.hi);
  if (!b) throw new Error(`Pièce vide : ${s.id}`);
  const m = mailler(s.sdf, b.lo, b.hi, s.cellule);
  ajouter(s.id, s.id, m, { couleur: s.couleur, nbAncres: 30 });
  console.log(`  ${s.id} : ${m.indices.length / 3} triangles (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

// ───────────────────────── 2. Valvules (feuillets, avec forme ouverte en cible) ─────────────────────────
const BLANC = () => hex('#ead8c2');
function valvule(id, def) {
  const fermee = maillerValvule({ ...def, fermeture: 0.96 });
  const ouverte = maillerValvule({ ...def, fermeture: 0.05 });
  ajouter(id, id, fermee, { couleur: BLANC, cible: ouverte.positions, exterieur: false, nbAncres: 4, ferme: false });
}
function surTrajet(t, y) {
  let i = 0;
  for (let k = 0; k < t.pts.length; k++) if (Math.abs(t.pts[k][1] - y) < Math.abs(t.pts[i][1] - y)) i = k;
  return { centre: t.pts[i], axe: norm(sub(t.pts[i + 1], t.pts[i])), rayon: t.rs[i] };
}
valvule('valvule_tricuspide', { centre: TRI.centre, axe: [0, -1, 0], rayon: TRI.rayon * 0.97, longueur: 1.25, nombre: 3 });
valvule('valvule_mitrale', { centre: MIT.centre, axe: [0, -1, 0], rayon: MIT.rayon * 0.97, longueur: 1.25, nombre: 2 });
{
  const a = surTrajet(ao.lumiere, 1.35);
  valvule('valvule_aortique', { centre: a.centre, axe: a.axe, rayon: a.rayon * 0.97, longueur: 0.8, nombre: 3 });
  const b = surTrajet(apTronc.lumiere, 1.65);
  valvule('valvule_pulmonaire', { centre: b.centre, axe: b.axe, rayon: b.rayon * 0.97, longueur: 0.75, nombre: 3 });
}

// ───────────────────────── 3. Vaisseaux coronaires (tubes posés sur la surface) ─────────────────────────
const poser = (p) => (p ? add(p, mul(gradient(dVent, p), 0.05)) : null);
const deFace = (x, y) => poser(projeter(dVent, [x, y, 8], [0, 0, -1]));
const radial = (phiDeg, y) => {
  const a = (phiDeg * Math.PI) / 180;
  const dir = [Math.cos(a), 0, Math.sin(a)];
  return poser(projeter(dVent, add([-0.1, y, 0.2], mul(dir, 9)), mul(dir, -1)));
};
// Abscisse du sillon entre les deux ventricules, sur la face avant, à la hauteur y.
function sillon(y) {
  let a = -1.6, b = 2.6;
  const g = (x) => { const p = deFace(x, y); return p ? dVGc(p) - dVDc(p) : (x < 0.5 ? 1 : -1); };
  for (let i = 0; i < 22; i++) { const m = (a + b) / 2; if (g(m) > 0) a = m; else b = m; }
  return (a + b) / 2;
}
function vaisseauSurface(points, r0, r1) {
  const pts = points.filter(Boolean);
  const l = lisser(pts, pts.map((_, i) => mix(r0, r1, i / (pts.length - 1))), 4);
  return maillerTube(l.pts, l.rs, 7);
}
const suite = (a, b, n, fn) => Array.from({ length: n }, (_, i) => fn(mix(a, b, i / (n - 1))));
{
  const iva = suite(0.7, -5.3, 13, (y) => deFace(sillon(y), y));
  const arteres = [
    vaisseauSurface(iva, 0.15, 0.07),
    vaisseauSurface(suite(105, 215, 10, (a) => radial(a, 0.78)), 0.15, 0.09),
    vaisseauSurface(suite(70, -40, 10, (a) => radial(a, 0.78)), 0.14, 0.08),
    vaisseauSurface(suite(0, 1, 8, (t) => radial(mix(150, 128, t), mix(0.7, -3.6, t))), 0.11, 0.05),
    vaisseauSurface([deFace(sillon(-0.4), -0.4), deFace(1.6, -1.3), deFace(2.5, -2.5), deFace(2.9, -3.5)], 0.1, 0.05),
    vaisseauSurface([deFace(sillon(-1.5), -1.5), deFace(-0.5, -2.3), deFace(-1.1, -3.2)], 0.09, 0.05),
    vaisseauSurface([deFace(sillon(-2.6), -2.6), deFace(1.9, -3.4), deFace(2.4, -4.3)], 0.08, 0.045),
  ];
  ajouter('arteres_coronaires', 'arteres_coronaires', fusionner(arteres), { couleur: () => hex('#c2201f'), exterieur: true, nbAncres: 8, ferme: false });
  const veines = [
    vaisseauSurface(suite(-5.0, 0.6, 12, (y) => deFace(sillon(y) + 0.33, y)), 0.07, 0.16),
    vaisseauSurface(suite(0, 1, 8, (t) => radial(mix(28, 40, t), mix(-3.6, 0.6, t))), 0.06, 0.13),
    vaisseauSurface(suite(0, 1, 7, (t) => radial(mix(168, 160, t), mix(-2.6, 0.55, t))), 0.06, 0.12),
  ];
  ajouter('veines_coronaires', 'veines_coronaires', fusionner(veines), { couleur: () => hex('#2f4da6'), exterieur: true, nbAncres: 8, ferme: false });
}

// ───────────────────────── 4. Tissu nodal ─────────────────────────
function boule(c, r, axe = [0, 1, 0]) {
  const A = norm(axe), pts = [], rs = [];
  for (let i = 0; i <= 8; i++) { const t = (i / 8) * Math.PI; pts.push(add(c, mul(A, -Math.cos(t) * r))); rs.push(Math.max(0.01, Math.sin(t) * r)); }
  return maillerTube(pts, rs, 10);
}
const filament = (points, r) => { const pts = points.filter(Boolean); const l = lisser(pts, pts.map(() => r), 4); return maillerTube(l.pts, l.rs, 6); };
const JAUNE = () => hex('#f4cf2e');
{
  const sinusal = projeter(cavOD, OD_C, [0.5, 0.82, 0.3]);
  const septal = projeter(cavOD, OD_C, [0.8, -0.5, 0.25]);
  ajouter('noeud_sinusal', 'noeud_sinusal', boule(sinusal, 0.3), { couleur: JAUNE, exterieur: false, nbAncres: 3, ferme: false });
  ajouter('noeud_septal', 'noeud_septal', boule(septal, 0.26), { couleur: JAUNE, exterieur: false, nbAncres: 3, ferme: false });

  // Point sur la paroi d'une cavité, vu depuis son axe, légèrement décollé vers l'intérieur.
  const surParoi = (cav, A, B, t, dir) => {
    const o = add(A, mul(sub(B, A), t));
    const p = projeter(cav, o, dir, 6, 0.04);
    return p ? add(p, mul(norm(dir), -0.05)) : null;
  };
  const division = [-0.15, -0.5, 0.3];
  const tronc = filament([septal, [-0.6, 0.95, 0.25], [-0.2, 0.2, 0.3], division], 0.1);
  const ts = [0.22, 0.38, 0.54, 0.7, 0.86];
  const brancheD = filament([division, ...ts.map((t) => surParoi(cavVD, RV_A, RV_B, t, [1, 0, 0]))], 0.07);
  const brancheG = filament([division, ...ts.map((t) => surParoi(cavVG, LV_A, LV_B, t, [-1, 0, 0]))], 0.07);
  ajouter('faisceau_de_his', 'faisceau_de_his', fusionner([tronc, brancheD, brancheG]), { couleur: JAUNE, exterieur: false, nbAncres: 5, ferme: false });

  const fibres = [];
  const tour = (cav, A, B, cote) => {
    // Remontée le long de la paroi libre, depuis la pointe.
    const tsLibre = [0.9, 0.78, 0.64, 0.5, 0.36];
    fibres.push(filament([
      surParoi(cav, A, B, 0.86, [-cote, 0, 0]),
      surParoi(cav, A, B, 0.97, [-cote * 0.3, -1, 0]),
      ...tsLibre.map((t) => surParoi(cav, A, B, t, [cote, 0, 0])),
    ], 0.05));
    // Rameaux qui s'enroulent vers l'arrière de la cavité.
    for (const t of [0.42, 0.62, 0.82]) {
      for (const sens of [1, -1]) {
        fibres.push(filament([0, 25, 50, 75].map((deg) => {
          const a = (deg * Math.PI) / 180;
          return surParoi(cav, A, B, t - deg / 900, [cote * Math.cos(a), 0, -Math.sin(a) * sens]);
        }), 0.038));
      }
    }
  };
  tour(cavVD, RV_A, RV_B, -1);
  tour(cavVG, LV_A, LV_B, 1);
  ajouter('reseau_de_purkinje', 'reseau_de_purkinje', fusionner(fibres), { couleur: JAUNE, exterieur: false, nbAncres: 6, ferme: false });
}

// ───────────────────────── Écriture ─────────────────────────
const dossier = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'modeles');
mkdirSync(dossier, { recursive: true });
const glb = ecrireGlb(noeuds);
writeFileSync(join(dossier, 'coeur.glb'), glb);

const total = stats.reduce((s, x) => s + x.triangles, 0);
console.log(`\n${stats.length} maillages, ${total} triangles, ${(glb.length / 1e6).toFixed(2)} Mo, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const ouverts = SCULPTEES.map((s) => stats.find((x) => x.nom === s.id)).filter((x) => !x.ferme).map((x) => x.nom);
if (ouverts.length) console.log(`Attention, maillages sculptés non fermés : ${ouverts.join(', ')}`);
