// La vue 3D : rendu, caméra, éclairage et boucle d'animation.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class Visionneuse {
  constructor(conteneur) {
    this.conteneur = conteneur;
    // ?capture dans l'adresse : garde l'image en mémoire pour les captures d'écran automatiques.
    const capture = new URLSearchParams(location.search).has('capture');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: capture });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'toile';
    conteneur.prepend(this.canvas);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.75;
    pmrem.dispose();

    const cle = new THREE.DirectionalLight(0xfff1e6, 2.4);
    cle.position.set(6, 10, 14);
    const contre = new THREE.DirectionalLight(0x9db8ff, 1.1);
    contre.position.set(-10, 4, -12);
    this.scene.add(cle, contre);

    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 300);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 90;
    this.controls.addEventListener('change', () => { this.sale = true; });
    this.controls.addEventListener('end', () => this.surFinDeGeste?.());

    this.sale = true;
    this.trajet = null;
    this.largeur = 1;
    this.hauteur = 1;
    new ResizeObserver(() => this.redimensionner()).observe(conteneur);
    this.redimensionner();
  }

  redimensionner() {
    const l = Math.max(1, this.conteneur.clientWidth), h = Math.max(1, this.conteneur.clientHeight);
    this.largeur = l;
    this.hauteur = h;
    this.renderer.setSize(l, h, false);
    this.camera.aspect = l / h;
    // Sur un écran étroit, on élargit le champ pour garder le cœur entier.
    this.camera.fov = l / h < 0.9 ? 30 / Math.max(0.62, l / h / 0.9) : 30;
    this.camera.updateProjectionMatrix();
    this.sale = true;
  }

  placer(position, cible) {
    this.camera.position.fromArray(position);
    this.controls.target.fromArray(cible);
    this.controls.update();
    this.sale = true;
  }

  allerA(position, cible, duree = 0.7) {
    this.trajet = {
      t: 0, duree,
      p0: this.camera.position.clone(), c0: this.controls.target.clone(),
      p1: new THREE.Vector3().fromArray(position), c1: new THREE.Vector3().fromArray(cible),
    };
  }

  lireCamera() {
    const a = (v) => v.toArray().map((x) => Math.round(x * 100) / 100);
    return { position: a(this.camera.position), cible: a(this.controls.target) };
  }

  // surImage(dt) renvoie true tant qu'une animation tourne ; sinon on ne redessine que si la vue a changé.
  demarrer(surImage, apresRendu) {
    const horloge = new THREE.Clock();
    const boucle = () => {
      requestAnimationFrame(boucle);
      const dt = Math.min(horloge.getDelta(), 0.1);
      if (this.trajet) {
        const tr = this.trajet;
        tr.t = Math.min(1, tr.t + dt / tr.duree);
        const k = tr.t * tr.t * (3 - 2 * tr.t);
        this.camera.position.lerpVectors(tr.p0, tr.p1, k);
        this.controls.target.lerpVectors(tr.c0, tr.c1, k);
        if (tr.t >= 1) { this.trajet = null; this.surFinDeGeste?.(); }
        this.sale = true;
      }
      this.controls.update();
      const anime = surImage(dt);
      if (anime || this.sale) {
        const vueChangee = this.sale;
        this.sale = false;
        this.renderer.render(this.scene, this.camera);
        apresRendu?.(vueChangee);
      }
    };
    boucle();
  }
}
