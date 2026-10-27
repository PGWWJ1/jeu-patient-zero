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

  /* Sensibilité et spécificité d'une sélection de visites, par rapport aux visites des malades du Nova-virus :
   * sensibilité = part des visites de malades que la sélection garde ;
   * spécificité = part des visites de non-malades que la sélection écarte.
   * Nulles tant que preparerVerite n'a pas tourné. */
  function indicateurs(base, lignes) {
    if (!base.verite) return { sensibilite: null, specificite: null };
    const { malades, sains } = base.verite;
    const vraisPositifs = lignes.filter(v => v.malade).length;
    return {
      sensibilite: vraisPositifs / malades,
      specificite: (sains - (lignes.length - vraisPositifs)) / sains,
    };
  }

  // Applique les étapes une à une ; chaque ligne de l'entonnoir donne le nombre de lignes restantes par table,
  // avec la sensibilité et la spécificité de la sélection à ce stade.
  function entonnoir(base, etat) {
    let lignes = base.visites;
    const marche = (table, libelle) => Object.assign(
      { table, libelle, visites: lignes.length, patients: nombrePatients(lignes) }, indicateurs(base, lignes));
    const marches = [marche('', 'Toutes les données')];
    for (const e of etapes(etat)) {
      lignes = lignes.filter(e.garde);
      marches.push(marche(e.table, e.libelle));
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

  // Missions d'entraînement. Elles apprennent les outils sur des sujets sans rapport avec le virus, pour ne
  // donner aucune piste sur l'enquête. La réponse attendue est calculée sur les données avec « etat » ;
  // « compte » dit si l'on compte des visites ou des patients.
  const LILLE_AVRIL = { hopital: 'CHU Lille', du: '1975-04-01', au: '1975-04-30' };
  const MISSIONS = [
    {
      titre: 'Filtrer la table Visites',
      consigne: 'Réglez le filtre <strong>Hôpital</strong> sur <strong>CHU Lille</strong> et la période <strong>du 01/04/1975 au 30/04/1975</strong>. Combien de visites reste-t-il ?',
      indice: "Les filtres sont dans « Filtres sur la table Visites ». Le dernier chiffre de l'entonnoir donne le nombre de visites qui passent tous les filtres.",
      bravo: "Chaque filtre retire des lignes de la table Visites : l'entonnoir montre combien il en reste à chaque étape.",
      etat: LILLE_AVRIL,
      compte: 'visites',
    },
    {
      titre: 'Visites et patients',
      consigne: 'Gardez les mêmes filtres. Un patient peut venir plusieurs fois aux urgences : à combien de <strong>patients différents</strong> correspondent ces visites ?',
      indice: "L'entonnoir donne aussi le nombre de patients, et l'onglet Patients les liste.",
      bravo: 'La table Patients a une ligne par personne, la table Visites une ligne par passage aux urgences. On compte les patients à partir des visites retenues.',
      etat: LILLE_AVRIL,
      compte: 'patients',
    },
    {
      titre: 'Chercher dans le texte',
      consigne: 'Cliquez sur <strong>Tout effacer</strong>, puis ajoutez une recherche qui <strong>doit contenir</strong> le mot <strong>chute</strong>. Combien de visites ?',
      indice: 'Bouton « Ajouter une recherche », dans la partie Recherche dans les comptes rendus. Vérifiez que les filtres de la table Visites sont bien effacés.',
      bravo: 'La recherche lit le texte libre des comptes rendus. Les mots trouvés sont surlignés : ouvrez quelques comptes rendus pour le voir.',
      etat: { criteres: [{ termes: ['chute'] }] },
      compte: 'visites',
    },
    {
      titre: 'Les synonymes',
      consigne: 'Tout effacer. « Courbatures » et « myalgies » veulent dire la même chose. Cherchez les deux dans <strong>une seule recherche</strong>, avec le bouton <strong>+ synonyme</strong>. Combien de visites ?',
      indice: "Les deux mots doivent être dans la même recherche : il suffit alors que l'un d'eux soit présent. Deux recherches séparées exigeraient les deux à la fois.",
      bravo: "Une même idée s'écrit de plusieurs façons. Oublier un synonyme, c'est rater des comptes rendus.",
      etat: { criteres: [{ termes: ['courbatures', 'myalgies'] }] },
      compte: 'visites',
    },
    {
      titre: 'Le piège de la négation',
      consigne: 'Tout effacer. Cherchez <strong>douleur thoracique</strong> et lisez quelques comptes rendus : certains disent « Pas de douleur thoracique ». Ajoutez une deuxième recherche réglée sur <strong>ne doit pas contenir</strong>, avec les termes « pas de » et « absence de ». Puis, pour les deux recherches, choisissez <strong>dans la même phrase (lien A)</strong>. Combien de visites ?',
      indice: "Sans le lien A, la négation s'applique à tout le texte : un compte rendu qui dit « Douleur thoracique apparue au repos. Pas de dyspnée. » disparaîtrait. Liez les deux recherches à la même phrase.",
      bravo: "« Pas de douleur thoracique » contient « douleur thoracique ». Chercher dans la même phrase écarte ce qui est nié sans perdre le reste.",
      etat: { criteres: [{ termes: ['douleur thoracique'], phrase: 'A' }, { termes: ['pas de', 'absence de'], exclure: true, phrase: 'A' }] },
      compte: 'visites',
    },
  ];

  function reponseMission(base, mission) {
    const { lignes } = entonnoir(base, Object.assign(etatVide(), mission.etat));
    return mission.compte === 'patients' ? nombrePatients(lignes) : lignes.length;
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

  // Les malades ne sont livrés que sous forme d'empreintes : on les retrouve en calculant celle de chaque patient.
  // Sert à la sensibilité et à la spécificité de l'entonnoir.
  async function preparerVerite(base) {
    const sel = base.verification.sel;
    const malades = new Set(base.verification.malades);
    const empreintes = await Promise.all(base.patients.map(p => sha256(`malade:${sel}:${p.id_patient}`)));
    base.patients.forEach((p, i) => { p.malade = malades.has(empreintes[i]); });
    for (const v of base.visites) v.malade = v.patient.malade;
    const nbMalades = base.visites.filter(v => v.malade).length;
    base.verite = { malades: nbMalades, sains: base.visites.length - nbMalades };
  }

  /* Question bonus : combien de patients ont le Nova-virus ? Statut : format, juste, visites (le joueur a donné le
   * nombre de visites des malades), lire (sa sélection garde exactement les malades, mais il n'a pas tapé son
   * nombre de patients) ou selection (sa sélection n'est pas encore parfaite). « lignes » : la sélection affichée. */
  async function verifierNombreMalades(base, saisie, lignes) {
    const texte = String(saisie || '').trim();
    if (!/^\d+$/.test(texte)) return { statut: 'format' };
    if (!base.verite) await preparerVerite(base);
    const n = Number(texte);
    if (n === base.patients.filter(p => p.malade).length) return { statut: 'juste', n };
    if (n === base.verite.malades) return { statut: 'visites', n };
    const { sensibilite, specificite } = indicateurs(base, lignes);
    return { statut: sensibilite === 1 && specificite === 1 ? 'lire' : 'selection', n };
  }

  // Inverse de chiffrer() dans generateur/generer.py : flux SHA-256 dérivé de la clé, combiné par OU exclusif.
  async function dechiffrer(code64, cle) {
    const code = Uint8Array.from(atob(code64), c => c.charCodeAt(0));
    const sortie = new Uint8Array(code.length);
    for (let bloc = 0; bloc * 32 < code.length; bloc++) {
      const flux = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${cle}:${bloc}`)));
      for (let i = 0; i < 32 && bloc * 32 + i < code.length; i++) sortie[bloc * 32 + i] = code[bloc * 32 + i] ^ flux[i];
    }
    return new TextDecoder().decode(sortie);
  }

  function dechiffrerBilan(base, id) {
    return dechiffrer(base.verification.bilan, `bilan:${base.verification.sel}:${id}`);
  }

  const DEBUT_BILAN = '## Le patient zéro est ';

  // Ouvre le bilan avec le mot de passe animateur ; renvoie null si le mot de passe est faux.
  async function ouvrirBilanAnimateur(base, motDePasse, code = base.verification.bilan_animateur) {
    const v = base.verification;
    const cleBrute = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(`animateur:${v.sel}`), iterations: v.iterations_animateur },
      cleBrute, 256);
    const hex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
    const texte = await dechiffrer(code, 'animateur:' + hex);
    return texte.startsWith(DEBUT_BILAN) ? texte : null;
  }

  global.Enquete = {
    charger, etatVide, etapes, entonnoir, valeursDistinctes, courbe, MISSIONS, reponseMission,
    verifierProposition, verifierNombreMalades, preparerVerite, dechiffrerBilan, ouvrirBilanAnimateur, normaliserId,
    dateFr, nombreFr, lireNombre, nombrePatients,
  };
})(typeof window !== 'undefined' ? window : globalThis);
