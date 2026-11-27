// L'interface autour de la vue 3D : classe, modes, arbre des structures, fiche, ligne de temps.
// Elle ne fait que lire l'instant et le modifier ; l'affichage 3D suit tout seul.
import { lire, modifier, abonner, lienDePartage, INSTANT_DEFAUT } from '../etat.js';
import { NIVEAUX, GROUPES, PHASES, PIECE_PAR_ID, piecesDuNiveau } from '../donnees/coeur.js';

const $ = (id) => document.getElementById(id);
const el = (balise, attrs = {}, ...enfants) => {
  const e = document.createElement(balise);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  e.append(...enfants);
  return e;
};

const MODES = [
  { id: 'externe', nom: 'Vue externe', patch: { coupe: { active: false }, eclate: 0 }, camera: INSTANT_DEFAUT.camera },
  { id: 'coupe', nom: 'Coupe', patch: { coupe: { active: true }, eclate: 0 }, camera: INSTANT_DEFAUT.camera },
  { id: 'eclatee', nom: 'Vue éclatée', patch: { coupe: { active: false }, eclate: 1 }, camera: { position: [2.2, 2.4, 58], cible: [0.3, 1.3, 0.4] } },
];
const modeActif = (e) => (e.coupe.active ? 'coupe' : e.eclate > 0.02 ? 'eclatee' : 'externe');

const OEIL = 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Zm10 3.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z';
const OEIL_BARRE = 'M3 4.3 4.3 3 21 19.7 19.7 21l-3-3A11 11 0 0 1 12 18.5C5.6 18.5 2 12 2 12a17 17 0 0 1 4.2-4.6L3 4.3Zm6 6a3.2 3.2 0 0 0 4.7 4.7L9 10.3Zm3-4.8c6.4 0 10 6.5 10 6.5a17 17 0 0 1-2.9 3.6l-3.3-3.3a3.2 3.2 0 0 0-4-4L8.300 6.2A10.600 10.600 0 0 1 12 5.5Z';
const icone = (d) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill-rule', 'evenodd');
  svg.append(path);
  return svg;
};

export function construireInterface({ vis, horloge }) {
  // ── Classe ──
  const niveaux = $('niveaux');
  for (const [id, n] of Object.entries(NIVEAUX)) {
    niveaux.append(el('button', {
      type: 'button', 'data-id': id, text: n.nom,
      onclick: () => {
        const e = lire();
        const garde = (pid) => pid && PIECE_PAR_ID.get(pid)?.niveaux.includes(id) ? pid : null;
        modifier({ niveau: id, selection: garde(e.selection), isolee: garde(e.isolee) });
      },
    }));
  }

  // ── Modes ──
  const modes = $('modes');
  for (const m of MODES) {
    modes.append(el('button', { type: 'button', 'data-id': m.id, text: m.nom, onclick: () => { modifier(m.patch); vis.allerA(m.camera.position, m.camera.cible); } }));
  }
  $('b-etiquettes').addEventListener('click', () => modifier({ etiquettes: !lire().etiquettes }));
  $('b-recentrer').addEventListener('click', () => {
    const m = MODES.find((x) => x.id === modeActif(lire()));
    vis.allerA(m.camera.position, m.camera.cible);
  });
  const curseur = $('curseur');
  curseur.addEventListener('input', () => {
    const e = lire();
    if (e.coupe.active) modifier({ coupe: { position: -Number(curseur.value) } });
    else modifier({ eclate: Number(curseur.value) });
  });

  // ── Partage ──
  const partager = $('partager');
  partager.addEventListener('click', async () => {
    modifier({ camera: vis.lireCamera(), battement: { phase: horloge.phase } }, 'camera');
    const lien = lienDePartage();
    try {
      await navigator.clipboard.writeText(lien);
      partager.textContent = 'Lien copié';
    } catch {
      location.hash = lien.slice(lien.indexOf('#'));
      partager.textContent = 'Lien dans la barre d’adresse';
    }
    setTimeout(() => { partager.textContent = 'Copier le lien de cette vue'; }, 2200);
  });

  // ── Arbre des structures ──
  const arbre = $('arbre');
  const replies = new Set();
  $('tout-afficher').addEventListener('click', () => modifier({ masquees: [], isolee: null }));
  const basculer = (id) => {
    const e = lire();
    if (e.isolee) return modifier({ isolee: null, masquees: [] });
    const masquees = e.masquees.includes(id) ? e.masquees.filter((x) => x !== id) : [...e.masquees, id];
    modifier({ masquees, selection: masquees.includes(e.selection) ? null : e.selection });
  };
  function dessinerArbre(e) {
    arbre.replaceChildren();
    const pieces = piecesDuNiveau(e.niveau);
    for (const g of GROUPES) {
      const duGroupe = pieces.filter((p) => p.groupe === g.id);
      if (!duGroupe.length) continue;
      const plie = replies.has(g.id);
      arbre.append(el('button', {
        class: `groupe${plie ? ' plie' : ''}`, type: 'button', 'aria-expanded': String(!plie),
        onclick: () => { plie ? replies.delete(g.id) : replies.add(g.id); dessinerArbre(lire()); },
      }, el('span', { class: 'chevron' }), el('span', { text: g.nom }), el('span', { class: 'compte', text: String(duGroupe.length) })));
      if (plie) continue;
      for (const p of duGroupe) {
        const cachee = e.masquees.includes(p.id) || (e.isolee && e.isolee !== p.id);
        const ligne = el('div', { class: `ligne${e.selection === p.id ? ' active' : ''}${cachee ? ' cachee' : ''}` });
        const pastille = el('span', { class: 'pastille' });
        pastille.style.background = p.pastille;
        ligne.append(
          el('button', { class: 'nom', type: 'button', onclick: () => selectionner(p.id) }, pastille, el('span', { text: p.nom })),
          el('button', {
            class: 'oeil', type: 'button', 'aria-label': `${cachee ? 'Afficher' : 'Masquer'} : ${p.nom}`,
            onclick: () => basculer(p.id),
          }, icone(cachee ? OEIL_BARRE : OEIL)),
        );
        arbre.append(ligne);
      }
    }
  }
  const selectionner = (id) => {
    const e = lire();
    const patch = { selection: e.selection === id ? null : id };
    if (id && e.masquees.includes(id)) patch.masquees = e.masquees.filter((x) => x !== id);
    modifier(patch);
    document.body.classList.remove('structures-ouvertes');
  };

  // ── Fiche ──
  const fiche = $('fiche');
  function dessinerFiche(e) {
    const n = NIVEAUX[e.niveau];
    fiche.replaceChildren();
    const p = e.selection ? PIECE_PAR_ID.get(e.selection) : null;
    document.body.classList.toggle('fiche-ouverte', Boolean(p));
    if (!p) {
      fiche.append(
        el('p', { class: 'sur-titre', text: `${n.nom} · SVT` }),
        el('h2', { text: n.lecon.replace(/^Leçon \d+ : /, '') }),
        el('p', { class: 'texte', text: n.intro }),
        el('p', { class: 'aide', text: 'Touchez une structure du cœur, ou son nom dans la liste, pour afficher son rôle.' }),
      );
      return;
    }
    const groupe = GROUPES.find((g) => g.id === p.groupe);
    const isolee = e.isolee === p.id;
    fiche.append(
      el('button', { class: 'fermer', type: 'button', 'aria-label': 'Fermer la fiche', text: '×', onclick: () => modifier({ selection: null }) }),
      el('p', { class: 'sur-titre', text: groupe.nom }),
      el('h2', { text: p.nom }),
      el('p', { class: 'texte', text: p.texte[e.niveau] ?? '' }),
      el('div', { class: 'actions' },
        el('button', { class: 'bouton', type: 'button', text: isolee ? 'Tout réafficher' : 'Isoler', onclick: () => modifier({ isolee: isolee ? null : p.id, masquees: [] }) }),
        el('button', { class: 'bouton', type: 'button', text: 'Masquer', onclick: () => modifier({ masquees: [...e.masquees.filter((x) => x !== p.id), p.id], isolee: null, selection: null }) }),
      ),
    );
  }

  // ── Ligne de temps du battement ──
  const barre = $('cycle-barre'), curseurCycle = $('cycle-curseur'), phaseNom = $('cycle-phase');
  const PAUSE = 'M7 5h3.5v14H7zm6.5 0H17v14h-3.5z', LECTURE = 'M8 5v14l11-7z';
  $('lecture').addEventListener('click', () => modifier({ battement: { lecture: !lire().battement.lecture, phase: horloge.phase } }));
  const VITESSES = [1, 0.5, 0.25];
  $('vitesse').addEventListener('click', () => {
    const v = lire().battement.vitesse;
    modifier({ battement: { vitesse: VITESSES[(VITESSES.indexOf(v) + 1) % VITESSES.length] } });
  });
  const viser = (ev) => {
    const r = barre.getBoundingClientRect();
    const phase = Math.min(0.999, Math.max(0, (ev.clientX - r.left) / r.width));
    horloge.phase = phase;
    modifier({ battement: { lecture: false, phase } });
  };
  barre.addEventListener('pointerdown', (ev) => { barre.setPointerCapture(ev.pointerId); viser(ev); });
  barre.addEventListener('pointermove', (ev) => { if (barre.hasPointerCapture(ev.pointerId)) viser(ev); });
  barre.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    const phase = (horloge.phase + (ev.key === 'ArrowRight' ? 0.02 : 0.98)) % 1;
    horloge.phase = phase;
    modifier({ battement: { lecture: false, phase } });
  });
  let phaseAffichee = -1;
  function dessinerTemps() {
    const phase = horloge.phase;
    curseurCycle.style.left = `${(phase * 100).toFixed(2)}%`;
    const i = phase < PHASES[0] ? 0 : phase < PHASES[0] + PHASES[1] ? 1 : 2;
    if (i !== phaseAffichee) {
      phaseAffichee = i;
      phaseNom.textContent = NIVEAUX[lire().niveau].phases[i];
      barre.dataset.phase = String(i);
    }
  }

  // ── Mise à jour à chaque changement de l'instant ──
  function dessiner(e) {
    const n = NIVEAUX[e.niveau];
    $('lecon-titre').textContent = n.lecon;
    $('lecon-competence').textContent = n.competence;
    for (const b of niveaux.children) b.classList.toggle('actif', b.dataset.id === e.niveau);
    const mode = modeActif(e);
    for (const b of modes.children) b.classList.toggle('actif', b.dataset.id === mode);
    $('b-etiquettes').classList.toggle('actif', e.etiquettes);
    const reglage = $('reglage');
    reglage.hidden = mode === 'externe';
    if (mode === 'coupe') {
      $('reglage-nom').textContent = 'Profondeur de la coupe';
      curseur.min = '-2.6'; curseur.max = '2.4'; curseur.step = '0.05';
      curseur.value = String(-e.coupe.position);
    } else if (mode === 'eclatee') {
      $('reglage-nom').textContent = 'Écartement des pièces';
      curseur.min = '0.05'; curseur.max = '1'; curseur.step = '0.01';
      curseur.value = String(e.eclate);
    }
    $('lecture-forme').setAttribute('d', e.battement.lecture ? PAUSE : LECTURE);
    $('vitesse').textContent = e.battement.vitesse === 1 ? 'Vitesse réelle' : `Ralenti ×${String(e.battement.vitesse).replace('.', ',')}`;
    $('bpm').textContent = String(e.battement.bpm);
    phaseAffichee = -1;
    dessinerArbre(e);
    dessinerFiche(e);
    dessinerTemps();
  }
  abonner((e, avant, source) => { if (source !== 'camera') dessiner(e); });
  dessiner(lire());

  $('ouvrir-structures').addEventListener('click', () => document.body.classList.toggle('structures-ouvertes'));
  return { dessinerTemps, selectionner };
}
