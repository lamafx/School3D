// Écriture d'un fichier .glb (glTF binaire) minimal : une liste de maillages nommés, posés à la racine.
// Chaque nœud : { nom, positions, normales, indices, couleurs? (Uint8 RGBA), cible? (positions de la forme « ouverte »), extras? }

export function ecrireGlb(noeuds) {
  const morceaux = [];
  let taille = 0;
  const bufferViews = [], accessors = [], meshes = [], nodes = [];

  const vue = (tableau, cible) => {
    const octets = new Uint8Array(tableau.buffer, tableau.byteOffset, tableau.byteLength);
    const marge = (4 - (taille % 4)) % 4;
    if (marge) { morceaux.push(new Uint8Array(marge)); taille += marge; }
    bufferViews.push({ buffer: 0, byteOffset: taille, byteLength: octets.byteLength, ...(cible ? { target: cible } : {}) });
    morceaux.push(octets);
    taille += octets.byteLength;
    return bufferViews.length - 1;
  };
  const bornes = (t) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < t.length; i += 3) for (let c = 0; c < 3; c++) {
      if (t[i + c] < min[c]) min[c] = t[i + c];
      if (t[i + c] > max[c]) max[c] = t[i + c];
    }
    return { min, max };
  };
  const acc = (o) => { accessors.push(o); return accessors.length - 1; };

  for (const n of noeuds) {
    const nv = n.positions.length / 3;
    const attributes = {
      POSITION: acc({ bufferView: vue(n.positions, 34962), componentType: 5126, count: nv, type: 'VEC3', ...bornes(n.positions) }),
      NORMAL: acc({ bufferView: vue(n.normales, 34962), componentType: 5126, count: nv, type: 'VEC3' }),
    };
    if (n.couleurs) {
      attributes.COLOR_0 = acc({ bufferView: vue(n.couleurs, 34962), componentType: 5121, normalized: true, count: nv, type: 'VEC4' });
    }
    const petit = nv < 65535;
    const ind = petit ? new Uint16Array(n.indices) : n.indices;
    const primitive = {
      attributes,
      indices: acc({ bufferView: vue(ind, 34963), componentType: petit ? 5123 : 5125, count: ind.length, type: 'SCALAR' }),
      mode: 4,
    };
    const mesh = { name: n.nom, primitives: [primitive] };
    if (n.cible) {
      const delta = new Float32Array(n.positions.length);
      for (let i = 0; i < delta.length; i++) delta[i] = n.cible[i] - n.positions[i];
      primitive.targets = [{ POSITION: acc({ bufferView: vue(delta), componentType: 5126, count: nv, type: 'VEC3', ...bornes(delta) }) }];
      mesh.weights = [0];
      mesh.extras = { targetNames: ['ouverte'] };
    }
    meshes.push(mesh);
    nodes.push({ name: n.nom, mesh: meshes.length - 1, ...(n.extras ? { extras: n.extras } : {}) });
  }

  const margeBin = (4 - (taille % 4)) % 4;
  if (margeBin) { morceaux.push(new Uint8Array(margeBin)); taille += margeBin; }

  const json = {
    asset: { version: '2.0', generator: 'lab-3d generer-coeur' },
    scene: 0,
    scenes: [{ name: 'coeur', nodes: nodes.map((_, i) => i) }],
    nodes, meshes, accessors, bufferViews,
    buffers: [{ byteLength: taille }],
  };
  let texte = Buffer.from(JSON.stringify(json), 'utf8');
  const margeJson = (4 - (texte.length % 4)) % 4;
  if (margeJson) texte = Buffer.concat([texte, Buffer.alloc(margeJson, 0x20)]);

  const total = 12 + 8 + texte.length + 8 + taille;
  const entete = Buffer.alloc(12);
  entete.writeUInt32LE(0x46546c67, 0);
  entete.writeUInt32LE(2, 4);
  entete.writeUInt32LE(total, 8);
  const eJson = Buffer.alloc(8);
  eJson.writeUInt32LE(texte.length, 0);
  eJson.writeUInt32LE(0x4e4f534a, 4);
  const eBin = Buffer.alloc(8);
  eBin.writeUInt32LE(taille, 0);
  eBin.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([entete, eJson, texte, eBin, ...morceaux.map((m) => Buffer.from(m.buffer, m.byteOffset, m.byteLength))]);
}
