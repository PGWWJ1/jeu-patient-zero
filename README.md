# Patient Zéro

Jeu d'enquête pour des infirmiers novices en données de santé : retrouver, dans les dossiers des urgences de 1975,
le patient qui a ramené en France un virus fictif, le Nova-virus.

Le joueur filtre une table de visites, cherche dans le texte libre des comptes rendus (synonymes, abréviations,
négations) et suit dans un entonnoir le nombre de lignes qui restent après chaque filtre. Le test du virus n'arrive
que tard dans certains CHU : pour retrouver tous les malades, il faut leurs signes, pas leur diagnostic.

## Jouer

- En ligne : https://pgwwj1.github.io/jeu-patient-zero/
- Hors ligne : ouvrir `index.html` dans un navigateur. Aucun serveur n'est nécessaire.

Le jeu a trois pages :

1. **L'affaire** : la mission, l'histoire, la fiche du virus, la méthode en trois étapes, la courbe des cas
   détectés et le schéma des trois tables.
2. **L'enquête** : 5 missions d'entraînement qui apprennent les outils sur d'autres sujets (chutes, courbatures,
   douleurs thoraciques), sans piste sur le virus, puis l'enquête libre. Filtres sur la table Visites et
   recherches dans les comptes rendus (un terme trouve aussi les mots qui commencent par lui : « ROT » trouve
   « rotulien »), pris en compte au clic sur « Appliquer les filtres » (ou avec la touche Entrée). Entonnoir :
   chaque étape a un numéro et une couleur, avec la sensibilité et la spécificité de la sélection (par rapport
   aux visites des malades). Onglets : Comptes rendus (la sélection), « Non sélectionnés à l'étape X » (les
   comptes rendus que cette étape a écartés, sur le fond de sa couleur), Visites et Patients. Puis la question
   bonus (combien de patients sont atteints ?) et la case pour proposer le patient zéro.
3. **Le bilan** : l'histoire complète et ce que le joueur a appris. Il est chiffré : il s'ouvre avec la bonne
   réponse, ou avec le mot de passe animateur (« Accès animateur »).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `style.css` | Pages du jeu |
| `js/recherche.js` | Moteur de recherche dans le texte (normalisation, débuts de mots, phrases, surlignage) |
| `js/enquete.js` | Logique sans affichage : tables, filtres, entonnoir, missions, vérification des réponses |
| `js/jeu.js` | Affichage et interactions |
| `donnees.js` | Les trois tables, produites par le générateur (ne pas modifier à la main) |
| `generateur/generer.py` | Générateur des données, à partir du scénario |
| `generateur/versions.py` | Numéros de version des fichiers dans `index.html`, contre le cache des navigateurs |
| `docs/scenario.md` | Ce qui s'est « réellement » passé : la référence du générateur |
| `tests/tests.html` | Tests du moteur et des données |

## Modifier les données

Le scénario fait foi : modifier d'abord `docs/scenario.md`, puis le générateur, puis relancer :

```
python generateur/generer.py
```

Le script demande le mot de passe animateur (saisie masquée, deux fois). Il n'est enregistré nulle part : il
sert seulement à chiffrer le bilan dans `donnees.js`. Pour changer de mot de passe, relancer le générateur.

Le générateur est déterministe (graine fixe) et s'arrête avec un message si le scénario n'est pas respecté :
solution unique, incubation, leurres (dont au moins 10 non-malades par paire de signes), part des malades sans
test, cohérence des tables, forme de la vague. Il écrit aussi `docs/solution.md` (la solution, la réponse de la
question bonus et celles des missions, pour l'animateur) et `tests/attendu.js`.

## Publier une modification

`index.html` charge chaque fichier avec un numéro tiré de son contenu (`donnees.js?v=1b543ebb`) : quand un
fichier change, son adresse change, et les navigateurs téléchargent la nouvelle version au lieu de garder
l'ancienne en cache. Le générateur met ces numéros à jour ; après une modification du code (`style.css`, `js/`),
lancer avant de publier :

```
python generateur/versions.py
```

GitHub Pages met ensuite quelques minutes à servir la nouvelle version.

## Tester

Après le générateur, ouvrir `tests/tests.html` dans un navigateur. La page doit afficher « OK : 64 tests ».

Les tests confrontent le moteur de recherche à ce que le générateur a écrit dans chaque compte rendu. Ils
vérifient aussi que la solution est unique, que les trois pièges (négation, signes incomplets, synonymes)
mènent à une mauvaise réponse, que deux signes sur trois laissent toujours des non-malades, que le test ne
trouve pas tous les malades, les comptes rendus non sélectionnés à chaque étape de l'entonnoir, les réponses de
la question bonus, et qu'aucune mission d'entraînement ne donne de piste sur le virus.

## Dépôt public

Le dépôt est public et servi par GitHub Pages. La solution n'est jamais en clair dans les fichiers publiés : le
jeu ne contient que des empreintes SHA-256 des identifiants, et le bilan est chiffré avec l'identifiant du
patient zéro. La liste des empreintes des malades est complétée par des empreintes qui ne correspondent à aucun
patient : sa longueur ne donne pas la réponse de la question bonus. `docs/solution.md` et `tests/attendu.js` sont
exclus de git. En revanche, `docs/scenario.md` et le
générateur racontent l'histoire : un joueur qui les lirait sur GitHub trouverait la réponse.
