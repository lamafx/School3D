import { lire, modifier, abonner, instantDepuisUrl } from './etat.js';
import { Visionneuse } from './scene/visionneuse.js';
import { chargerCoeur } from './scene/modele.js';
import { Etiquettes } from './scene/etiquettes.js';
import { construireInterface } from './ui/interface.js';

const scene = document.getElementById('scene');
const chargement = document.getElementById('chargement');

const depart = instantDepuisUrl();
if (depart) modifier(depart, 'url');

// L'horloge du battement avance à chaque image ; l'instant ne garde la phase qu'aux moments clés.
const horloge = { phase: lire().battement.phase };

async function demarrer() {
  const vis = new Visionneuse(scene);
  vis.placer(lire().camera.position, lire().camera.cible);

  const modele = await chargerCoeur(vis);
  const ui = construireInterface({ vis, horloge });
  const etiquettes = new Etiquettes(scene, vis, modele, (id) => ui.selectionner(id));
  chargement.remove();

  modele.appliquer(lire());
  let etiquettesSales = true;
  abonner((e, avant, source) => {
    if (source === 'camera') return;
    modele.appliquer(e);
    etiquettesSales = true;
    if (source !== 'ui' && e.camera !== avant.camera) vis.allerA(e.camera.position, e.camera.cible);
    if (e.battement.phase !== avant.battement.phase) horloge.phase = e.battement.phase;
  });
  vis.surFinDeGeste = () => modifier({ camera: vis.lireCamera() }, 'camera');

  // Sélection au clic (sans glissement) et survol à la souris.
  let appui = null;
  vis.canvas.addEventListener('pointerdown', (ev) => { appui = { x: ev.clientX, y: ev.clientY }; });
  vis.canvas.addEventListener('pointerup', (ev) => {
    if (!appui || Math.hypot(ev.clientX - appui.x, ev.clientY - appui.y) > 6) return;
    const r = vis.canvas.getBoundingClientRect();
    const id = modele.pieceSous(ev.clientX - r.left, ev.clientY - r.top);
    modifier({ selection: id && id !== lire().selection ? id : null });
  });
  let dernierSurvol = 0;
  vis.canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || ev.buttons) return;
    const maintenant = performance.now();
    if (maintenant - dernierSurvol < 60) return;
    dernierSurvol = maintenant;
    const r = vis.canvas.getBoundingClientRect();
    const id = modele.pieceSous(ev.clientX - r.left, ev.clientY - r.top);
    modele.survoler(id);
    vis.canvas.style.cursor = id ? 'pointer' : '';
  });
  vis.canvas.addEventListener('pointerleave', () => modele.survoler(null));

  vis.demarrer(
    (dt) => {
      const b = lire().battement;
      if (b.lecture) horloge.phase = (horloge.phase + (dt * b.vitesse * b.bpm) / 60) % 1;
      const anime = modele.animer(dt, horloge.phase, b.lecture);
      if (b.lecture) ui.dessinerTemps();
      if (modele.eclate !== lire().eclate) etiquettesSales = true;
      return anime;
    },
    (vueChangee) => {
      if (vueChangee || etiquettesSales) {
        etiquettesSales = false;
        etiquettes.mettreAJour(lire());
      }
    },
  );
}

demarrer().catch((erreur) => {
  console.error(erreur);
  chargement.textContent = 'Le cœur n’a pas pu être chargé. Rechargez la page.';
  chargement.classList.add('erreur');
});
