// L'« instant » : la description complète de ce qui est affiché à un moment donné.
// C'est un objet simple, sérialisable. Tout l'affichage en découle, et c'est exactement
// ce que le professeur enverra aux élèves dans le mode cours en direct.

export const INSTANT_DEFAUT = Object.freeze({
  v: 1,
  organe: 'coeur',
  niveau: '3e', // '3e' | 'tle'
  camera: { position: [1.2, 1.6, 37], cible: [0.5, 0.7, -0.2] },
  selection: null, // identifiant de la pièce sélectionnée
  masquees: [], // identifiants des pièces masquées
  isolee: null, // identifiant de la seule pièce affichée, ou null
  coupe: { active: false, position: 0.6 }, // plan de coupe frontal, position en cm d'avant en arrière
  eclate: 0, // 0 = assemblé, 1 = vue éclatée
  etiquettes: true,
  battement: { lecture: true, vitesse: 1, bpm: 75, phase: 0 }, // phase : 0..1 dans la révolution cardiaque
});

const IMBRIQUES = ['camera', 'coupe', 'battement'];
let etat = structuredClone(INSTANT_DEFAUT);
const abonnes = new Set();

export const lire = () => etat;

export function modifier(patch, source = 'ui') {
  const avant = etat;
  const suivant = { ...etat, ...patch };
  for (const cle of IMBRIQUES) if (patch[cle]) suivant[cle] = { ...avant[cle], ...patch[cle] };
  etat = suivant;
  for (const f of abonnes) f(etat, avant, source);
}

export function abonner(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

// ── Sérialisation (lien de partage aujourd'hui, synchronisation de classe demain) ──
const nombre = (x, min, max, defaut) => (typeof x === 'number' && isFinite(x) ? Math.min(max, Math.max(min, x)) : defaut);
const triplet = (t, defaut) => (Array.isArray(t) && t.length === 3 && t.every((x) => typeof x === 'number' && isFinite(x)) ? t.map((x) => Math.round(x * 100) / 100) : defaut);
const texte = (x) => (typeof x === 'string' && /^[a-z0-9_]{1,40}$/.test(x) ? x : null);

// Ne garde que les champs connus, avec des valeurs valides : un instant peut venir de l'extérieur.
export function valider(brut) {
  const d = INSTANT_DEFAUT;
  if (!brut || typeof brut !== 'object') return structuredClone(d);
  return {
    v: 1,
    organe: 'coeur',
    niveau: brut.niveau === 'tle' ? 'tle' : '3e',
    camera: {
      position: triplet(brut.camera?.position, d.camera.position),
      cible: triplet(brut.camera?.cible, d.camera.cible),
    },
    selection: texte(brut.selection),
    masquees: Array.isArray(brut.masquees) ? brut.masquees.map(texte).filter(Boolean).slice(0, 60) : [],
    isolee: texte(brut.isolee),
    coupe: { active: brut.coupe?.active === true, position: nombre(brut.coupe?.position, -3, 3, d.coupe.position) },
    eclate: nombre(brut.eclate, 0, 1, 0),
    etiquettes: brut.etiquettes !== false,
    battement: {
      lecture: brut.battement?.lecture !== false,
      vitesse: nombre(brut.battement?.vitesse, 0.1, 2, 1),
      bpm: nombre(brut.battement?.bpm, 40, 200, 75),
      phase: nombre(brut.battement?.phase, 0, 1, 0),
    },
  };
}

export const encoder = (instant) => encodeURIComponent(JSON.stringify(instant));

export function instantDepuisUrl() {
  const m = /[#&]i=([^&]+)/.exec(location.hash);
  if (!m) return null;
  try {
    return valider(JSON.parse(decodeURIComponent(m[1])));
  } catch {
    return null;
  }
}

export const lienDePartage = () => `${location.origin}${location.pathname}#i=${encoder(etat)}`;
