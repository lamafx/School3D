// Le cœur : chargement du modèle, puis application de l'instant (visibilité, coupe, vue éclatée, battement).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { PIECES, PIECE_PAR_ID, PHASES } from '../donnees/coeur.js';

// Lancers de rayon accélérés : indispensables pour le clic et pour savoir si une étiquette est cachée.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Centres autour desquels chaque partie se contracte.
const PIVOTS = {
  ventricules: new THREE.Vector3(0, 1.0, 0.2),
  oreillette_droite: new THREE.Vector3(-2.8, 1.2, -0.4),
  oreillette_gauche: new THREE.Vector3(2.9, 1.2, -0.6),
};

// État mécanique du cœur pour une phase donnée (0..1) de la révolution cardiaque.
export function mecanique(phase) {
  const a = PHASES[0], v = a + PHASES[1];
  const oreillettes = lisse(0, a * 0.85, phase) * (1 - lisse(a, a * 2, phase));
  const ventricules = lisse(a, a + 0.17, phase) * (1 - lisse(v, v + 0.18, phase));
  const avFermee = lisse(a, a + 0.035, phase) * (1 - lisse(v + 0.01, v + 0.07, phase));
  const sigmoideOuverte = lisse(a + 0.04, a + 0.08, phase) * (1 - lisse(v - 0.04, v, phase));
  return { oreillettes, ventricules, avFermee, sigmoideOuverte };
}

export async function chargerCoeur(vis) {
  const url = `${import.meta.env.BASE_URL}modeles/coeur.glb`;
  const gltf = await new GLTFLoader().loadAsync(url);
  const racine = gltf.scene;
  vis.scene.add(racine);

  const plan = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const pieces = new Map();
  const cliquables = [];

  racine.traverse((o) => {
    if (!o.isMesh) return;
    const id = o.userData.piece || o.name.split('__')[0];
    const def = PIECE_PAR_ID.get(id);
    if (!def) { o.visible = false; return; }
    const ferme = o.userData.ferme === true;
    const feuillet = def.groupe === 'valvules';
    const nodal = def.groupe === 'nodal';
    o.material = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: feuillet ? 0.55 : 0.4,
      clearcoat: feuillet || nodal ? 0 : 0.55,
      clearcoatRoughness: 0.28,
      side: feuillet ? THREE.DoubleSide : THREE.FrontSide,
      emissive: nodal ? 0x6b5200 : 0x000000,
    });
    o.userData.emissifBase = o.material.emissive.getHex();
    let p = pieces.get(id);
    if (!p) {
      p = { id, def, maillages: [], capots: [], ancres: [], decalage: new THREE.Vector3(), visible: true };
      pieces.set(id, p);
    }
    p.maillages.push(o);
    for (const a of o.userData.ancres || []) {
      p.ancres.push({ p: new THREE.Vector3(a[0], a[1], a[2]), n: new THREE.Vector3(a[3], a[4], a[5]), ext: a[6] === 1 });
    }
    o.userData.pieceId = id;
    if (!o.morphTargetInfluences) o.geometry.computeBoundsTree();
    cliquables.push(o);
    // Face de coupe : l'envers d'un volume fermé, peint d'une couleur unie, donne l'illusion d'une tranche pleine.
    if (ferme && def.coupe) {
      const capot = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({
        color: def.coupe, side: THREE.BackSide,
        // La tranche passe devant la paroi de la pièce voisine, qui occupe exactement la même surface.
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1500,
      }));
      capot.visible = false;
      capot.raycast = () => {};
      o.add(capot);
      p.capots.push(capot);
    }
  });

  const manquantes = PIECES.filter((d) => !pieces.has(d.id)).map((d) => d.id);
  if (manquantes.length) console.warn('Pièces absentes du modèle :', manquantes.join(', '));

  const rayon = new THREE.Raycaster();
  const sonde = new THREE.Raycaster();
  const direction = new THREE.Vector3();
  let visibles = [];
  const souris = new THREE.Vector2();
  const ech = new THREE.Vector3();
  let eclateCourant = 0, eclateCible = 0, coupe = { active: false, position: 0 };
  let selection = null, survol = null;

  const teinter = () => {
    for (const p of pieces.values()) {
      const force = p.id === selection ? 0.42 : p.id === survol ? 0.16 : 0;
      for (const m of p.maillages) {
        m.material.emissive.setHex(m.userData.emissifBase);
        if (force) m.material.emissive.lerp(new THREE.Color(0xff8a3c), force);
      }
    }
  };

  const modele = {
    pieces,
    plan,
    get eclate() { return eclateCourant; },
    get coupe() { return coupe; },

    appliquer(etat) {
      for (const p of pieces.values()) {
        p.visible = p.def.niveaux.includes(etat.niveau)
          && !etat.masquees.includes(p.id)
          && (!etat.isolee || etat.isolee === p.id);
        for (const m of p.maillages) m.visible = p.visible;
        for (const c of p.capots) c.visible = etat.coupe.active;
      }
      visibles = cliquables.filter((m) => m.visible);
      coupe = etat.coupe;
      plan.constant = coupe.position;
      vis.renderer.clippingPlanes = coupe.active ? [plan] : [];
      eclateCible = etat.eclate;
      selection = etat.selection;
      teinter();
      vis.sale = true;
    },

    survoler(id) {
      if (id === survol) return;
      survol = id;
      teinter();
      vis.sale = true;
    },

    // Avance les animations. Renvoie true si quelque chose a bougé.
    animer(dt, phase, bouge) {
      let anime = bouge;
      if (Math.abs(eclateCible - eclateCourant) > 0.0005) {
        eclateCourant += (eclateCible - eclateCourant) * Math.min(1, dt * 6);
        anime = true;
      } else {
        eclateCourant = eclateCible;
      }
      const m = mecanique(phase);
      for (const p of pieces.values()) {
        const e = p.def.eclate;
        p.decalage.set(e[0], e[1], e[2]).multiplyScalar(eclateCourant);
        const mvt = p.def.mouvement;
        if (mvt === 'ventricules') ech.set(1 - 0.085 * m.ventricules, 1 - 0.05 * m.ventricules, 1 - 0.085 * m.ventricules);
        else if (mvt === 'oreillette_droite' || mvt === 'oreillette_gauche') ech.setScalar(1 - 0.07 * m.oreillettes + 0.025 * m.ventricules);
        else ech.setScalar(1);
        const pivot = PIVOTS[mvt];
        for (const mesh of p.maillages) {
          mesh.scale.copy(ech);
          mesh.position.copy(p.decalage);
          if (pivot) {
            mesh.position.x += pivot.x * (1 - ech.x);
            mesh.position.y += pivot.y * (1 - ech.y);
            mesh.position.z += pivot.z * (1 - ech.z);
          }
          if (mesh.morphTargetInfluences) {
            mesh.morphTargetInfluences[0] = mvt === 'valvule_av' ? 1 - m.avFermee : m.sigmoideOuverte;
          }
        }
      }
      return anime;
    },

    // Pièce sous le pointeur (coordonnées en pixels dans la vue), en ignorant ce que la coupe a retiré.
    pieceSous(x, y) {
      souris.set((x / vis.largeur) * 2 - 1, -(y / vis.hauteur) * 2 + 1);
      rayon.setFromCamera(souris, vis.camera);
      for (const touche of rayon.intersectObjects(visibles, false)) {
        if (coupe.active && plan.distanceToPoint(touche.point) < 0) continue;
        return touche.object.userData.pieceId;
      }
      return null;
    },

    // Vrai si rien ne cache ce point vu depuis la caméra (la partie retirée par la coupe ne compte pas).
    estVisible(point) {
      const origine = vis.camera.position;
      const distance = direction.copy(point).sub(origine).length();
      sonde.set(origine, direction.divideScalar(distance));
      sonde.far = distance;
      for (const touche of sonde.intersectObjects(visibles, false)) {
        if (coupe.active && plan.distanceToPoint(touche.point) < 0) continue;
        return touche.distance > distance - 0.6; // tolérance : la paroi bouge avec le battement
      }
      return true;
    },
  };
  return modele;
}
