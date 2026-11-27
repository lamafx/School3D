// Étiquettes reliées aux pièces par un trait, rangées en deux colonnes comme sur un schéma annoté.
import * as THREE from 'three';

const SVG = 'http://www.w3.org/2000/svg';
const CENTRE = new THREE.Vector3(0.5, 0.7, -0.2);
const ECART = 25; // espacement vertical minimal entre deux étiquettes, en pixels

function etaler(liste, haut, bas) {
  liste.sort((a, b) => a.sy - b.sy);
  let y = -Infinity;
  for (const e of liste) { e.ly = Math.max(e.sy, y + ECART, haut); y = e.ly; }
  y = bas;
  for (let i = liste.length - 1; i >= 0; i--) { liste[i].ly = Math.min(liste[i].ly, y); y = liste[i].ly - ECART; }
}

export class Etiquettes {
  constructor(conteneur, vis, modele, surClic) {
    this.vis = vis;
    this.modele = modele;
    this.racine = document.createElement('div');
    this.racine.className = 'etiquettes';
    this.svg = document.createElementNS(SVG, 'svg');
    this.racine.append(this.svg);
    conteneur.append(this.racine);
    this.elements = new Map();
    for (const p of modele.pieces.values()) {
      const bouton = document.createElement('button');
      bouton.className = 'etiquette';
      bouton.type = 'button';
      bouton.textContent = p.def.nom;
      bouton.addEventListener('click', () => surClic(p.id));
      const trait = document.createElementNS(SVG, 'polyline');
      const point = document.createElementNS(SVG, 'circle');
      point.setAttribute('r', '2.6');
      this.svg.append(trait, point);
      this.racine.append(bouton);
      this.elements.set(p.id, { bouton, trait, point, ancre: null, largeur: 0 });
    }
    this.mesurer();
    window.addEventListener('resize', () => this.mesurer());
    this.v = new THREE.Vector3();
    this.w = new THREE.Vector3();
  }

  mesurer() {
    for (const el of this.elements.values()) {
      const avant = el.bouton.style.display;
      el.bouton.style.display = '';
      el.largeur = el.bouton.offsetWidth;
      el.bouton.style.display = avant;
    }
    this.vis.sale = true;
  }

  // Meilleur point d'ancrage : tourné vers la caméra, non retiré par la coupe, et que rien ne cache.
  choisirAncre(p, el, etat) {
    const cam = this.vis.camera.position;
    const candidats = [];
    for (const a of p.ancres) {
      this.v.copy(a.p).add(p.decalage);
      if (etat.coupe.active && this.modele.plan.distanceToPoint(this.v) < 0.08) continue;
      let s = this.w.copy(cam).sub(this.v).normalize().dot(a.n);
      if (s < 0.12) continue;
      if (a === el.ancre) s += 0.3; // évite que l'étiquette saute d'un point à l'autre
      candidats.push({ a, s });
    }
    candidats.sort((x, y) => y.s - x.s);
    el.ancre = null;
    for (const c of candidats) {
      if (this.modele.estVisible(this.v.copy(c.a.p).add(p.decalage))) { el.ancre = c.a; break; }
    }
    return el.ancre;
  }

  mettreAJour(etat) {
    const { vis, modele } = this;
    const l = vis.largeur, h = vis.hauteur;
    this.racine.classList.toggle('cachees', !etat.etiquettes);
    if (!etat.etiquettes) return;

    const c = this.v.copy(CENTRE).project(vis.camera);
    const cx = (c.x * 0.5 + 0.5) * l;
    const dist = vis.camera.position.distanceTo(CENTRE);
    const rayonMonde = 7.6 + 5 * modele.eclate;
    const rayonPx = (rayonMonde / (dist * Math.tan((vis.camera.fov * Math.PI) / 360))) * (h / 2);

    const gauche = [], droite = [];
    for (const p of modele.pieces.values()) {
      const el = this.elements.get(p.id);
      const a = p.visible ? this.choisirAncre(p, el, etat) : null;
      let montre = false;
      if (a) {
        const s = this.v.copy(a.p).add(p.decalage).project(vis.camera);
        const sx = (s.x * 0.5 + 0.5) * l, sy = (-s.y * 0.5 + 0.5) * h;
        if (s.z < 1 && sx > 0 && sx < l && sy > 0 && sy < h) {
          montre = true;
          (sx < cx ? gauche : droite).push({ el, sx, sy, ly: sy, id: p.id });
        }
      }
      if (!montre) {
        el.bouton.style.display = 'none';
        el.trait.style.display = 'none';
        el.point.style.display = 'none';
      }
    }
    const haut = 64, bas = h - 96;
    etaler(gauche, haut, bas);
    etaler(droite, haut, bas);
    const poser = (e, x, aGauche) => {
      const { bouton, trait, point } = e.el;
      bouton.style.display = '';
      trait.style.display = '';
      point.style.display = '';
      bouton.classList.toggle('a-gauche', aGauche);
      bouton.classList.toggle('active', etat.selection === e.id);
      bouton.style.transform = `translate(${Math.round(x)}px, ${Math.round(e.ly)}px)`;
      const coude = aGauche ? x + 14 : x - 14;
      const bord = aGauche ? x + 4 : x - 4;
      trait.setAttribute('points', `${e.sx.toFixed(1)},${e.sy.toFixed(1)} ${coude.toFixed(1)},${e.ly.toFixed(1)} ${bord.toFixed(1)},${e.ly.toFixed(1)}`);
      trait.classList.toggle('active', etat.selection === e.id);
      point.setAttribute('cx', e.sx.toFixed(1));
      point.setAttribute('cy', e.sy.toFixed(1));
    };
    // Les colonnes longent le cœur, sans jamais laisser une étiquette sortir de la vue.
    const plusLarge = (liste) => liste.reduce((m, e) => Math.max(m, e.el.largeur), 0);
    const xGauche = Math.max(plusLarge(gauche) + 6, Math.min(cx - rayonPx - 14, l * 0.5 - 60));
    const xDroite = Math.min(l - plusLarge(droite) - 6, Math.max(cx + rayonPx + 14, l * 0.5 + 60));
    for (const e of gauche) poser(e, xGauche, true);
    for (const e of droite) poser(e, xDroite, false);
  }
}
