/* Moteur de recherche dans le texte des comptes rendus.
 *
 * Le texte et les termes sont normalisés de la même façon (minuscules, sans accents, apostrophes et tirets
 * remplacés par des espaces), puis découpés en mots. Un terme est trouvé quand tous ses mots se suivent, dans la
 * même phrase. Chaque mot du terme trouve les mots qui commencent par lui : « ROT » trouve « rotulien », mais
 * « otulien » ne trouve pas « rotulien ». Un terme au pluriel en -s ou -x trouve aussi le singulier : « abolis »
 * trouve « aboli ». La ponctuation des termes est ignorée : « rouge* » cherche « rouge ».
 * Les phrases sont découpées sur . ! ? ; et les retours à la ligne.
 * Le surlignage réutilise exactement les correspondances du filtrage : les deux ne peuvent pas diverger.
 */
(function (global) {
  'use strict';

  const FIN_DE_PHRASE = /[.!?;\n]/;
  const ALPHANUMERIQUE = /^[a-z0-9]+$/;

  function normaliserCaractere(c) {
    if (c === 'œ' || c === 'Œ') return 'oe';
    if (c === 'æ' || c === 'Æ') return 'ae';
    return c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // Découpe un texte en mots, en gardant pour chacun sa phrase et sa position dans le texte d'origine.
  function preparer(texte) {
    texte = String(texte || '');
    const mots = [];
    let phrase = 0;
    let mot = null;
    for (let i = 0; i < texte.length; i++) {
      const norme = normaliserCaractere(texte[i]);
      if (norme === '') continue;
      if (ALPHANUMERIQUE.test(norme)) {
        if (!mot) mot = { forme: '', debut: i, fin: i, phrase };
        mot.forme += norme;
        mot.fin = i + 1;
        continue;
      }
      if (mot) { mots.push(mot); mot = null; }
      if (FIN_DE_PHRASE.test(texte[i])) phrase++;
    }
    if (mot) mots.push(mot);
    return { texte, mots };
  }

  function compilerTerme(terme) {
    const mots = preparer(terme).mots.map(m => m.forme);
    return mots.length ? { texte: String(terme).trim(), mots } : null;
  }

  // Le début du mot du texte, ou son singulier quand le terme est au pluriel.
  function memeMot(motTexte, motTerme) {
    return motTexte.startsWith(motTerme) || motTerme === motTexte + 's' || motTerme === motTexte + 'x';
  }

  // Toutes les occurrences d'un terme compilé : [{ phrase, debut, fin }], positions dans le texte d'origine.
  function occurrences(prep, terme) {
    const resultat = [];
    const n = terme.mots.length;
    for (let i = 0; i + n <= prep.mots.length; i++) {
      let trouve = true;
      for (let k = 0; k < n && trouve; k++) {
        const mot = prep.mots[i + k];
        trouve = mot.phrase === prep.mots[i].phrase && memeMot(mot.forme, terme.mots[k]);
      }
      if (trouve) resultat.push({ phrase: prep.mots[i].phrase, debut: prep.mots[i].debut, fin: prep.mots[i + n - 1].fin });
    }
    return resultat;
  }

  // Un critère : { termes: [chaînes], exclure: booléen, phrase: '' | 'A' | 'B' }.
  // Les termes d'un critère sont des synonymes : un seul suffit.
  function compilerCritere(critere) {
    return {
      termes: (critere.termes || []).map(compilerTerme).filter(Boolean),
      exclure: Boolean(critere.exclure),
      phrase: critere.phrase || '',
    };
  }

  function trouver(prep, critere) {
    return critere.termes.flatMap(t => occurrences(prep, t));
  }

  /* Regroupe les critères en étapes indépendantes.
   * - Un critère sans lien s'applique à tout le texte.
   * - Les critères qui partagent un lien (A ou B) forment une seule étape : il faut une phrase qui contient un
   *   terme de chaque critère « contient » et aucun terme des critères « ne contient pas ».
   * - Un lien qui ne contient que des exclusions n'a pas de phrase de référence : ses exclusions s'appliquent
   *   à tout le texte. */
  function etapes(criteres) {
    const actifs = criteres.filter(c => c.termes.length);
    const liens = new Map();
    for (const c of actifs) {
      if (c.phrase) liens.set(c.phrase, [...(liens.get(c.phrase) || []), c]);
    }
    const resultat = [];
    const groupesFaits = new Set();
    for (const c of actifs) {
      const groupe = c.phrase ? liens.get(c.phrase) : null;
      if (groupe && groupe.some(x => !x.exclure)) {
        if (!groupesFaits.has(c.phrase)) {
          groupesFaits.add(c.phrase);
          resultat.push({ lien: c.phrase, criteres: groupe });
        }
      } else {
        resultat.push({ lien: '', criteres: [c] });
      }
    }
    return resultat;
  }

  function satisfaitEtape(prep, etape) {
    if (!etape.lien) {
      const c = etape.criteres[0];
      const present = trouver(prep, c).length > 0;
      return c.exclure ? !present : present;
    }
    const phrasesDe = c => new Set(trouver(prep, c).map(o => o.phrase));
    const inclus = etape.criteres.filter(c => !c.exclure).map(phrasesDe);
    const exclus = etape.criteres.filter(c => c.exclure).map(phrasesDe);
    for (const p of inclus[0]) {
      if (inclus.every(s => s.has(p)) && exclus.every(s => !s.has(p))) return true;
    }
    return false;
  }

  function evaluer(prep, criteres) {
    return etapes(criteres).every(e => satisfaitEtape(prep, e));
  }

  function echapper(texte) {
    return String(texte).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Texte en HTML, chaque occurrence entourée d'un <mark>. couleurs[i] colore le critère i ; les exclusions
  // prennent la classe « exclu » et l'emportent sur un autre surlignage au même endroit.
  function surligner(prep, criteres, couleurs) {
    const texte = prep.texte;
    const marque = new Array(texte.length).fill(-1);
    criteres.forEach((c, i) => {
      for (const o of trouver(prep, c)) {
        for (let k = o.debut; k < o.fin; k++) {
          if (marque[k] === -1 || (c.exclure && !criteres[marque[k]].exclure)) marque[k] = i;
        }
      }
    });
    let html = '';
    let k = 0;
    while (k < texte.length) {
      const i = marque[k];
      let fin = k;
      while (fin < texte.length && marque[fin] === i) fin++;
      const morceau = echapper(texte.slice(k, fin));
      if (i === -1) html += morceau;
      else if (criteres[i].exclure) html += `<mark class="exclu">${morceau}</mark>`;
      else html += `<mark style="background:${couleurs[i % couleurs.length]}">${morceau}</mark>`;
      k = fin;
    }
    return html;
  }

  global.Recherche = { preparer, compilerTerme, compilerCritere, occurrences, trouver, etapes, satisfaitEtape, evaluer, surligner, echapper };
})(typeof window !== 'undefined' ? window : globalThis);
