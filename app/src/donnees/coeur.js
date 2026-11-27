// Liste des pièces du cœur. Les identifiants sont aussi les noms des maillages dans public/modeles/coeur.glb.
// Les textes sont provisoires : ils doivent être relus par un professeur de SVT avant diffusion.

export const NIVEAUX = {
  '3e': {
    nom: '3ème',
    competence: 'Compétence 1 : la nutrition chez l’Homme',
    lecon: 'Leçon 5 : La circulation sanguine',
    intro: 'Le cœur est un muscle creux qui met le sang en mouvement. Une cloison le sépare en deux moitiés, droite et gauche, qui ne communiquent pas.',
    phases: ['Les oreillettes se contractent', 'Les ventricules se contractent', 'Le cœur se relâche'],
  },
  tle: {
    nom: 'Terminale D',
    competence: 'Compétence 2 : la communication dans l’organisme',
    lecon: 'Leçon 4 : Le fonctionnement du cœur',
    intro: 'Le cœur bat de lui-même : l’excitation naît dans le tissu nodal, puis gagne tout le myocarde. Chaque battement est une révolution cardiaque en trois phases.',
    phases: ['Systole auriculaire', 'Systole ventriculaire', 'Diastole générale'],
  },
};

// Part de chaque phase dans une révolution cardiaque de 0,8 s (75 battements par minute).
export const PHASES = [0.125, 0.375, 0.5];

export const GROUPES = [
  { id: 'cavites', nom: 'Cavités du cœur' },
  { id: 'valvules', nom: 'Valvules' },
  { id: 'vaisseaux', nom: 'Gros vaisseaux' },
  { id: 'coronaires', nom: 'Vaisseaux du cœur' },
  { id: 'nodal', nom: 'Tissu nodal' },
];

const TOUS = ['3e', 'tle'];

export const PIECES = [
  {
    id: 'oreillette_droite', nom: 'Oreillette droite', groupe: 'cavites', niveaux: TOUS,
    pastille: '#a54a41', coupe: '#b9584e', eclate: [-4.4, 1.7, 0], mouvement: 'oreillette_droite',
    texte: {
      '3e': 'Cavité du haut, à droite du cœur. Elle reçoit par les veines caves le sang pauvre en dioxygène qui revient des organes, puis le fait passer dans le ventricule droit.',
      tle: 'Elle reçoit par les veines caves le sang pauvre en dioxygène. Sa paroi abrite le nœud sinusal, où naît chaque battement. Sa contraction (systole auriculaire) achève le remplissage du ventricule droit.',
    },
  },
  {
    id: 'oreillette_gauche', nom: 'Oreillette gauche', groupe: 'cavites', niveaux: TOUS,
    pastille: '#a54a41', coupe: '#b9584e', eclate: [4.6, 1.7, -0.4], mouvement: 'oreillette_gauche',
    texte: {
      '3e': 'Cavité du haut, à gauche du cœur. Elle reçoit par les veines pulmonaires le sang riche en dioxygène qui revient des poumons, puis le fait passer dans le ventricule gauche.',
      tle: 'Elle reçoit par les veines pulmonaires le sang riche en dioxygène. Sa contraction (systole auriculaire) achève le remplissage du ventricule gauche.',
    },
  },
  {
    id: 'ventricule_droit', nom: 'Ventricule droit', groupe: 'cavites', niveaux: TOUS,
    pastille: '#b24a3d', coupe: '#c55b4f', eclate: [-3.3, -2.3, 0.6], mouvement: 'ventricules',
    texte: {
      '3e': 'Cavité du bas, à droite du cœur. En se contractant, il chasse le sang pauvre en dioxygène vers les poumons par l’artère pulmonaire.',
      tle: 'Pendant la systole ventriculaire, il éjecte le sang pauvre en dioxygène dans l’artère pulmonaire. Sa paroi est plus mince que celle du ventricule gauche, car la petite circulation oppose moins de résistance.',
    },
  },
  {
    id: 'ventricule_gauche', nom: 'Ventricule gauche', groupe: 'cavites', niveaux: TOUS,
    pastille: '#b24a3d', coupe: '#c55b4f', eclate: [3.3, -2.3, 0.3], mouvement: 'ventricules',
    texte: {
      '3e': 'Cavité du bas, à gauche du cœur. En se contractant, il chasse le sang riche en dioxygène vers tous les organes par l’aorte. Sa paroi est la plus épaisse du cœur.',
      tle: 'Pendant la systole ventriculaire, il éjecte le sang riche en dioxygène dans l’aorte. Sa paroi épaisse lui permet de propulser le sang dans toute la grande circulation.',
    },
  },
  {
    id: 'cloison', nom: 'Cloison interventriculaire', groupe: 'cavites', niveaux: TOUS, interne: true,
    pastille: '#c55b4f', coupe: '#cf675a', eclate: [0, -2.3, 0.4], mouvement: 'ventricules',
    texte: {
      '3e': 'Paroi musculaire étanche qui sépare le ventricule droit du ventricule gauche. Grâce à elle, le sang pauvre et le sang riche en dioxygène ne se mélangent jamais.',
      tle: 'Paroi musculaire qui sépare les deux ventricules. Elle est parcourue par le faisceau de His, qui conduit l’excitation vers la pointe du cœur.',
    },
  },
  {
    id: 'valvule_tricuspide', nom: 'Valvule tricuspide', groupe: 'valvules', niveaux: TOUS, interne: true,
    pastille: '#ead8c2', eclate: [-3.8, -0.3, 0.2], mouvement: 'valvule_av',
    texte: {
      '3e': 'Valvule auriculo-ventriculaire droite. Elle laisse passer le sang de l’oreillette droite vers le ventricule droit et l’empêche de revenir en arrière.',
      tle: 'Valvule auriculo-ventriculaire droite, à trois lames. Elle se ferme au début de la systole ventriculaire et s’ouvre pendant la diastole.',
    },
  },
  {
    id: 'valvule_mitrale', nom: 'Valvule mitrale', groupe: 'valvules', niveaux: TOUS, interne: true,
    pastille: '#ead8c2', eclate: [4.0, -0.3, 0], mouvement: 'valvule_av',
    texte: {
      '3e': 'Valvule auriculo-ventriculaire gauche. Elle laisse passer le sang de l’oreillette gauche vers le ventricule gauche et l’empêche de revenir en arrière.',
      tle: 'Valvule auriculo-ventriculaire gauche, à deux lames. Elle se ferme au début de la systole ventriculaire et s’ouvre pendant la diastole.',
    },
  },
  {
    id: 'valvule_aortique', nom: 'Valvule sigmoïde aortique', groupe: 'valvules', niveaux: TOUS, interne: true,
    pastille: '#ead8c2', eclate: [0.2, 1.4, 0], mouvement: 'valvule_sigmoide',
    texte: {
      '3e': 'Valvule placée à l’entrée de l’aorte. Elle s’ouvre quand le ventricule gauche se contracte, puis se referme pour empêcher le sang de retomber dans le ventricule.',
      tle: 'Valvule sigmoïde à l’origine de l’aorte. Elle s’ouvre quand la pression du ventricule gauche dépasse celle de l’aorte, et se ferme à la fin de la systole ventriculaire.',
    },
  },
  {
    id: 'valvule_pulmonaire', nom: 'Valvule sigmoïde pulmonaire', groupe: 'valvules', niveaux: TOUS, interne: true,
    pastille: '#ead8c2', eclate: [-0.4, 0.6, 2.4], mouvement: 'valvule_sigmoide',
    texte: {
      '3e': 'Valvule placée à l’entrée de l’artère pulmonaire. Elle s’ouvre quand le ventricule droit se contracte, puis se referme pour empêcher le sang de retomber dans le ventricule.',
      tle: 'Valvule sigmoïde à l’origine de l’artère pulmonaire. Elle s’ouvre pendant l’éjection ventriculaire et se ferme à la fin de la systole.',
    },
  },
  {
    id: 'aorte', nom: 'Aorte', groupe: 'vaisseaux', niveaux: TOUS,
    pastille: '#d0553d', coupe: '#e39a86', eclate: [0.2, 4.8, -0.2],
    texte: {
      '3e': 'La plus grosse artère du corps. Elle part du ventricule gauche et distribue le sang riche en dioxygène à tous les organes.',
      tle: 'Artère qui part du ventricule gauche : c’est le départ de la grande circulation. La pression artérielle se mesure dans les artères qui en dérivent.',
    },
  },
  {
    id: 'artere_pulmonaire', nom: 'Artère pulmonaire', groupe: 'vaisseaux', niveaux: TOUS,
    pastille: '#8479b3', coupe: '#b3aad2', eclate: [0.2, 2.6, 4.4],
    texte: {
      '3e': 'Elle part du ventricule droit et conduit le sang pauvre en dioxygène vers les poumons. Elle se divise en deux branches, une pour chaque poumon.',
      tle: 'Artère qui part du ventricule droit : c’est le départ de la petite circulation. Elle conduit vers les poumons un sang pauvre en dioxygène.',
    },
  },
  {
    id: 'veine_cave_superieure', nom: 'Veine cave supérieure', groupe: 'vaisseaux', niveaux: TOUS,
    pastille: '#6471ab', coupe: '#99a2c9', eclate: [-5.2, 4.6, 0],
    texte: {
      '3e': 'Elle ramène à l’oreillette droite le sang pauvre en dioxygène venu de la tête et des bras.',
      tle: 'Elle ramène à l’oreillette droite le sang pauvre en dioxygène venu de la partie supérieure du corps.',
    },
  },
  {
    id: 'veine_cave_inferieure', nom: 'Veine cave inférieure', groupe: 'vaisseaux', niveaux: TOUS,
    pastille: '#6471ab', coupe: '#99a2c9', eclate: [-5.4, -0.9, -1.4],
    texte: {
      '3e': 'Elle ramène à l’oreillette droite le sang pauvre en dioxygène venu du tronc et des jambes.',
      tle: 'Elle ramène à l’oreillette droite le sang pauvre en dioxygène venu de la partie inférieure du corps.',
    },
  },
  {
    id: 'veines_pulmonaires', nom: 'Veines pulmonaires', groupe: 'vaisseaux', niveaux: TOUS,
    pastille: '#cf7268', coupe: '#dfa69c', eclate: [5.6, 2.6, -3.4],
    texte: {
      '3e': 'Quatre veines qui ramènent à l’oreillette gauche le sang riche en dioxygène venu des poumons.',
      tle: 'Quatre veines qui ramènent à l’oreillette gauche le sang riche en dioxygène : elles terminent la petite circulation.',
    },
  },
  {
    id: 'arteres_coronaires', nom: 'Artères coronaires', groupe: 'coronaires', niveaux: TOUS,
    pastille: '#c2201f', eclate: [0, -2.3, 3.4], mouvement: 'ventricules',
    texte: {
      '3e': 'Petites artères qui naissent de l’aorte et courent à la surface du cœur. Elles apportent au muscle cardiaque le dioxygène et les nutriments dont il a besoin.',
      tle: 'Artères nées de l’aorte qui irriguent le myocarde. Si l’une d’elles se bouche, la zone qu’elle nourrit cesse de se contracter.',
    },
  },
  {
    id: 'veines_coronaires', nom: 'Veines coronaires', groupe: 'coronaires', niveaux: TOUS,
    pastille: '#2f4da6', eclate: [0, -2.3, 4.6], mouvement: 'ventricules',
    texte: {
      '3e': 'Petites veines à la surface du cœur. Elles récupèrent le sang qui a nourri le muscle cardiaque et le ramènent à l’oreillette droite.',
      tle: 'Veines qui drainent le myocarde et ramènent son sang à l’oreillette droite.',
    },
  },
  {
    id: 'noeud_sinusal', nom: 'Nœud sinusal', groupe: 'nodal', niveaux: ['tle'], interne: true,
    pastille: '#f4cf2e', eclate: [-4.4, 1.7, 0], mouvement: 'oreillette_droite',
    texte: {
      tle: 'Amas de tissu nodal dans la paroi de l’oreillette droite. Il produit spontanément, à un rythme régulier, l’excitation qui déclenche chaque battement : c’est l’origine de l’automatisme cardiaque.',
    },
  },
  {
    id: 'noeud_septal', nom: 'Nœud septal', groupe: 'nodal', niveaux: ['tle'], interne: true,
    pastille: '#f4cf2e', eclate: [-4.4, 1.7, 0], mouvement: 'oreillette_droite',
    texte: {
      tle: 'Second amas de tissu nodal, à la base de l’oreillette droite, près de la cloison. Il reçoit l’excitation venue du nœud sinusal et la transmet au faisceau de His.',
    },
  },
  {
    id: 'faisceau_de_his', nom: 'Faisceau de His', groupe: 'nodal', niveaux: ['tle'], interne: true,
    pastille: '#f4cf2e', eclate: [0, -2.3, 0.4], mouvement: 'ventricules',
    texte: {
      tle: 'Faisceau de tissu nodal qui part du nœud septal, descend dans la cloison interventriculaire et se divise en deux branches. Il conduit l’excitation vers la pointe des ventricules.',
    },
  },
  {
    id: 'reseau_de_purkinje', nom: 'Réseau de Purkinje', groupe: 'nodal', niveaux: ['tle'], interne: true,
    pastille: '#f4cf2e', eclate: [0, -2.3, 0.4], mouvement: 'ventricules',
    texte: {
      tle: 'Ramifications du faisceau de His dans la paroi des ventricules. Elles distribuent l’excitation à tout le myocarde ventriculaire, qui se contracte alors de la pointe vers la base.',
    },
  },
];

export const PIECE_PAR_ID = new Map(PIECES.map((p) => [p.id, p]));
export const piecesDuNiveau = (niveau) => PIECES.filter((p) => p.niveaux.includes(niveau));
