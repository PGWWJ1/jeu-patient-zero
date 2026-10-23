# Council du 23/10/2026 : améliorer le jeu « Patient Zéro »

Session de LLM Council (5 conseillers, 5 relectures anonymes, 1 président), lancée sur le dépôt
https://github.com/PGWWJ1/jeu-patient-zero (commit `616004e`).

## 1. Question d'origine (Pierre)

> j'aimerais retoucher un code sur mon github personnel le jeu patient zero […], ce jeux est fais pour
> « jeu d'investigation - trouver le patient zéro d'une épidémie » à destination d'un public assez novice en IA,
> ce sont des infirmiers. Le but : leur montrer l'intérêt des recherches IA et des données de santé en général
> via un cadre ludique créé de toute pièce.
>
> Mise en situation : une épidémie d'un nouveau virus arrive en France au temps T0. Le virus est apparu dans le
> pays X au temps Tini < T0.
>
> Informations données aux participants : un graphique (courbe des cas détectés dans les hôpitaux de France via
> un test mis au point) ; une fiche d'information du virus (fortes fièvres > 40 °C, plaques rouges douloureuses,
> incubation 2-4 semaines, apparu dans le pays X au temps Tini ; symptômes si puissants que les patients vont
> forcément aux urgences ; au début, aucun diagnostic ne pouvait être posé) ; un exemple de CR (en-tête hôpital,
> médecin, patient, T°C, PAS, FC, date ; anamnèse d'environ 100 mots avec fautes de frappe et 2 ou 3 façons
> d'exprimer un symptôme, voyage ou non, symptômes dans la famille ; diagnostic court, parfois vide ; issue de
> la visite) ; le début d'une table structurée
> `id_patient|id_visite|hopital de visite|date de la consultation|diagnostic de la consultation|T°C|PAS|FC`.
> But du jeu : trouver le patient zéro qui a importé le virus en France.
>
> J'aimerais améliorer un peu l'interface pour que le jeu soit plus clair et aussi adapté en vision téléphone
> avec des données propres. Rendre le jeu didactique peut-être avec un vrai petit tuto. J'aimerais également
> faire en sorte que la sélection sur données structurées soit plus claire, avoir une vue de différentes tables
> et de voir le résultat des filtrages sur le nombre de lignes de ces tableaux.
>
> Fais-moi un rapport de ce qui peut être fait.

## 2. Audit préalable (animateur)

Scripts d'audit lancés sur `data.json` avant la session :

- 1921 visites, 1000 patients (1 à 3 visites, espacées de 0 à 10 jours), du 02/03/1975 au 11/11/1975, 7 CHU.
- Champs : `id_patient`, `id_visite`, `consultation_date`, `temperature`, `hospital`, `infected`, `report_text`.
  PAS, FC et diagnostic n'existent que dans le texte du CR.
- Hôpital de l'en-tête du CR ≠ champ `hospital` dans 1665 visites sur 1921 (87 %). 559 patients changent de CHU.
- Issue de la visite : « Retour à domicile » pour 1921 visites sur 1921.
- Diagnostics : « Syndrome fébrile » 1163, « Suspicion nouveau virus » 697 (tous infectés, tous après T0),
  vide 59, « Rougeole » 1, « Infection tropicale d'allure indéterminée » 1 (P0925, le patient zéro).
- 893 visites infectées, 450 patients infectés (45 %), environ 100 à 130 visites infectées par mois de mars à
  octobre. `courbe.png` montre au contraire un cas isolé fin avril puis une vague de juin à novembre.
- 100 % des visites infectées ont les trois symptômes et une T°C entre 40,0 et 41,0 ; 95 visites non infectées
  ont aussi T°C ≥ 40.
- 51 phrases distinctes dans les anamnèses ; 67 visites mentionnent Karovia (14 infectées).
- Patient zéro attendu : P0925, visite V01770 du 17/03/1975, CHU Bordeaux, 40,6 °C, retour de Karovia.
- `index.html` : pas de `<meta name="viewport">` ; `infected` livré au navigateur ; bandeau précision/rappel
  calculé sur la vérité ; la vérification compare au premier infecté chronologique et souffle « cherchez le cas
  infecté le plus ancien ».

Vérifications faites après le tour des conseillers :

- Hors P0925, 24 patients (42 visites) sont infectés avant le 31/03/1975, le premier dès le 18/03, et un seul
  mentionne Karovia : l'énigme contredit l'incubation de 2 à 4 semaines.
- Les 8 premières visites à T°C ≥ 40 sont des non-infectés (dès le 02/03) ; avec T°C ≥ 40 et « Karovia »,
  P0925 est la 3e visite.

## 3. Question soumise aux conseillers

> QUESTION POSÉE AU COUNCIL (répondre en français)
>
> Pierre veut améliorer son jeu web « Patient Zéro » (dépôt GitHub perso, cloné en lecture dans
> [chemin du clone local] : index.html, data.json, courbe.png ; tu peux les consulter si
> utile, mais ne modifie rien). Il demande un rapport de ce qui peut être fait, et dans quel ordre.
>
> PUBLIC ET BUT
> Des infirmiers, novices en IA. But : leur montrer l'intérêt de la recherche par IA et des données de santé,
> dans un cadre ludique entièrement fictif. Scénario : un nouveau virus arrive en France ; il est apparu dans un
> pays étranger avant. Les joueurs disposent d'une courbe des cas détectés, d'une fiche du virus (fièvre > 40 °C,
> plaques rouges douloureuses, absence de réflexe rotulien, incubation 2-4 semaines ; un test n'existe qu'à
> partir de T0 = 05/05/1975, avant le virus n'apparaît jamais dans les diagnostics), de comptes rendus (CR)
> d'urgences en texte libre avec fautes de frappe et synonymes (« plaques rouges douloureuses », « PRD »,
> « plaques rouges dlr »), et d'une table structurée (id_patient | id_visite | hôpital | date | diagnostic | T°C |
> PAS | FC). Objectif : trouver le patient zéro qui a importé le virus.
>
> CE QUE PIERRE DEMANDE
> 1. Une interface plus claire et utilisable sur téléphone.
> 2. Des données propres.
> 3. Un vrai petit tutoriel didactique.
> 4. Une sélection sur données structurées plus claire : voir les différentes tables, et voir l'effet de chaque
>    filtre sur le nombre de lignes de ces tables.
>
> ÉTAT ACTUEL (audité)
> - Un seul fichier index.html de 703 lignes (HTML/CSS/JS vanilla, Font Awesome via CDN), data.json de 2 Mo
>   chargé par fetch (donc hébergement statique type GitHub Pages ; aucun serveur), courbe.png statique. Pas de
>   script générateur des données dans le dépôt (fichiers téléversés à la main via l'interface GitHub).
> - Trois pages : 1) contexte et courbe ; 2) « guide de filtrage NLP » statique avec trois exemples (termes
>   synonymes ; case « Exclure » ; « Groupe » de phrase qui oblige deux termes à apparaître dans la même
>   phrase) ; 3) « terminal d'enquête » : filtres date min/max, température min, hôpital ; blocs NLP (nom de
>   section, termes, Exclure, Groupe 1/2) ; bouton « Filtrer la base » ; bandeau de 4 indicateurs (CR
>   sélectionnés, CR sélectionnés de personnes infectées, précision, rappel) ; visionneuse d'un CR à la fois avec
>   surlignage des termes et précédent/suivant ; case « Identifier le patient zéro ».
> - Pas de balise meta viewport : sur téléphone, la page s'affiche en largeur bureau rétrécie. Mise en page en
>   grille fixe (colonne de filtres de 390 px + visionneuse, 4 cartes de stats).
> - Données : 1921 visites, 1000 patients (1 à 3 visites chacun, espacées de 0 à 10 jours), du 02/03/1975 au
>   11/11/1975, 7 CHU. Champs : id_patient, id_visite, consultation_date, temperature, hospital, infected
>   (booléen), report_text. PAS, FC et diagnostic n'existent que dans le texte du CR, pas comme colonnes. Pas de
>   table patients séparée.
> - Fuite de la solution : le champ « infected » est livré au navigateur (lisible dans les outils de
>   développement) ; le bandeau affiche en direct le nombre d'infectés sélectionnés, la précision et le rappel,
>   donc on peut réduire la plage de dates jusqu'à ce qu'il reste 1 infecté. Le message d'erreur de la case de
>   vérification dit « cherchez le cas infecté le plus ancien ».
> - Incohérences : l'hôpital de l'en-tête du CR diffère du champ « hospital » dans 1665 visites sur 1921 (87 %).
>   Un même patient change de CHU (Lyon puis Nantes) à 3 jours d'intervalle (559 patients). Toutes les issues de
>   visite valent « Retour à domicile », même avec fièvre > 40 °C et « état préoccupant ». Des patients
>   « absence de fièvre, 37,3 °C » ont le diagnostic « Syndrome fébrile ». Première visite d'un patient parfois
>   intitulée « Consultation de contrôle ».
> - La courbe ne correspond pas aux données : courbe.png montre un cas isolé fin avril puis une vague de juin à
>   novembre (environ 800 cas cumulés, pic en juillet), alors que data.json a des infectés dès le 17/03/1975 et
>   environ 100 à 130 visites infectées par mois, stables de mars à octobre (893 visites infectées, 450
>   patients : 45 % des patients). Le récit dit « Mai 1975 » alors que le foyer étranger date de mars.
> - Signal trop parfait : 100 % des visites infectées ont les trois symptômes et une T°C ≥ 40,0 ; après T0, le
>   diagnostic vaut « Suspicion nouveau virus » pour 100 % des infectés et « Syndrome fébrile » pour 100 % des
>   non-infectés. Le patient zéro (P0925, 17/03/1975, CHU Bordeaux, retour de « Karovia ») est le seul CR du jeu
>   avec le diagnostic « Infection tropicale d'allure indéterminée ». 67 visites mentionnent Karovia (14
>   infectées), d'autres pays fictifs apparaissent aussi.
> - Le texte libre ne contient que 51 phrases distinctes (gabarits), avec négations (« Absence de plaques
>   rouges », « Pas de rflx rotulien ») qui piègent la recherche par mot-clé : c'est un bon ressort pédagogique.
>   La recherche porte sur tout le CR (en-tête et diagnostic compris), pas seulement l'anamnèse comme le dit le
>   guide. La recherche par préfixe fait que « rouge » trouve aussi « rougeole ».
>
> INCONNUES
> Format des séances (durée, solo ou en équipe, présence d'un animateur, sur téléphone personnel ou poste fixe) :
> non précisé. Pierre développe seul, sur son temps libre.
>
> ENJEU
> Si le jeu déroute des novices, ou si des soignants voient des données cliniquement absurdes, ils retiendront
> que « les données de santé, c'est n'importe quoi » : l'inverse du but. À l'inverse, un jeu clair et crédible
> peut devenir un support de formation réutilisable.
>
> Question : que faut-il faire pour améliorer ce jeu, dans quel ordre, et que faut-il éviter ?

## 4. Réponses des conseillers

### Le Contradicteur

**Le défaut fatal n'est pas dans la liste de Pierre : l'énigme elle-même ne tient pas.** J'ai vérifié dans
data.json. P0925 consulte le 17/03. Avant le 31/03, on trouve déjà 25 autres patients infectés (43 visites), dès
le 18/03, et 2 seulement mentionnent Karovia. Avec une incubation de 2 à 4 semaines, P0925 ne peut pas avoir
contaminé quelqu'un qui est malade le lendemain. Un infirmier qui a lu la fiche du virus le verra. Il conclura
soit que la réponse attendue est fausse, soit que les données sont truquées. C'est exactement le message à
éviter. Il faut d'abord écrire le script générateur qui respecte l'incubation, puis seulement reprendre
l'interface. Sans ce script, chaque correction faite à la main introduira de nouvelles incohérences.

**Deuxième défaut : on résout le jeu sans « IA ».** On met la température minimale à 40, on trie par date, on
lit les quelques premiers CR, et c'est fini. Le texte libre ne sert à rien, alors que c'est lui qui devait
montrer l'intérêt de l'IA. Et ce que le jeu appelle « NLP », c'est de la recherche par mots-clés avec des
opérateurs booléens. Le présenter comme de l'IA à des novices, c'est leur mentir. Mieux vaut l'assumer : le jeu
montre les limites des mots-clés (négations, « rougeole »), et c'est ce qui justifie l'IA. Il faut aussi que la
température seule ne suffise pas : des fièvres à 40 °C non infectées, et des infectés qui n'ont pas tous les
symptômes.

**Troisième défaut : la demande n° 4 aggrave la fuite.** Afficher l'effet de chaque filtre sur le nombre de
lignes, très bien. Mais la précision et le rappel en direct supposent de connaître la vérité, et ça n'existe
jamais dans une vraie enquête. Il faut les retirer du terminal, retirer « infected » du navigateur (ne garder
qu'un hachage de la réponse) et les réserver au tutoriel, sur un échantillon annoté. Autre point : plusieurs
tables à joindre, c'est un concept de plus pour des novices. Une table patients en lecture seule suffit.

**À éviter :**
- refondre l'interface pour le téléphone avant de connaître le format des séances : la meta viewport suffit
  d'abord ;
- nettoyer les données au point de supprimer les fautes de frappe : c'est le bruit pédagogique, ce qui doit
  disparaître ce sont les absurdités cliniques ;
- écrire le tutoriel avant que l'énigme soit cohérente.

### Le Penseur des premiers principes

**Pierre pose une question d'interface, mais le problème est ailleurs : le jeu n'a pas de vérité de
référence.**

Ses quatre demandes portent sur des symptômes. Ils ont une cause commune : il n'existe ni scénario
épidémiologique écrit, ni script générateur. La courbe, le récit, les données et le message d'erreur ont été
fabriqués chacun de leur côté, donc ils se contredisent : 45 % des patients infectés dès mars, une courbe qui
décrit une autre épidémie, des patients qui changent de CHU en trois jours. Corriger data.json à la main ferait
revenir le même problème.

**Ordre proposé :**

1. **Écrire sur une page ce qui s'est « réellement » passé** : la date d'arrivée du patient zéro, la chaîne de
   contamination, quelques cas avant T0 puis la croissance, et une proportion de malades crédible (quelques %,
   pas 45 %). Faire relire cette page par un soignant.
2. **Un seul script générateur** qui produit les tables (patients, visites, CR, avec diagnostic, PAS et FC en
   colonnes) **et** la courbe. Avec une seule source, les incohérences deviennent impossibles. Le champ
   « infected » n'est jamais envoyé au navigateur. La vérification se fait par empreinte (hash) de l'identifiant
   du patient zéro. Celui-ci ne doit plus être le seul CR à porter un diagnostic unique.
3. **Rebâtir le déroulé du jeu autour de l'idée pédagogique déjà présente, mais inexploitée.** Après T0, le
   diagnostic de la table sert d'étiquette. Le joueur règle son filtre sur le texte des CR pendant cette période
   étiquetée : précision et rappel sont calculés par rapport à ce diagnostic, plus par rapport à la solution
   cachée. Il applique ensuite ce filtre avant T0, où aucun diagnostic n'existe, et remonte de 2 à 4 semaines
   d'incubation. C'est exactement la logique réelle de l'IA en santé : apprendre là où l'on sait, appliquer là où
   l'on ne sait pas. La fuite de la solution disparaît d'elle-même.
4. **Seulement ensuite :** le tutoriel (en faire une première mission guidée, pas une page à lire), l'affichage
   sur téléphone, et les compteurs de lignes par table.

**À éviter :**
- Peaufiner l'interface tant que les données ne sont pas crédibles.
- Appeler « IA » une recherche par mots-clés sans montrer où elle échoue. Le piège « Absence de plaques rouges »
  est la leçon elle-même, pas un défaut à corriger.
- Choisir entre téléphone et poste fixe avant d'avoir fixé le format des séances.

### L'Expansionniste

On sous-estime une chose : sans le dire, ce jeu reproduit le vrai travail de la surveillance syndromique, celui
que Santé publique France fait avec le réseau OSCOUR (passages aux urgences), et celui d'un entrepôt de données
de santé qui constitue une cohorte. Il faut l'assumer. Les infirmiers repartiront alors avec une image juste de
ce métier, pas seulement avec le souvenir d'un jeu.

**1. D'abord un générateur de données (script Python avec graine), pas des corrections de data.json à la
main.** Un seul script corrige tout d'un coup : la cohérence clinique, la courbe tirée des mêmes données, les
vraies tables (patients, visites, CR) demandées au point 4. Il ouvre aussi des scénarios rejouables : un autre
patient zéro, un autre virus, trois niveaux de difficulté. Le jeu ponctuel devient un support de formation qu'on
peut réutiliser.

**2. Faire de l'entonnoir de filtres le cœur visuel.** Afficher 1921 → 412 → 87 → 3 lignes, filtre après filtre
et table par table : c'est le moment où un novice comprend ce qu'est une requête. Sur téléphone, l'affichage
peut s'empiler verticalement.

**3. Ajouter vraiment de l'IA.** Pour l'instant, le jeu ne fait que de la recherche par mot-clé. Il faut ajouter
une étape « classification par IA » : des étiquettes calculées à l'avance par un modèle, livrées dans le JSON,
sans serveur, avec quelques erreurs volontaires. Le joueur voit alors l'IA réussir là où le mot-clé échoue
(« Absence de plaques rouges ») et la voit se tromper ailleurs. C'est la leçon la plus précieuse.

**4. Transformer la fuite en pédagogie.** Garder la précision et le rappel, mais les calculer sur un petit
échantillon annoté par un « médecin référent » fictif, pas sur la vérité complète. Les joueurs découvrent ainsi
les notions de référence annotée et de validation.

**5. Un tutoriel qui soit un niveau 0 jouable, et un écran de bilan** qui fait le lien : « ce que vous venez de
faire s'appelle… ».

**À éviter :** rafistoler data.json à la main, ou écrire le tutoriel comme une page statique de plus.

### L'Œil extérieur

J'ouvre la page sans rien savoir, en me mettant à la place d'un infirmier.

**Je ne sais pas ce que je dois faire ni comment on gagne.** L'objectif (« trouver le patient zéro ») arrive
seulement à la page 3, dans une petite case en bas. Il faut l'écrire dès le premier écran, en une phrase : « Un
patient a ramené ce virus en France. Retrouvez son identifiant. » Ce qui compte comme une victoire doit aussi
être clair.

**Le vocabulaire m'exclut.** Je lis « Terminal d'enquête », « Filtres NLP & Multi-combinaisons », « Isolement
contextuel », « Élimination radicale », « Section », « Groupe 1 », « Précision », « Rappel ». Aucun de ces mots
n'est le mien. Je propose de remplacer « NLP » par « recherche dans le texte », « Groupe » par « dans la même
phrase », et « Exclure » par « ne doit pas contenir ». « Précision » et « Rappel » sont des notions d'expert : il
faut les retirer du jeu, ou les garder pour le débriefing.

**Un indicateur me donne la réponse sans que je le comprenne.** Le bandeau affiche les « CR sélectionnés de
personnes infectées ». Je me demande comment le logiciel sait qui est infecté, puisque c'est justement ce que je
cherche. Pour un novice, c'est incohérent ; pour un malin, c'est la solution.

**Je ne vois pas l'IA.** On promet de « montrer l'intérêt de la recherche par IA », mais je tape des mots-clés.
Si personne ne fait le lien explicitement, le joueur repart sans avoir compris ce qu'on voulait lui montrer.

**Les exemples du guide parlent d'autre chose.** « Choc frontal » et « le patient fume » n'ont rien à voir avec
l'enquête. Le tutoriel devrait être la première minute du jeu, sur les vraies données : « Cherchez "plaques
rouges". Vous trouvez 600 comptes rendus ? Regardez : certains disent "absence de plaques rouges". Ajoutez une
exclusion. »

**L'année 1975 et « T0 » m'arrêtent.** On ne m'explique ni pourquoi 1975, ni ce que veut dire T0.

**Ordre conseillé :**
1. Écrire l'objectif en une phrase et remplacer le jargon par des mots simples (une soirée de travail).
2. Faire du tutoriel une mission guidée dans le jeu.
3. Rendre le jeu utilisable sur téléphone.
4. Corriger les données.

**À éviter :** ajouter des fonctions avant d'avoir regardé un vrai infirmier jouer seul, sans aide, pendant dix
minutes. Noter chaque endroit où il bloque : cela vaut mieux que tout ce rapport.

### L'Exécutant

**Le blocage n'est pas l'interface. Le vrai problème, c'est qu'il n'existe aucun script qui génère les
données.** data.json a été téléversé à la main. Tant que c'est le cas, chaque correction (hôpitaux, courbe,
bruit clinique) se fait au doigt dans 2 Mo de JSON. Mieux vaut ne pas commencer par là.

**Soirée 1, gains immédiats dans index.html :**
- Ajouter `<meta name="viewport">` et une media query qui empile `.main-wrapper` (390px + 1fr, ligne 46) et les
  4 cartes de stats sous 700 px.
- Supprimer l'indice « cherchez le cas infecté le plus ancien » (ligne 691). Remplacer la vérification par une
  comparaison avec un hash de l'identifiant du patient zéro.
- Retirer précision et rappel du terminal d'enquête. Les garder seulement dans le tutoriel, sur un petit jeu
  d'environ 40 CR annotés, distinct de l'enquête.

**Semaine 1 : écrire `generer.py`**, avec une graine fixe. Il produit, d'une seule source de vérité :
- trois tables : `patients`, `visites` (avec PAS, FC et diagnostic en colonnes) et `cr` ;
- sans `infected` côté client.

Il corrige aussi le contenu :
- même CHU dans l'en-tête et dans la colonne ;
- un patient garde son CHU ;
- l'issue de la visite dépend de la gravité ;
- du bruit : des infectés incomplets, des non-infectés fébriles ;
- un diagnostic du patient zéro qui n'est pas unique.

La courbe est tracée dans le navigateur à partir des données, en canvas, pour qu'elle ne puisse plus jamais
diverger. On supprime courbe.png.

**Semaine 2 : l'entonnoir.** C'est simple : appliquer les filtres un par un et afficher le nombre de lignes de
chaque table après chaque étape (1921 → 1340 → 212…). L'effet de chaque filtre devient visible, et c'est
exactement le point 4 demandé.

**Semaine 3 : le tutoriel.** Pas une page statique de plus, mais 4 missions guidées dans le vrai terminal,
chacune avec une réponse chiffrée à valider : « combien de CR contiennent PRD ? », puis le piège de la négation,
puis le groupe de phrase.

**Ensuite :** tester avec 2 infirmiers, sur leur téléphone, avant toute diffusion.

**À éviter :**
- réécrire en React ou avec un outil de build ;
- ajouter un serveur ;
- tout refaire d'un bloc ;
- retoucher le gameplay avant que le générateur existe, car tout serait à refaire quand les données changent ;
- chercher à cacher la solution côté client mieux qu'avec un hash : c'est impossible en statique, et inutile
  pour ce public.

## 5. Relectures croisées

Correspondance des lettres (tirée au hasard, cachée aux relecteurs) :

| Lettre | Conseiller |
|---|---|
| A | L'Exécutant |
| B | Le Contradicteur |
| C | L'Expansionniste |
| D | L'Œil extérieur |
| E | Le Penseur des premiers principes |

Bilan : les 5 relecteurs désignent **E** (Premiers principes) comme la réponse la plus solide et **D** (Œil
extérieur) comme celle qui a le plus gros angle mort ; 5 sur 5 jugent aussi **C** (Expansionniste) trop lourd
pour un développeur seul.

### Relecteur 1

1. La plus solide : E. Elle remonte à la cause : aucun scénario de référence n'a été écrit, si bien que la
   courbe, le récit et les données se contredisent. Elle propose aussi le seul mécanisme qui règle à la fois la
   fuite de la solution et le message. Le joueur règle son filtre sur la période étiquetée après T0, l'applique
   avant T0, puis remonte la durée d'incubation. Apprendre là où l'on sait, appliquer là où l'on ne sait pas :
   c'est exactement ce que le jeu doit montrer. B apporte le fait le plus grave : P0925 est suivi de 25 infectés
   dès le lendemain, ce qui est incompatible avec l'incubation. L'étape 1 de E corrige ce défaut.
2. Le plus gros angle mort : D. Son regard de novice est utile (objectif dès le premier écran, jargon remplacé).
   Mais elle met les données en dernier, alors que l'énigme est fausse (voir B) et que des données absurdes sont
   justement l'enjeu déclaré. On rendrait plus facile l'accès à une réponse incorrecte. C, elle, alourdit le
   chantier (étiquettes d'IA simulées, niveaux, scénarios rejouables) pour un développeur seul.
3. Ce que tous ont manqué : le cadre éthique et réglementaire. Vanter « l'intérêt des données de santé » auprès
   de soignants sans parler de secret médical, de pseudonymisation ni d'accès encadré (CNIL, entrepôts de données
   de santé) donne un message unilatéral. Personne ne distingue non plus cas index et patient zéro. Le premier
   cas détecté n'est pas forcément le premier infecté, et c'est une leçon à transmettre.

### Relecteur 2

1. La plus forte : E. Elle remonte à la cause : il n'existe aucun scénario de référence, donc la courbe, le
   récit et les données se contredisent. Elle demande de l'écrire et de le faire relire par un soignant.
   Surtout, elle transforme la fuite en mécanique de jeu : régler le filtre après T0, où le diagnostic sert
   d'étiquette, puis l'appliquer avant T0 et remonter l'incubation. C'est la seule qui rende « IA » honnête sans
   ajouter de fonction. B la complète par une preuve vérifiée : environ 25 infectés apparaissent dès le
   lendemain de P0925, donc l'énigme est fausse.
2. Plus grand angle mort : D. Elle met les données en dernier alors que l'énigme contredit l'incubation.
   Clarifier le vocabulaire d'un jeu dont la réponse est fausse produit exactement l'effet redouté. C, elle,
   oublie le budget d'un développeur seul (scénarios rejouables, trois niveaux, étiquettes IA).
3. Ce que tous ont manqué : le versant « données de santé » du message. Personne ne parle de secret médical, de
   pseudonymisation, de RGPD ni d'entrepôt encadré. Or un soignant doit repartir en sachant à quelles conditions
   ces données sont utilisables. Personne ne remet non plus en cause l'objectif « trouver le coupable » : la
   notion de patient zéro est stigmatisante (cf. VIH). Mieux vaut viser la détection précoce et la chaîne de
   transmission.

### Relecteur 3

1. La plus forte : E. Elle trouve la cause : il n'existe pas de scénario de référence, donc la courbe, le récit
   et les données se contredisent. Elle propose aussi la seule idée qui règle à la fois la fuite et le faux
   « IA » : régler le filtre texte sur la période après T0, où le diagnostic sert d'étiquette, puis l'appliquer
   avant T0. C'est la logique réelle de l'IA en santé. B apporte le fait le plus grave : l'incubation est
   impossible autour de P0925, et on gagne avec seulement « température ≥ 40 » et un tri par date. La chaîne de
   contamination écrite de E corrige ce défaut dès la conception.
2. Plus grand angle mort : D. Son regard de novice est précieux, mais elle met les données en dernier. Le
   tutoriel et l'interface seraient alors construits sur une énigme incohérente, ce qui est justement le risque
   annoncé. C en fait trop pour un développeur seul : IA calculée à l'avance, plusieurs scénarios, trois
   niveaux.
3. Ce que tous ont oublié : personne ne fixe d'abord ce que l'infirmier doit retenir, en deux ou trois objectifs
   vérifiables, ni le débriefing qui les ancre. Or le message porte aussi sur les données de santé :
   pseudonymisation, confidentialité, cadre d'un entrepôt de données (CNIL), biais de codage. Sans cela, le jeu
   enseigne qu'« fouiller des CR, c'est facile ». Autre oubli : 2 Mo de JSON à charger sur un téléphone en 4G.

### Relecteur 4

1. La plus solide : E. Elle donne la cause commune des défauts : il n'existe aucun scénario de référence, donc
   la courbe, le récit et les données se contredisent. Elle fixe un ordre logique. Surtout, c'est la seule à
   proposer un déroulé qui règle à la fois la fuite et le message : régler son filtre sur la période après T0,
   où le diagnostic sert d'étiquette, puis l'appliquer avant T0 et remonter l'incubation. C'est la vraie logique
   de l'apprentissage supervisé. Il faut y ajouter le constat de B, le plus grave de tous : environ 25 infectés
   apparaissent avant que P0925 ait pu contaminer qui que ce soit, et la température seule suffit à résoudre
   l'énigme.
2. Le plus gros angle mort : D. Elle se met bien à la place du joueur, mais elle traite les données en dernier
   alors que l'énigme est incohérente. On peaufinerait un tutoriel qui mène à une réponse fausse. C alourdit
   aussi le chantier pour un développeur seul : étiquettes « IA » fabriquées, scénarios multiples, niveaux de
   difficulté.
3. Ce que tous oublient : le cadre légal des données de santé. Si l'on montre leur intérêt sans parler de
   pseudonymisation, d'accès encadré (CNIL, entrepôt de données) ni de secret médical, les soignants retiendront
   qu'on fouille librement les comptes rendus. Personne ne parle non plus du poids de data.json (2 Mo) à charger
   sur téléphone en Wi-Fi hospitalier, ni d'une façon de mesurer ce que les infirmiers ont retenu.

### Relecteur 5

1. La plus solide : E. C'est la seule réponse qui part de la cause commune à toutes les incohérences. Il
   n'existe aucun scénario de référence écrit, donc la courbe, le récit et les données se contredisent. E
   propose de l'écrire, de le faire relire par un soignant, puis de le générer avec un script. Elle trouve aussi
   l'idée pédagogique la plus juste : régler le filtre après T0, sur la période où le diagnostic sert
   d'étiquette, puis l'appliquer avant T0. C'est la vraie logique de l'IA en santé, et la fuite de la solution
   disparaît d'elle-même. B est juste derrière : elle a vérifié l'incubation dans data.json et montré que la
   température seule résout le jeu. Le scénario écrit d'E règle ce problème.
2. Le plus grand angle mort : D. Elle met les données en dernier, alors que l'enjeu est précisément que les
   données absurdes retournent le message. D aurait fait polir l'interface d'une énigme dont la réponse attendue
   est fausse, comme B l'a montré avec l'incubation. Il y a un risque secondaire chez C : niveaux de difficulté,
   étiquettes d'IA et scénarios rejouables, c'est trop de travail pour un développeur seul.
3. Ce que tous ont manqué : le jeu consiste à identifier une personne dans des dossiers médicaux. C'est
   exactement ce que la recherche sur les données de santé s'interdit : pseudonymisation, encadrement CNIL,
   entrepôts de données de santé. De plus, la notion de « patient zéro » est discutée en épidémiologie et
   stigmatisante (cas de Gaëtan Dugas). Il faut un débriefing qui en parle. Sinon, des infirmiers peuvent
   retenir qu'avec l'IA, on fouille librement les comptes rendus pour retrouver quelqu'un.

## 6. Synthèse du président

Le président a reçu les réponses nominatives, les relectures et les vérifications de l'animateur (section 2).

### Où le council est d'accord

- **Il manque un script générateur, et c'est la cause commune des problèmes.** Quatre conseillers sur cinq le
  disent. La courbe, le récit, les données et les messages ont été faits chacun de son côté, donc ils se
  contredisent. Corriger data.json à la main ferait revenir les mêmes erreurs.
- **L'énigme est fausse.** L'animateur l'a vérifié. Hors P0925, 24 patients (42 visites) sont infectés avant le
  31/03, le premier dès le 18/03, et un seul parle de Karovia. Avec une incubation de 2 à 4 semaines, P0925 ne
  peut pas être à l'origine de ces cas. Un infirmier attentif s'en apercevra.
- **Le jeu donne la réponse.** Le champ « infected » est envoyé au navigateur, le bandeau compte les infectés en
  direct et le message d'erreur souffle la règle. Même l'Œil extérieur demande : comment le logiciel sait-il qui
  est infecté ?
- **Ce n'est pas encore de l'IA.** C'est une recherche par mots-clés. Il faut le dire, et montrer où elle échoue
  (négations, synonymes).
- **Le tutoriel doit se jouer, pas se lire.** Ce doit être une mission guidée sur les vraies données.
- **Pas de refonte lourde.** Ni React ni serveur. Pour le téléphone, une meta viewport et une media query
  suffisent au début. Il faut garder les fautes de frappe, qui sont le bruit utile, et supprimer les absurdités
  cliniques.

Une correction : selon le Contradicteur, « T ≥ 40 puis tri par date » donne la réponse. C'est faux, car les 8
premières visites à T ≥ 40 sont des non-infectés. En revanche, avec T ≥ 40 et « Karovia », P0925 arrive en 3e
position. Le jeu est donc trop facile, mais pas trivial.

### Où le council diverge

- **L'ordre.** L'Œil extérieur veut d'abord l'objectif et le vocabulaire, et les données en dernier. Les autres
  veulent d'abord le générateur. Chacun a raison sur son terrain : reprendre les textes coûte une soirée et ne
  sera pas perdu, mais un tutoriel bâti sur une énigme fausse sera à réécrire.
- **Précision et rappel.** Trois avis s'opposent :
  - les retirer (Contradicteur, Exécutant, Œil extérieur) ;
  - les garder sur un échantillon annoté (Expansionniste) ;
  - les calculer par rapport au diagnostic, après T0 (Premiers principes).

  Cette dernière option règle le débat : la mesure devient honnête, car elle repose sur une étiquette que le
  joueur voit aussi.
- **Un vrai modèle d'IA.** L'Expansionniste veut des étiquettes calculées à l'avance par un modèle. Le
  Contradicteur préfère assumer les mots-clés. Pour un développeur seul, la démarche « régler le filtre après
  T0, l'appliquer avant » montre déjà le principe de l'apprentissage supervisé, sans modèle. Le classifieur peut
  attendre.
- **Plusieurs tables.** Le Contradicteur juge qu'une seule table suffit, alors que Pierre veut les voir. Trois
  tables simples, reliées par l'identifiant patient et sans jointure à faire par le joueur, satisfont les deux.

### Angles morts relevés par la relecture

- **Le cadre des données de santé est absent** : secret médical, pseudonymisation, RGPD, CNIL, entrepôts de
  données encadrés. Les cinq relecteurs l'ont noté. Le jeu consiste à identifier une personne dans des dossiers
  médicaux, ce que la recherche s'interdit. Sans débriefing, il apprend que fouiller des CR est facile et sans
  conséquence.
- **« Patient zéro » est une notion stigmatisante** (Gaëtan Dugas et le VIH). Il faut aussi distinguer le cas
  index (premier cas détecté) du patient zéro (premier infecté). C'est une leçon en soi.
- **Aucun objectif pédagogique n'est écrit.** Il n'y a ni débriefing, ni moyen de mesurer ce que les infirmiers
  ont retenu.
- **Le poids** : 2 Mo de JSON sur un téléphone en 4G ou sur le Wi-Fi de l'hôpital.
- **Les biais de codage des diagnostics** ne sont jamais évoqués.

### La recommandation

D'abord une source de vérité, ensuite l'interface.

**Étape 1 : une page de scénario.** Elle fixe la date d'arrivée du virus, une chaîne de transmission qui
respecte l'incubation, quelques pour cent de malades et une vraie vague. Elle donne aussi 2 ou 3 objectifs
pédagogiques et le contenu du débriefing. La faire relire par un soignant.

**Étape 2 : une soirée de correctifs sans regret (demande 1, première partie).** Possible en parallèle de
l'étape 1.
- Ajouter la meta viewport et une media query qui empile la grille et les cartes sous 700 px.
- Écrire l'objectif dès le premier écran, et expliquer T0 et 1975 en une phrase.
- Remplacer le jargon : « NLP » devient « recherche dans le texte », « Groupe » devient « dans la même phrase »,
  « Exclure » devient « ne doit pas contenir ».
- Retirer l'indice du message d'erreur, le bandeau précision/rappel et le compteur d'infectés.
- Vérifier la réponse par un hachage.

**Étape 3 : des données propres (demande 2).** Un script generer.py, avec une graine fixe, produit trois
tables : patients, visites (diagnostic, T°, PAS et FC en colonnes) et CR.
- Le même CHU figure dans l'en-tête et dans la colonne, et chaque patient garde son CHU.
- L'issue dépend de la gravité.
- Du bruit : des infectés sans tous les symptômes, des non-infectés fiévreux, plus de 51 phrases-gabarits, et
  les fautes conservées.
- Le diagnostic du patient zéro n'est plus unique.
- Le champ « infected » ne part plus au navigateur.
- La courbe est tracée dans le navigateur à partir des données, et courbe.png disparaît.
- Le fichier est allégé.

**Étape 4 : les tables et leur nombre de lignes (demande 4).**
- Un onglet par table, avec son nombre de lignes.
- Les filtres s'appliquent un par un et affichent l'entonnoir, par exemple « visites : 1921 → 412 → 87 ».
- Sur téléphone, l'entonnoir s'empile verticalement.
- Précision et rappel reviennent à cette étape, calculés par rapport au diagnostic, après T0.

**Étape 5 : le tutoriel (demande 3).** Un niveau 0 dans le vrai terminal, en 4 missions avec une réponse
chiffrée à chaque fois :
1. chercher « plaques rouges » ;
2. tomber sur le piège « absence de plaques rouges » ;
3. utiliser « dans la même phrase » ;
4. régler son filtre après T0, l'appliquer avant, puis remonter le temps d'incubation.

Il se termine par un écran de débriefing : « ce que vous venez de faire s'appelle… », les limites des
mots-clés, la pseudonymisation et la CNIL, la différence entre cas index et patient zéro.

**Étape 6 : le test (demande 1, fin).** Deux infirmiers jouent sur leur téléphone, dix minutes, sans aide. Ne
retoucher l'interface mobile qu'après les avoir regardés jouer.

Pour plus tard seulement : un classifieur calculé à l'avance, des scénarios rejouables, des niveaux de
difficulté.

### La première chose à faire

Écrire la page de scénario. Elle dit comment le virus est arrivé, qui a contaminé qui et quand, en respectant 2
à 4 semaines d'incubation, et ce que l'infirmier doit avoir appris à la fin. Le générateur, le tutoriel et
l'interface en découlent.
