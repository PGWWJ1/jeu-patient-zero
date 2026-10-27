/* Affichage du jeu : pages, filtres, entonnoir, tables, missions et proposition. La logique est dans enquete.js. */
(function () {
  'use strict';
  const R = window.Recherche;
  const E = window.Enquete;
  const COULEURS = ['#fde68a', '#bfdbfe', '#bbf7d0', '#fbcfe8', '#ddd6fe', '#fed7aa'];
  // Couleurs des étapes de l'entonnoir, [foncée, claire] : la foncée pour le numéro et la barre, la claire pour le
  // fond de l'onglet des comptes rendus que l'étape n'a pas sélectionnés.
  const COULEURS_ETAPES = [
    ['#6d28d9', '#ede9fe'], ['#0f766e', '#ccfbf1'], ['#c2410c', '#ffedd5'],
    ['#be185d', '#fce7f3'], ['#1d4ed8', '#dbeafe'], ['#4d7c0f', '#ecfccb'],
  ];
  const PAR_PAGE = 50;
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  // Mémoire du navigateur : progression des missions et réponse trouvée. Facultative (navigation privée).
  const memoire = {
    lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } },
    ecrire(cle, valeur) {
      try { valeur === null ? localStorage.removeItem(cle) : localStorage.setItem(cle, String(valeur)); } catch (e) { /* sans mémoire */ }
    },
  };

  const $ = id => document.getElementById(id);
  const esc = R.echapper;
  const base = E.charger(window.DONNEES);

  let etat = E.etatVide();      // les filtres tels que le joueur les saisit
  let applique = E.etatVide();  // les filtres appliqués : ceux de l'entonnoir et des résultats
  let resultat = E.entonnoir(base, applique);
  let vue = 'cr';               // onglet affiché : cr, ecartes-<numéro de l'étape>, visites ou patients
  let ordre = 'asc';
  let positions = {};           // rang du compte rendu affiché, par onglet
  let limiteVisites = PAR_PAGE;
  let limitePatients = PAR_PAGE;
  let mission = Math.min(Number(memoire.lire('pz-mission-v2')) || 0, E.MISSIONS.length);
  let trouve = memoire.lire('pz-trouve');

  // --- Pages -----------------------------------------------------------------------------------------------

  function allerA(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    document.querySelectorAll('.onglets-pages button').forEach(b => {
      if (b.dataset.page === page) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (page === 'bilan') rendreBilan();
    history.replaceState(null, '', '#' + page);
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', e => {
    const cible = e.target.closest('[data-page], [data-aller]');
    if (cible) allerA(cible.dataset.page || cible.dataset.aller);
  });

  // --- Page 1 : courbe et schéma ---------------------------------------------------------------------------

  function rendreCourbe() {
    const semaines = E.courbe(base);
    const L = 660, H = 250, gauche = 34, droite = 8, haut = 22, bas = 30;
    const max = Math.max(5, ...semaines.map(s => s.cas));
    const pas = max > 20 ? 10 : 5;
    const sommet = Math.ceil(max / pas) * pas;
    const largeur = (L - gauche - droite) / semaines.length;
    const y = n => haut + (H - haut - bas) * (1 - n / sommet);
    let svg = '';
    for (let n = 0; n <= sommet; n += pas) {
      svg += `<line class="grille" x1="${gauche}" x2="${L - droite}" y1="${y(n)}" y2="${y(n)}"/>`;
      svg += `<text x="${gauche - 6}" y="${y(n) + 4}" text-anchor="end">${n}</text>`;
    }
    let moisPrecedent = null;
    semaines.forEach((s, i) => {
      const x = gauche + i * largeur;
      if (s.cas) {
        svg += `<rect class="barre" x="${x + 2}" y="${y(s.cas)}" width="${largeur - 4}" height="${y(0) - y(s.cas)}" rx="2">`
          + `<title>Semaine du ${E.dateFr(s.lundi)} : ${s.cas} cas</title></rect>`;
      }
      const mois = Number(s.lundi.slice(5, 7)) - 1;
      const jour = Number(s.lundi.slice(8, 10));
      if (mois !== moisPrecedent && jour <= 7) {
        svg += `<text x="${x + 2}" y="${H - 10}">${MOIS[mois]}</text>`;
        moisPrecedent = mois;
      }
      if (s.lundi === base.meta.t0) {
        svg += `<line class="t0" x1="${x}" x2="${x}" y1="${haut - 8}" y2="${y(0)}"/>`;
        svg += `<text class="t0-texte" x="${x - 6}" y="${haut - 10}" text-anchor="end">T0 : 5 mai, test validé</text>`;
      }
    });
    svg += `<line class="axe" x1="${gauche}" x2="${L - droite}" y1="${y(0)}" y2="${y(0)}"/>`;
    const pic = semaines.reduce((a, b) => (b.cas > a.cas ? b : a));
    $('courbe').innerHTML = `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Nouveaux cas détectés par semaine : aucun avant le 5 mai, puis jusqu'à ${pic.cas} la semaine du ${E.dateFr(pic.lundi)}.">${svg}</svg>`;
  }

  function rendreSchema() {
    $('schema-patients').textContent = `${base.patients.length} lignes`;
    $('schema-visites').textContent = `${base.visites.length} lignes`;
    $('schema-cr').textContent = `${base.cr.length} lignes`;
  }

  // --- Filtres sur la table Visites ------------------------------------------------------------------------

  const CHAMPS = { 'f-du': 'du', 'f-au': 'au', 'f-hopital': 'hopital', 'f-temperature': 'temperatureMin', 'f-test': 'test', 'f-diagnostic': 'diagnostic', 'f-issue': 'issue' };

  function remplirSelect(id, valeurs) {
    $(id).innerHTML = '<option value="">Tous</option>' + valeurs.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }

  function preparerFiltres() {
    remplirSelect('f-hopital', E.valeursDistinctes(base, 'hopital'));
    remplirSelect('f-test', E.valeursDistinctes(base, 'test_nova'));
    remplirSelect('f-diagnostic', E.valeursDistinctes(base, 'diagnostic').map(v => v || '(vide)'));
    remplirSelect('f-issue', E.valeursDistinctes(base, 'issue'));
    for (const id of ['f-du', 'f-au']) {
      $(id).min = base.meta.debut;
      $(id).max = base.meta.fin;
    }
    for (const [id, cle] of Object.entries(CHAMPS)) {
      for (const evenement of ['input', 'change']) {
        $(id).addEventListener(evenement, () => { etat[cle] = $(id).value; signalerModifications(); });
      }
    }
  }

  // --- Recherches dans les comptes rendus ------------------------------------------------------------------

  function couleur(i) {
    return etat.criteres[i].exclure ? 'var(--rouge)' : COULEURS[i % COULEURS.length];
  }

  function rendreCriteres() {
    $('criteres').innerHTML = etat.criteres.map((c, i) => `
      <div class="critere${c.exclure ? ' exclusion' : ''}" data-i="${i}" style="--couleur:${couleur(i)}">
        <div class="critere-tete">
          <select data-champ="exclure" aria-label="Type de recherche">
            <option value="">doit contenir</option>
            <option value="1"${c.exclure ? ' selected' : ''}>ne doit pas contenir</option>
          </select>
          <button type="button" class="icone" data-action="retirer-critere" title="Retirer cette recherche" aria-label="Retirer cette recherche"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="termes">
          ${c.termes.map((t, k) => `${k ? '<span class="ou">ou</span>' : ''}
            <div class="terme">
              <input type="text" value="${esc(t)}" data-k="${k}" placeholder="${k ? 'synonyme' : 'terme, par exemple toux'}" aria-label="Terme ${k + 1}" autocomplete="off">
              ${c.termes.length > 1 ? `<button type="button" class="icone" data-action="retirer-terme" data-k="${k}" title="Retirer ce terme" aria-label="Retirer ce terme"><i class="fa-solid fa-minus"></i></button>` : ''}
            </div>`).join('')}
        </div>
        <div class="critere-pied">
          <button type="button" class="bouton petit" data-action="ajouter-terme"><i class="fa-solid fa-plus"></i> synonyme</button>
          <label class="lien-phrase">Où chercher ?
            <select data-champ="phrase">
              <option value="">n'importe où dans le texte</option>
              <option value="A"${c.phrase === 'A' ? ' selected' : ''}>dans la même phrase (lien A)</option>
              <option value="B"${c.phrase === 'B' ? ' selected' : ''}>dans la même phrase (lien B)</option>
            </select>
          </label>
        </div>
      </div>`).join('');
  }

  function focaliser(i, k) {
    const champ = document.querySelector(`.critere[data-i="${i}"] input[data-k="${k}"]`);
    if (champ) champ.focus();
  }

  function ajouterCritere() {
    etat.criteres.push({ termes: [''], exclure: false, phrase: '' });
    rendreCriteres();
    focaliser(etat.criteres.length - 1, 0);
  }

  $('ajouter-critere').addEventListener('click', ajouterCritere);

  $('criteres').addEventListener('input', e => {
    const bloc = e.target.closest('.critere');
    if (!bloc || e.target.dataset.k === undefined) return;
    etat.criteres[bloc.dataset.i].termes[e.target.dataset.k] = e.target.value;
    signalerModifications();
  });

  $('criteres').addEventListener('change', e => {
    const bloc = e.target.closest('.critere');
    if (!bloc || !e.target.dataset.champ) return;
    const c = etat.criteres[bloc.dataset.i];
    if (e.target.dataset.champ === 'exclure') c.exclure = e.target.value === '1';
    else c.phrase = e.target.value;
    rendreCriteres();
    signalerModifications();
  });

  $('criteres').addEventListener('click', e => {
    const bouton = e.target.closest('[data-action]');
    if (!bouton) return;
    const i = Number(bouton.closest('.critere').dataset.i);
    const c = etat.criteres[i];
    if (bouton.dataset.action === 'retirer-critere') etat.criteres.splice(i, 1);
    if (bouton.dataset.action === 'retirer-terme') c.termes.splice(Number(bouton.dataset.k), 1);
    if (bouton.dataset.action === 'ajouter-terme') c.termes.push('');
    rendreCriteres();
    if (bouton.dataset.action === 'ajouter-terme') focaliser(i, c.termes.length - 1);
    signalerModifications();
  });

  // Effacer est une remise à zéro : elle s'applique tout de suite.
  function toutEffacer() {
    etat = E.etatVide();
    for (const id of Object.keys(CHAMPS)) $(id).value = '';
    rendreCriteres();
    appliquer();
  }

  document.querySelectorAll('.tout-effacer').forEach(b => b.addEventListener('click', toutEffacer));

  // --- Calcul et résultats ---------------------------------------------------------------------------------

  // Les filtres ne s'appliquent qu'avec le bouton « Appliquer les filtres », ou la touche Entrée dans un champ.
  $('form-filtres').addEventListener('submit', e => { e.preventDefault(); appliquer(); });

  function appliquer() {
    applique = JSON.parse(JSON.stringify(etat));
    positions = {};
    calculer();
  }

  function calculer() {
    resultat = E.entonnoir(base, applique);
    limiteVisites = limitePatients = PAR_PAGE;
    rendreEntonnoir();
    rendreResultats();
    signalerModifications();
  }

  // Deux saisies qui donnent les mêmes étapes donnent le même entonnoir : seules les étapes comptent.
  const signature = e => JSON.stringify(E.etapes(e).map(x => x.libelle));

  function modifie() {
    return signature(etat) !== signature(applique);
  }

  function signalerModifications() {
    const attente = modifie();
    $('etat-filtres').textContent = attente ? 'Filtres modifiés : appliquez-les pour mettre à jour les résultats.' : '';
    $('appliquer').classList.toggle('attente', attente);
    $('attente-filtres').hidden = !attente;
    $('entonnoir').classList.toggle('perime', attente);
    rendreBarre(attente);
  }

  function ordonner(lignes) {
    return ordre === 'asc' ? lignes : [...lignes].reverse();
  }

  // 100 % seulement si la valeur est exacte : 99,6 % ne doit pas passer pour une sélection parfaite.
  function pourcentage(x) {
    if (x === 1) return '<strong class="parfait">100 %</strong>';
    const p = Math.floor(x * 1000) / 10;
    return `<strong>${String(Number.isInteger(p) ? p : p.toFixed(1)).replace('.', ',')} %</strong>`;
  }

  function indicateurs(m) {
    if (m.rappel === null) return '';
    const precision = m.precision === null ? '<strong title="Aucune visite sélectionnée">—</strong>' : pourcentage(m.precision);
    return `<span class="indicateurs">rappel ${pourcentage(m.rappel)} · précision ${precision}</span>`;
  }

  // Variables CSS de l'étape k de l'entonnoir (k ≥ 1) : sa couleur foncée et sa couleur claire.
  function styleEtape(k) {
    const [foncee, claire] = COULEURS_ETAPES[(k - 1) % COULEURS_ETAPES.length];
    return `--etape:${foncee};--etape-claire:${claire}`;
  }

  function rendreEntonnoir() {
    const total = base.visites.length;
    const n = resultat.marches.length;
    let html = resultat.marches.map((m, k) => `
      <li class="${k === n - 1 && n > 1 ? 'dernier' : ''}"${k ? ` style="${styleEtape(k)}"` : ''}>
        <div>${k ? `<span class="numero" title="Étape ${k}">${k}</span>` : ''}${m.table ? `<span class="pastille${m.table === 'Comptes rendus' ? ' texte' : ''}">${m.table}</span>` : ''}${esc(m.libelle)}</div>
        <div class="marche-barre"><span style="width:${Math.max(0.5, (100 * m.visites) / total)}%"></span></div>
        <div class="marche-nombres"><strong>${m.visites}</strong> visites · <strong>${m.patients}</strong> patients${indicateurs(m)}</div>
      </li>`).join('');
    if (n === 1) {
      html += '<li class="entonnoir-vide">Ajoutez un filtre ou une recherche, puis appliquez les filtres : chaque étape apparaîtra ici, numérotée, avec le nombre de lignes qui restent.</li>';
    }
    $('entonnoir').innerHTML = html;
  }

  // Barre collée en bas de l'écran, sur téléphone : le résultat, ou un rappel quand des filtres modifiés attendent
  // d'être appliqués.
  function rendreBarre(attente) {
    const fin = resultat.marches[resultat.marches.length - 1];
    $('barre-resultat').innerHTML = attente
      ? '<span><strong>Filtres modifiés</strong><span class="indicateurs">Touchez ici pour les appliquer.</span></span>'
        + '<span class="aller"><span class="texte">Appliquer les filtres </span><i class="fa-solid fa-filter"></i></span>'
      : `<span><strong>${fin.visites}</strong> visites · <strong>${fin.patients}</strong> patients${indicateurs(fin)}</span>`
        + '<span class="aller" aria-label="Voir les résultats"><span class="texte">Voir les résultats </span><i class="fa-solid fa-arrow-down"></i></span>';
  }

  $('barre-resultat').addEventListener('click', () => {
    if (modifie()) appliquer();
    $('resultats').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Numéro de l'étape dont l'onglet affiché montre les comptes rendus non sélectionnés ; 0 pour les autres onglets.
  function etapeAffichee() {
    return vue.startsWith('ecartes-') ? Number(vue.slice('ecartes-'.length)) : 0;
  }

  // Onglets : les comptes rendus sélectionnés, ceux que chaque étape n'a pas sélectionnés, puis les tables.
  function rendreOnglets() {
    const n = resultat.lignes.length;
    const onglet = (cle, contenu, attributs = '') =>
      `<button type="button" role="tab" data-vue="${cle}" aria-selected="${cle === vue}"${attributs}>${contenu}</button>`;
    $('onglets-tables').innerHTML = [
      onglet('cr', `Comptes rendus <span class="compte">${n} / ${base.cr.length}</span>`),
      ...resultat.marches.slice(1).map((m, i) => onglet(`ecartes-${i + 1}`,
        `Non sélectionnés à l'étape ${i + 1} <span class="compte">${m.ecartees.length}</span>`,
        ` class="ecartes" style="${styleEtape(i + 1)}" title="Comptes rendus non sélectionnés à l'étape ${i + 1}"`)),
      onglet('visites', `Visites <span class="compte">${n} / ${base.visites.length}</span>`),
      onglet('patients', `Patients <span class="compte">${E.nombrePatients(resultat.lignes)} / ${base.patients.length}</span>`),
    ].join('');
  }

  function rendreResultats() {
    if (etapeAffichee() >= resultat.marches.length) vue = 'cr';
    rendreOnglets();
    const comptesRendus = vue === 'cr' || etapeAffichee() > 0;
    $('vue-cr').hidden = !comptesRendus;
    $('vue-visites').hidden = vue !== 'visites';
    $('vue-patients').hidden = vue !== 'patients';
    if (comptesRendus) rendreCr();
    if (vue === 'visites') rendreVisites();
    if (vue === 'patients') rendrePatients();
  }

  const AUCUN = '<p class="vide">Aucune ligne ne correspond. Retirez un filtre, ou vérifiez l\'orthographe des termes.</p>';
  const nombreCr = n => `${n} compte${n > 1 ? 's' : ''} rendu${n > 1 ? 's' : ''}`;

  // En tête de l'onglet « Non sélectionnés à l'étape k » : le filtre de l'étape et ce qu'il a écarté.
  function bandeauEcartes(k) {
    const avant = resultat.marches[k - 1].visites;
    const n = resultat.marches[k].ecartees.length;
    let detail;
    if (k === 1) detail = n ? `Ce filtre écarte ${nombreCr(n)} sur ${avant}.` : "Ce filtre n'écarte aucun compte rendu.";
    else if (!avant) detail = `Il ne restait aucun compte rendu après l'étape ${k - 1}.`;
    else detail = `Après l'étape ${k - 1}, il restait ${nombreCr(avant)} : ce filtre ${n ? `en écarte ${n}` : "n'en écarte aucun"}.`;
    return `
      <div class="bandeau-etape" style="${styleEtape(k)}">
        <span class="numero">${k}</span>
        <p><strong>Non sélectionnés à l'étape ${k}</strong> · ${esc(resultat.marches[k].libelle)}<br>${detail}</p>
      </div>`;
  }

  // Le lecteur de comptes rendus : ceux de la sélection, ou ceux qu'une étape n'a pas sélectionnés.
  function rendreCr() {
    const k = etapeAffichee();
    const lignes = ordonner(k ? resultat.marches[k].ecartees : resultat.lignes);
    const bandeau = k ? bandeauEcartes(k) : '';
    if (!lignes.length) { $('vue-cr').innerHTML = bandeau + (k ? '' : AUCUN); return; }
    const rang = Math.min(positions[vue] || 0, lignes.length - 1);
    positions[vue] = rang;
    const v = lignes[rang];
    const criteres = applique.criteres.map(R.compilerCritere);
    const badges = criteres.map((c, i) => {
      if (!c.termes.length) return '';
      const present = R.trouver(v.texte, c).length > 0;
      const classe = c.exclure ? (present ? 'bloque' : 'absent') : (present ? 'present' : 'absent');
      const termes = c.termes.map(t => t.texte).join(' / ');
      return `<span class="badge ${classe}" style="${!c.exclure && present ? `background:${COULEURS[i % COULEURS.length]}` : ''}">${present ? '✓' : '✗'} ${c.exclure ? 'sans ' : ''}${esc(termes)}</span>`;
    }).join('');
    $('vue-cr').innerHTML = bandeau + `
      <div class="navigation-cr">
        <button class="bouton secondaire" data-nav="-1"${rang === 0 ? ' disabled' : ''}><i class="fa-solid fa-chevron-left"></i> Précédent</button>
        <span><strong>${rang + 1}</strong> / ${lignes.length}</span>
        <button class="bouton secondaire" data-nav="1"${rang >= lignes.length - 1 ? ' disabled' : ''}>Suivant <i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <article class="cr" aria-label="Compte rendu de la visite ${v.id_visite}">
        <div class="cr-entete">
          <div><span>Hôpital</span>${esc(v.hopital)}</div>
          <div><span>Médecin</span>${esc(v.cr.medecin)}</div>
          <div><span>Patient</span>${v.id_patient} (${v.patient.sexe}, ${v.patient.age} ans)</div>
          <div><span>Date</span>${E.dateFr(v.date)}</div>
          <div><span>T°C</span>${E.nombreFr(v.temperature)}</div>
          <div><span>PAS</span>${v.pas} mmHg</div>
          <div><span>FC</span>${v.fc} /min</div>
          <div><span>Test Nova</span>${esc(v.test_nova)}</div>
        </div>
        <div class="cr-corps">
          <h3>Anamnèse · visite ${v.id_visite}</h3>
          <p class="anamnese">${R.surligner(v.texte, criteres, COULEURS)}</p>
          <h3>Diagnostic</h3>
          <p>${v.diagnostic ? esc(v.diagnostic) : '<em>non renseigné</em>'}</p>
          <h3>Issue de la visite</h3>
          <p>${esc(v.issue)}</p>
        </div>
        <div class="cr-pied">${badges}
          <button class="bouton petit" data-proposer="${v.id_patient}"><i class="fa-solid fa-crosshairs"></i> Proposer ${v.id_patient}</button>
        </div>
      </article>`;
  }

  function rendreVisites() {
    const lignes = ordonner(resultat.lignes);
    if (!lignes.length) { $('vue-visites').innerHTML = AUCUN; return; }
    const corps = lignes.slice(0, limiteVisites).map(v => `
      <tr data-visite="${v.id_visite}" tabindex="0">
        <td>${v.id_visite}</td><td>${v.id_patient}</td><td>${E.dateFr(v.date)}</td><td>${esc(v.hopital)}</td>
        <td class="nombre">${E.nombreFr(v.temperature)}</td><td class="nombre">${v.pas}</td><td class="nombre">${v.fc}</td>
        <td>${esc(v.test_nova)}</td><td>${esc(v.diagnostic)}</td><td>${esc(v.issue)}</td>
      </tr>`).join('');
    $('vue-visites').innerHTML = `
      <p class="discret">Touchez une ligne pour lire son compte rendu.</p>
      <div class="defilement"><table>
        <thead><tr><th>Visite</th><th>Patient</th><th>Date</th><th>Hôpital</th><th>T°C</th><th>PAS</th><th>FC</th><th>Test Nova</th><th>Diagnostic</th><th>Issue</th></tr></thead>
        <tbody>${corps}</tbody>
      </table></div>
      ${lignes.length > limiteVisites ? `<div class="plus"><button class="bouton secondaire" data-plus="visites">Afficher ${Math.min(PAR_PAGE, lignes.length - limiteVisites)} lignes de plus (${limiteVisites} sur ${lignes.length})</button></div>` : ''}`;
  }

  function rendrePatients() {
    const parPatient = new Map();
    for (const v of ordonner(resultat.lignes)) {
      if (!parPatient.has(v.id_patient)) parPatient.set(v.id_patient, { patient: v.patient, visites: 0, premiere: v });
      parPatient.get(v.id_patient).visites++;
    }
    const lignes = [...parPatient.values()];
    if (!lignes.length) { $('vue-patients').innerHTML = AUCUN; return; }
    const corps = lignes.slice(0, limitePatients).map(l => `
      <tr data-visite="${l.premiere.id_visite}" tabindex="0">
        <td>${l.patient.id_patient}</td><td>${l.patient.sexe}</td><td class="nombre">${l.patient.age}</td><td>${esc(l.patient.ville)}</td>
        <td class="nombre">${l.visites}</td><td>${E.dateFr(l.premiere.date)}</td>
      </tr>`).join('');
    $('vue-patients').innerHTML = `
      <p class="discret">Patients qui ont au moins une visite retenue. Touchez une ligne pour lire le compte rendu de cette visite.</p>
      <div class="defilement"><table>
        <thead><tr><th>Patient</th><th>Sexe</th><th>Âge</th><th>Ville</th><th>Visites retenues</th><th>${ordre === 'asc' ? 'Première' : 'Dernière'} visite retenue</th></tr></thead>
        <tbody>${corps}</tbody>
      </table></div>
      ${lignes.length > limitePatients ? `<div class="plus"><button class="bouton secondaire" data-plus="patients">Afficher ${Math.min(PAR_PAGE, lignes.length - limitePatients)} lignes de plus (${limitePatients} sur ${lignes.length})</button></div>` : ''}`;
  }

  function ouvrirCr(idVisite) {
    vue = 'cr';
    positions.cr = Math.max(0, ordonner(resultat.lignes).findIndex(v => v.id_visite === idVisite));
    rendreResultats();
    $('vue-cr').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.querySelector('.onglets-tables').addEventListener('click', e => {
    const bouton = e.target.closest('[data-vue]');
    if (!bouton) return;
    vue = bouton.dataset.vue;
    rendreResultats();
  });

  $('ordre').addEventListener('change', () => {
    ordre = $('ordre').value;
    positions = {};
    rendreResultats();
  });

  for (const id of ['vue-cr', 'vue-visites', 'vue-patients']) {
    $(id).addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]');
      const plus = e.target.closest('[data-plus]');
      const ligne = e.target.closest('tr[data-visite]');
      const proposer = e.target.closest('[data-proposer]');
      if (nav) { positions[vue] += Number(nav.dataset.nav); rendreCr(); }
      if (plus && plus.dataset.plus === 'visites') { limiteVisites += PAR_PAGE; rendreVisites(); }
      if (plus && plus.dataset.plus === 'patients') { limitePatients += PAR_PAGE; rendrePatients(); }
      if (ligne) ouvrirCr(ligne.dataset.visite);
      if (proposer) {
        $('proposition').value = proposer.dataset.proposer;
        $('proposer').scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('proposition').focus({ preventScroll: true });
      }
    });
    $(id).addEventListener('keydown', e => {
      const ligne = e.target.closest('tr[data-visite]');
      if (ligne && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ouvrirCr(ligne.dataset.visite); }
    });
  }

  // --- Missions d'entraînement -----------------------------------------------------------------------------

  const NON_APPLIQUES = "Ce n'est pas le bon nombre. Vous avez modifié les filtres sans les appliquer : cliquez sur « Appliquer les filtres », puis relisez l'entonnoir.";

  function changerMission(n) {
    mission = n;
    memoire.ecrire('pz-mission-v2', n);
    rendreMission();
  }

  function rendreMission() {
    const bloc = $('mission');
    if (mission >= E.MISSIONS.length) {
      bloc.className = 'carte mission terminee';
      bloc.innerHTML = `
        <div class="mission-tete"><span class="etiquette">Entraînement terminé</span>
          <button class="bouton lien" data-mission="revoir">Revoir l'entraînement</button></div>
        <h2>À vous : trouvez le patient zéro</h2>
        <p>Vous savez filtrer les tables et chercher dans les comptes rendus. Relisez l'histoire et la fiche du
        virus, puis suivez la méthode :</p>
        <ol class="etapes-methode">${$('methode').innerHTML}</ol>`;
      return;
    }
    const m = E.MISSIONS[mission];
    bloc.className = 'carte mission';
    bloc.innerHTML = `
      <div class="mission-tete"><span class="etiquette">Entraînement ${mission + 1} sur ${E.MISSIONS.length}</span>
        <button class="bouton lien" data-mission="passer">Passer l'entraînement</button></div>
      <h2>${m.titre}</h2>
      <p>${m.consigne}</p>
      <form class="ligne" id="form-mission">
        <label>Votre réponse <input type="text" inputmode="numeric" id="reponse-mission" autocomplete="off"></label>
        <button class="bouton principal" type="submit">Vérifier</button>
        <button class="bouton secondaire" type="button" data-mission="indice">Indice</button>
      </form>
      <div class="retour" id="retour-mission"></div>`;
  }

  $('mission').addEventListener('click', e => {
    const bouton = e.target.closest('[data-mission]');
    if (!bouton) return;
    const action = bouton.dataset.mission;
    if (action === 'passer') changerMission(E.MISSIONS.length);
    if (action === 'revoir') changerMission(0);
    if (action === 'suivante') changerMission(mission + 1);
    if (action === 'indice') {
      $('retour-mission').className = 'retour info';
      $('retour-mission').textContent = E.MISSIONS[mission].indice;
    }
  });

  $('mission').addEventListener('submit', e => {
    e.preventDefault();
    const m = E.MISSIONS[mission];
    const attendu = E.reponseMission(base, m);
    const donne = parseInt($('reponse-mission').value, 10);
    const retour = $('retour-mission');
    if (donne === attendu) {
      retour.className = 'retour ok';
      retour.innerHTML = `Bravo, ${attendu} ${m.compte}. ${esc(m.bravo)}
        <div class="actions"><button class="bouton principal" data-mission="suivante">${mission + 1 < E.MISSIONS.length ? 'Mission suivante' : 'Commencer l\'enquête'} <i class="fa-solid fa-arrow-right"></i></button></div>`;
      return;
    }
    retour.className = 'retour ko';
    if (modifie()) { retour.textContent = NON_APPLIQUES; return; }
    const affiche = m.compte === 'patients' ? E.nombrePatients(resultat.lignes) : resultat.lignes.length;
    retour.textContent = `Ce n'est pas le bon nombre. Votre entonnoir affiche ${affiche} ${m.compte} : `
      + (affiche === attendu ? 'c\'est ce chiffre qu\'il faut taper.' : m.indice);
  });

  // --- Question bonus, proposition et bilan ----------------------------------------------------------------

  $('form-bonus').addEventListener('submit', async e => {
    e.preventDefault();
    const retour = $('bonus-retour');
    const r = await E.verifierNombreMalades(base, $('bonus-reponse').value, resultat.lignes);
    const messages = {
      format: ['ko', 'Tapez un nombre de patients, en chiffres.'],
      juste: ['ok', `Bravo ! ${r.n} patients ont eu le Nova-virus entre mars et juin 1975. Reste à trouver celui qui l'a ramené en France.`],
      visites: ['info', `${r.n}, c'est le nombre de visites des malades. Un malade peut venir plusieurs fois aux urgences : comptez les patients.`],
      lire: ['ko', "Ce n'est pas le bon nombre. Votre sélection garde exactement les malades : lisez son nombre de patients dans l'entonnoir."],
      selection: ['ko', "Ce n'est pas le bon nombre. Votre sélection ne garde pas encore exactement les malades : visez 100 % de rappel et 100 % de précision, puis comptez les patients."],
    };
    // « lire » et « selection » jugent l'entonnoir affiché : il n'est pas à jour si des filtres attendent.
    const [classe, texte] = modifie() && ['lire', 'selection'].includes(r.statut) ? ['ko', NON_APPLIQUES] : messages[r.statut];
    retour.className = 'retour ' + classe;
    retour.textContent = texte;
  });

  $('form-proposition').addEventListener('submit', async e => {
    e.preventDefault();
    const retour = $('proposition-retour');
    const r = await E.verifierProposition(base, $('proposition').value);
    const messages = {
      format: ['ko', 'Tapez un identifiant de patient, par exemple P0123.'],
      inconnu: ['ko', `${r.id} n'existe pas dans la table Patients.`],
      sain: ['ko', `${r.id} n'a pas le Nova-virus.`],
      malade: ['info', `${r.id} a bien le Nova-virus, mais ce n'est pas ce patient qui l'a ramené en France.`],
      zero: ['ok', `Bravo ! ${r.id} est bien le patient zéro.`],
    };
    const [classe, texte] = messages[r.statut];
    retour.className = 'retour ' + classe;
    retour.textContent = texte;
    if (r.statut === 'zero') {
      trouve = r.id;
      memoire.ecrire('pz-trouve', r.id);
      retour.insertAdjacentHTML('beforeend', '<div class="actions"><button class="bouton principal" data-aller="bilan">Lire le fin mot de l\'histoire <i class="fa-solid fa-arrow-right"></i></button></div>');
    }
  });

  // Le bilan est rédigé en Markdown simple par le générateur : titres ##, listes « - » et **gras**.
  function versHtml(texte) {
    const enLigne = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    let html = '';
    let liste = false;
    for (const ligne of texte.split('\n')) {
      if (ligne.startsWith('- ')) {
        if (!liste) { html += '<ul>'; liste = true; }
        html += `<li>${enLigne(ligne.slice(2))}</li>`;
        continue;
      }
      if (liste) { html += '</ul>'; liste = false; }
      if (ligne.startsWith('## ')) html += `<h2>${enLigne(ligne.slice(3))}</h2>`;
      else if (ligne.trim()) html += `<p>${enLigne(ligne)}</p>`;
    }
    return html + (liste ? '</ul>' : '');
  }

  // Le bilan est chiffré : il s'ouvre avec la bonne réponse, ou avec le mot de passe de l'animateur (gardé en
  // mémoire seulement jusqu'au rechargement de la page).
  let bilanAnimateur = null;

  async function rendreBilan() {
    const bloc = $('bilan-histoire');
    if (trouve && (await E.verifierProposition(base, trouve)).statut !== 'zero') {
      trouve = null;
      memoire.ecrire('pz-trouve', null);
    }
    $('acces-animateur').hidden = Boolean(trouve || bilanAnimateur);
    if (trouve) {
      bloc.innerHTML = '<span class="etiquette succes">Enquête résolue</span>' + versHtml(await E.dechiffrerBilan(base, trouve));
    } else if (bilanAnimateur) {
      bloc.innerHTML = '<span class="etiquette">Accès animateur</span>' + versHtml(bilanAnimateur);
    } else {
      bloc.innerHTML = `<h2><i class="fa-solid fa-lock"></i> Le bilan est verrouillé</h2>
        <p>Il s'ouvre quand vous avez trouvé le patient zéro.</p>
        <button class="bouton secondaire" data-aller="enquete"><i class="fa-solid fa-arrow-left"></i> Retour à l'enquête</button>`;
    }
  }

  $('form-animateur').addEventListener('submit', async e => {
    e.preventDefault();
    const retour = $('animateur-retour');
    retour.className = 'retour info';
    retour.textContent = 'Vérification…';
    const texte = await E.ouvrirBilanAnimateur(base, $('mot-de-passe').value);
    $('mot-de-passe').value = '';
    if (!texte) {
      retour.className = 'retour ko';
      retour.textContent = 'Mot de passe incorrect.';
      return;
    }
    retour.textContent = '';
    bilanAnimateur = texte;
    rendreBilan();
  });

  $('rejouer').addEventListener('click', () => {
    trouve = null;
    bilanAnimateur = null;
    memoire.ecrire('pz-trouve', null);
    changerMission(0);
    toutEffacer();
    $('bonus-reponse').value = '';
    $('bonus-retour').textContent = '';
    $('proposition').value = '';
    $('proposition-retour').textContent = '';
    allerA('affaire');
  });

  // --- Démarrage -------------------------------------------------------------------------------------------

  rendreCourbe();
  rendreSchema();
  preparerFiltres();
  rendreCriteres();
  rendreMission();
  calculer();
  const pageDemandee = location.hash.slice(1);
  if (['enquete', 'bilan'].includes(pageDemandee)) allerA(pageDemandee);
  // Le rappel et la précision s'affichent dès que les malades sont retrouvés (calcul d'empreintes).
  E.preparerVerite(base).then(calculer).catch(() => { /* navigateur sans crypto.subtle : pas d'indicateurs */ });
})();
