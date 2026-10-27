# Scénario de référence

Ce document décrit ce qui s'est « réellement » passé dans le jeu. Le générateur (`generateur/generer.py`) le
traduit en données ; si les deux divergent, c'est ce document qui fait foi et le générateur qu'il faut corriger.

L'identifiant du patient zéro n'y figure pas : il est tiré par le générateur et écrit dans `docs/solution.md`,
qui n'est pas versionné (le dépôt est public).

## L'histoire en bref

- **Février 1975** : une épidémie de Nova-virus frappe la Karovia, pays fictif.
- **Vers le 2 mars** : un homme de 42 ans, habitant Bordeaux, séjourne en Karovia pour son travail et y attrape
  le virus.
- **8 mars** : il rentre à Bordeaux. Il ne ressent rien : c'est l'incubation.
- **18 mars** : premiers signes. **19 mars** : il consulte aux urgences du CHU Bordeaux. Le compte rendu note
  40,6 °C, des PRD, des ROT abolis et le retour de Karovia. Personne ne connaît la maladie : diagnostic
  « syndrome fébrile éruptif », retour à domicile.
- **24 mars** : il revient, plus grave, et il est hospitalisé.
- **18 au 24 mars** : il contamine 3 ou 4 proches (famille, collègues) à Bordeaux. Ils tombent malades 2 à 4
  semaines plus tard, début à fin avril.
- **Avril** : le virus gagne d'autres villes par les déplacements (4 contaminations sur 10 se font en voyage).
- **5 mai 1975 (T0)** : un test fiable est validé au CHU Bordeaux, où sont la plupart des malades. Les autres CHU
  le reçoivent plus tard : Paris le 19 mai, Lyon le 23, Lille le 28, Nantes le 2 juin, Marseille le 6, Toulouse
  le 11. Les malades qui consultent après l'arrivée du test dans leur CHU reçoivent le diagnostic « Nova-virus
  (test positif) » ; les autres repartent sans diagnostic. Au moins un quart des malades n'ont jamais le test.
- **19 mai** : mesures d'isolement ; la transmission ralentit, la vague culmine puis décroît en juin.
- **30 juin** : fin des données.

## Le virus

| | |
|---|---|
| Signes | Les trois ensemble : fièvre supérieure à 40 °C, plaques rouges douloureuses, réflexe rotulien aboli |
| Incubation | 14 à 28 jours entre la contamination et les premiers signes |
| Contagiosité | Pendant les 7 jours qui suivent les premiers signes |
| Gravité | Les malades vont toujours aux urgences dans les 2 jours ; beaucoup sont hospitalisés |

Seuls les malades réunissent les trois signes. Des non-malades en ont un ou deux (grippe à 40 °C, érysipèle,
toxidermie, diabétique ou alcoolique avec un réflexe aboli), jamais les trois. Une soixantaine en ont deux (voir
les leurres) : chacun des trois signes est nécessaire pour les écarter.

## Les données

Trois tables, reliées par les identifiants :

| Table | Une ligne par | Colonnes |
|---|---|---|
| Patients | patient | id_patient, sexe, âge, ville |
| Visites | passage aux urgences | id_visite, id_patient, date, hôpital, T°C, PAS, FC, diagnostic, issue |
| Comptes rendus | visite (1 pour 1) | id_visite, médecin, anamnèse |

- Période : du 1er mars au 30 juin 1975, 7 CHU (Bordeaux, Paris, Lyon, Lille, Nantes, Marseille, Toulouse).
- Un patient consulte toujours dans le CHU de sa ville ; ses visites sont espacées de 1 à 10 jours.
- L'en-tête du compte rendu (hôpital, patient, date, constantes) est affiché à partir de la table Visites :
  il ne peut pas la contredire.
- L'issue dépend de la gravité : les malades sont souvent hospitalisés ou transférés en réanimation.
- Le test Nova vaut « non disponible » avant l'arrivée du test dans le CHU, puis « positif » pour les malades,
  « négatif » pour les autres patients fébriles (38,5 °C ou plus) ou qui ont une éruption, et « non fait » sinon.
- Environ 1 150 patients et 1 700 visites, dont 120 à 260 malades.

## Règles de rédaction des comptes rendus

Chaque phrase de l'anamnèse se termine par un point, et les décimales s'écrivent avec une virgule (40,6 °C) :
le découpage en phrases est donc sans ambiguïté.

| Signe | Formes affirmées (3 façons de l'écrire) | Formes niées ou normales |
|---|---|---|
| Plaques rouges douloureuses | « plaques rouges douloureuses », « PRD », « plaques rouges dlr » | « Pas de PRD », « Absence de plaques rouges douloureuses »… |
| Réflexe rotulien aboli | « réflexe rotulien aboli », « absence de réflexe rotulien », « ROT abolis » | « Réflexe rotulien présent », « ROT présents et symétriques » |
| Fièvre | La température est dans la table Visites | |

- Une phrase qui affirme un signe ne contient jamais de négation.
- Les négations des plaques n'utilisent que « Pas de » et « Absence de ».
- Les autres éruptions sont décrites autrement (« plaques rouges non douloureuses », « urticaire diffuse ») : elles
  ne répondent pas à la recherche des formes affirmées.
- Seul le patient zéro, parmi les malades, mentionne la Karovia. D'autres patients, non malades, en reviennent
  aussi.
- Les non-malades qui ont un des signes l'écrivent avec les mêmes formes que les malades (« PRD de la jambe
  gauche » pour un érysipèle, « ROT abolis aux deux genoux » chez un diabétique).
- Le compte rendu du patient zéro emploie les abréviations « PRD » et « ROT abolis » : une recherche qui oublie
  les synonymes passe à côté de lui. Le moteur trouve les débuts de mots (« ROT » trouve aussi « rotulien »), mais
  « réflexe rotulien aboli » ne trouve pas « ROT abolis », et « plaques rouges douloureuses » ne trouve pas « PRD ».

## Leurres

| Leurre | Date | Ce qui piège |
|---|---|---|
| Voyageur de Karovia atteint de paludisme | 11 mars | 40,3 °C, Karovia, « Pas de PRD » : piège de la négation |
| Toxidermie | 14 mars | 40,4 °C et plaques rouges douloureuses, mais réflexe présent : piège des signes incomplets |
| Vascularite | 16 mars | Plaques et réflexe aboli, mais 38,9 °C : piège des signes incomplets |
| Autres voyageurs de Karovia | mars à juin | Karovia sans le virus : piège du voyage seul |
| 20 érysipèles chez des patients neuropathes | mars à juin | Plaques et réflexe aboli, mais 38,5 à 39,8 °C |
| 20 érysipèles ou toxidermies | mars à juin | 40,1 à 40,8 °C et plaques, mais réflexe présent ou non examiné |
| 20 pyélonéphrites ou pneumopathies chez des patients neuropathes | mars à juin | 40,1 à 40,8 °C et réflexe aboli, mais pas de plaques (parfois « Pas de PRD ») |

Avec deux critères sur trois, la sélection garde tous les malades et une vingtaine de non-malades : l'entonnoir
affiche une spécificité inférieure à 100 % tant qu'un critère manque. Ces leurres sont tirés à part par le
générateur : les régler ne change pas le reste des données.

## Objectifs pédagogiques

À la fin du jeu, l'infirmier doit savoir :

1. lire un entonnoir : chaque filtre sur les données structurées réduit le nombre de lignes d'une table ;
2. chercher dans du texte libre en prévoyant les synonymes, les abréviations et les négations ;
3. raisonner dans le temps : le test date du 5 mai, mais le virus circulait avant ; il faut remonter
   l'incubation ;
4. se méfier des étiquettes : le test et le diagnostic ne couvrent pas tous les malades, les signes notés dans les
   comptes rendus si.

## Méthode proposée aux joueurs

1. Repérer tous les malades : une sélection dont la sensibilité et la spécificité approchent 100 %. L'entonnoir
   les affiche à chaque étape, calculées sur les visites (malade = patient atteint du Nova-virus). Question
   bonus : combien de patients sont atteints ?
2. Trouver le patient zéro : parmi les malades, ce qui le distingue des autres.
3. Vérifier ses comptes rendus avant de proposer.

## Missions d'entraînement

Les 5 missions apprennent les outils sur des sujets sans rapport avec le virus : filtrer (CHU Lille en avril),
distinguer visites et patients, chercher un mot (« chute »), regrouper des synonymes (« courbatures » ou
« myalgies »), écarter une négation dans la même phrase (« douleur thoracique » sans « Pas de douleur
thoracique »). Elles ne donnent aucune piste : le joueur doit lui-même tirer de la fiche du virus et de
l'histoire ce qu'il faut chercher. Les phrases « Pas de douleur thoracique » sont tirées à part par le
générateur, sans modifier le reste des données.

## Chemin de solution attendu

1. La courbe montre des cas dès la semaine du 5 mai : l'épidémie a commencé avant le test.
2. Le joueur cherche les visites qui réunissent les trois signes : température ≥ 40 °C, plaques rouges
   douloureuses (avec les synonymes, sans les négations), réflexe rotulien aboli (avec les synonymes).
   Cette sélection garde exactement les malades (100 % et 100 %) : son nombre de patients répond à la question
   bonus.
3. Il trie par date : la visite la plus ancienne est celle du patient zéro, le 19 mars au CHU Bordeaux. Son
   compte rendu mentionne le retour de Karovia, ce qui confirme l'importation.

Réponses du jeu à la question bonus :

| Réponse | Message |
|---|---|
| Le nombre de patients malades | « Bravo ! … » |
| Le nombre de visites des malades | Un malade peut venir plusieurs fois : compter les patients |
| Un autre nombre, sélection parfaite | Lire le nombre de patients dans l'entonnoir |
| Un autre nombre, sélection incomplète | Viser 100 % de sensibilité et de spécificité, puis compter les patients |

Réponses du jeu à une proposition :

| Proposition | Réponse |
|---|---|
| Le patient zéro | Victoire, et le bilan raconte l'histoire |
| Un autre malade | « … a bien le Nova-virus, mais ce n'est pas ce patient qui l'a ramené en France » |
| Un non-malade | « … n'a pas le Nova-virus » |
| Un identifiant inconnu | « … n'existe pas dans la table Patients » |

Les réponses disent si la proposition est juste, sans indiquer la méthode.

Le bilan (histoire et lexique) est chiffré deux fois : avec l'identifiant du patient zéro, et avec le mot de
passe animateur choisi au lancement du générateur.

## Hors champ (décision de Pierre du 23/10/2026)

Le jeu ne cherche pas à discuter : ce qui relève ou non de l'IA, la notion de patient zéro, le cadre
réglementaire des données de santé, ni le réalisme statistique du signal (les trois signes séparent
parfaitement malades et non-malades, et c'est voulu).
