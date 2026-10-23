/* Logique de l'enquête, sans affichage : tables, filtres, entonnoir, missions et vérification de la réponse.
 * Partagée entre le jeu (js/jeu.js) et les tests (tests/tests.html). */
(function (global) {
  'use strict';
  const R = global.Recherche;

  function enObjets(table) {
    return table.lignes.map(l => Object.fromEntries(table.colonnes.map((c, i) => [c, l[i]])));
  }

  function charger(donnees) {
    const patients = enObjets(donnees.patients);
    const visites = enObjets(donnees.visites);
    const cr = enObjets(donnees.cr);
    const patientParId = new Map(patients.map(p => [p.id_patient, p]));
    const crParVisite = new Map(cr.map(c => [c.id_visite, c]));
    for (const v of visites) {
      v.patient = patientParId.get(v.id_patient);
      v.cr = crParVisite.get(v.id_visite);
      v.texte = R.preparer(v.cr.anamnese);
    }
    return { meta: donnees.meta, verification: donnees.verification, patients, visites, cr, patientParId };
  }

  function dateFr(iso) {
    const [a, m, j] = iso.split('-');
    return `${j}/${m}/${a}`;
  }

  function nombreFr(x) {
    return String(x).replace('.', ',');
  }

  function lireNombre(saisie) {
    const n = parseFloat(String(saisie).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function etatVide() {
    return { du: '', au: '', hopital: '', temperatureMin: '', test: '', diagnostic: '', issue: '', criteres: [] };
  }

  // Filtres sur la table Visites, dans l'ordre où ils s'appliquent.
  const FILTRES = [
    { cle: 'du', libelle: v => `Date à partir du ${dateFr(v)}`, garde: v => x => x.date >= v },
    { cle: 'au', libelle: v => `Date jusqu'au ${dateFr(v)}`, garde: v => x => x.date <= v },
    { cle: 'hopital', libelle: v => `Hôpital : ${v}`, garde: v => x => x.hopital === v },
    {
      cle: 'temperatureMin',
      libelle: v => `Température ≥ ${nombreFr(lireNombre(v))} °C`,
      garde: v => x => x.temperature >= lireNombre(v),
      actif: v => lireNombre(v) !== null,
    },
    { cle: 'test', libelle: v => `Test Nova : ${v}`, garde: v => x => x.test_nova === v },
    { cle: 'diagnostic', libelle: v => `Diagnostic : ${v === '(vide)' ? 'vide' : v}`, garde: v => x => x.diagnostic === (v === '(vide)' ? '' : v) },
    { cle: 'issue', libelle: v => `Issue : ${v}`, garde: v => x => x.issue === v },
  ];

  function guillemets(termes) {
    return termes.map(t => `« ${t.texte} »`).join(' ou ');
  }

  function libelleEtapeTexte(etape) {
    const partie = c => (c.exclure ? 'sans ' : '') + guillemets(c.termes);
    if (!etape.lien) {
      const c = etape.criteres[0];
      return `Texte ${c.exclure ? 'sans' : 'avec'} ${guillemets(c.termes)}`;
    }
    return `Même phrase (lien ${etape.lien}) : ${etape.criteres.map(partie).join(', ')}`;
  }

  // Les étapes de l'entonnoir : d'abord les filtres sur la table Visites, puis les recherches dans les comptes rendus.
  function etapes(etat) {
    const resultat = [];
    for (const f of FILTRES) {
      const v = etat[f.cle];
      if (v === '' || v === null || v === undefined || (f.actif && !f.actif(v))) continue;
      resultat.push({ table: 'Visites', libelle: f.libelle(v), garde: f.garde(v) });
    }
    const criteres = (etat.criteres || []).map(R.compilerCritere);
    for (const e of R.etapes(criteres)) {
      resultat.push({ table: 'Comptes rendus', libelle: libelleEtapeTexte(e), garde: x => R.satisfaitEtape(x.texte, e) });
    }
    return resultat;
  }

  function nombrePatients(visites) {
    return new Set(visites.map(v => v.id_patient)).size;
  }

  // Applique les étapes une à une ; chaque ligne de l'entonnoir donne le nombre de lignes restantes par table.
  function entonnoir(base, etat) {
    let lignes = base.visites;
    const marches = [{ table: '', libelle: 'Toutes les données', visites: lignes.length, patients: base.patients.length }];
    for (const e of etapes(etat)) {
      lignes = lignes.filter(e.garde);
      marches.push({ table: e.table, libelle: e.libelle, visites: lignes.length, patients: nombrePatients(lignes) });
    }
    return { lignes, marches };
  }

  function valeursDistinctes(base, colonne) {
    return [...new Set(base.visites.map(v => v[colonne]))].sort((a, b) => a.localeCompare(b, 'fr'));
  }

  // Nouveaux cas détectés par semaine : première visite avec un test positif de chaque patient.
  function courbe(base) {
    const lundi = iso => {
      const d = new Date(iso + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    };
    const vus = new Set();
    const compte = new Map();
    for (const v of base.visites) {
      if (v.test_nova !== 'positif' || vus.has(v.id_patient)) continue;
      vus.add(v.id_patient);
      const l = lundi(v.date);
      compte.set(l, (compte.get(l) || 0) + 1);
    }
    const semaines = [];
    const d = new Date(lundi(base.meta.debut) + 'T12:00:00Z');
    const fin = new Date(base.meta.fin + 'T12:00:00Z');
    while (d <= fin) {
      const iso = d.toISOString().slice(0, 10);
      semaines.push({ lundi: iso, cas: compte.get(iso) || 0 });
      d.setUTCDate(d.getUTCDate() + 7);
    }
    return semaines;
  }

  const SIGNES_PLAQUES = ['plaques rouges douloureuses', 'PRD', 'plaques rouges dlr'];
  const NEGATIONS = ['pas de', 'absence de'];

  // Missions d'entraînement : la réponse attendue est calculée sur les données avec « etat ».
  const MISSIONS = [
    {
      titre: 'Filtrer une table',
      consigne: 'Dans les filtres de la table Visites, réglez <strong>Température min</strong> sur <strong>40</strong>. Combien de visites reste-t-il ?',
      indice: "Le dernier chiffre de l'entonnoir donne le nombre de visites qui passent tous les filtres.",
      bravo: "Chaque filtre retire des lignes : l'entonnoir montre combien il en reste à chaque étape, pour la table Visites et pour la table Patients.",
      etat: { temperatureMin: '40' },
    },
    {
      titre: 'Chercher dans le texte',
      consigne: 'Cliquez sur <strong>Tout effacer</strong>, puis ajoutez une recherche qui <strong>doit contenir</strong> le terme <strong>plaques rouges douloureuses</strong>. Combien de visites ?',
      indice: 'Bouton « Ajouter une recherche », dans la partie Recherche dans les comptes rendus. Vérifiez que la température est bien effacée.',
      bravo: 'La recherche lit le texte libre des comptes rendus. Les termes trouvés sont surlignés.',
      etat: { criteres: [{ termes: ['plaques rouges douloureuses'] }] },
    },
    {
      titre: 'Les synonymes',
      consigne: 'Les médecins abrègent : ils écrivent aussi <strong>PRD</strong> ou <strong>plaques rouges dlr</strong>. Ajoutez ces deux termes à la même recherche avec <strong>+ synonyme</strong>. Combien de visites ?',
      indice: 'Les trois termes doivent être dans la même recherche : il suffit que l\'un d\'eux soit présent.',
      bravo: 'Un même signe s\'écrit de plusieurs façons. Oublier un synonyme, c\'est rater des malades.',
      etat: { criteres: [{ termes: SIGNES_PLAQUES }] },
    },
    {
      titre: 'Le piège de la négation',
      consigne: 'Ouvrez quelques comptes rendus : certains disent « Pas de PRD ». Ajoutez une recherche qui <strong>ne doit pas contenir</strong> <strong>pas de</strong> ou <strong>absence de</strong>. Pour les deux recherches, choisissez <strong>Dans la même phrase (lien A)</strong>. Combien de visites ?',
      indice: 'Sans le lien A, la négation s\'applique à tout le texte : « Pas de voyage récent » ferait disparaître un vrai malade. Liez les deux recherches à la même phrase.',
      bravo: '« Pas de PRD » contient « PRD ». Chercher dans la même phrase permet d\'écarter les signes niés sans perdre les autres.',
      etat: { criteres: [{ termes: SIGNES_PLAQUES, phrase: 'A' }, { termes: NEGATIONS, exclure: true, phrase: 'A' }] },
    },
  ];

  function reponseMission(base, mission) {
    return entonnoir(base, Object.assign(etatVide(), mission.etat)).lignes.length;
  }

  // --- Vérification de la réponse ------------------------------------------------------------------------

  async function sha256(texte) {
    const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
    return [...new Uint8Array(octets)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function normaliserId(saisie) {
    const m = String(saisie || '').trim().toUpperCase().match(/^P?\s*0*(\d{1,4})$/);
    return m ? 'P' + m[1].padStart(4, '0') : null;
  }

  // Statut : format, inconnu, sain, malade (contaminé en France) ou zero.
  async function verifierProposition(base, saisie) {
    const id = normaliserId(saisie);
    if (!id) return { statut: 'format' };
    if (!base.patientParId.has(id)) return { statut: 'inconnu', id };
    const sel = base.verification.sel;
    if (await sha256(`zero:${sel}:${id}`) === base.verification.zero) return { statut: 'zero', id };
    const malade = base.verification.malades.includes(await sha256(`malade:${sel}:${id}`));
    return { statut: malade ? 'malade' : 'sain', id };
  }

  async function dechiffrerBilan(base, id) {
    const sel = base.verification.sel;
    const code = Uint8Array.from(atob(base.verification.bilan), c => c.charCodeAt(0));
    const sortie = new Uint8Array(code.length);
    for (let bloc = 0; bloc * 32 < code.length; bloc++) {
      const flux = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`bilan:${sel}:${id}:${bloc}`)));
      for (let i = 0; i < 32 && bloc * 32 + i < code.length; i++) sortie[bloc * 32 + i] = code[bloc * 32 + i] ^ flux[i];
    }
    return new TextDecoder().decode(sortie);
  }

  global.Enquete = {
    charger, etatVide, etapes, entonnoir, valeursDistinctes, courbe, MISSIONS, reponseMission,
    verifierProposition, dechiffrerBilan, normaliserId, dateFr, nombreFr, lireNombre, SIGNES_PLAQUES, NEGATIONS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
