# Patient Zéro

Jeu d'enquête pour des infirmiers novices en données de santé : retrouver, dans les dossiers des urgences de 1975,
le patient qui a ramené en France un virus fictif, le Nova-virus.

Le joueur filtre une table de visites, cherche dans le texte libre des comptes rendus (synonymes, abréviations,
négations) et suit dans un entonnoir le nombre de lignes qui restent après chaque filtre.

## Jouer

- En ligne : https://pgwwj1.github.io/jeu-patient-zero/
- Hors ligne : ouvrir `index.html` dans un navigateur. Aucun serveur n'est nécessaire.

Le jeu a trois pages :

1. **L'affaire** : la mission, l'histoire, la fiche du virus, la courbe des cas détectés et le schéma des trois
   tables.
2. **L'enquête** : 4 missions d'entraînement guidées, puis l'enquête libre. Filtres sur la table Visites,
   recherches dans les comptes rendus, entonnoir, onglets Comptes rendus / Visites / Patients, et la case pour
   proposer le patient zéro.
3. **Le bilan** : l'histoire complète, qui ne se déchiffre qu'avec la bonne réponse, et ce que le joueur a appris.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `style.css` | Pages du jeu |
| `js/recherche.js` | Moteur de recherche dans le texte (normalisation, mots entiers, phrases, surlignage) |
| `js/enquete.js` | Logique sans affichage : tables, filtres, entonnoir, missions, vérification de la réponse |
| `js/jeu.js` | Affichage et interactions |
| `donnees.js` | Les trois tables, produites par le générateur (ne pas modifier à la main) |
| `generateur/generer.py` | Générateur des données, à partir du scénario |
| `docs/scenario.md` | Ce qui s'est « réellement » passé : la référence du générateur |
| `tests/tests.html` | Tests du moteur et des données |

## Modifier les données

Le scénario fait foi : modifier d'abord `docs/scenario.md`, puis le générateur, puis relancer :

```
python generateur/generer.py
```

Le générateur est déterministe (graine fixe) et s'arrête avec un message si le scénario n'est pas respecté :
solution unique, incubation, leurres, cohérence des tables, forme de la vague. Il écrit aussi
`docs/solution.md` (la solution et les réponses des missions, pour l'animateur) et `tests/attendu.js`.

## Tester

Après le générateur, ouvrir `tests/tests.html` dans un navigateur. La page doit afficher « OK : 39 tests ».

Les tests confrontent le moteur de recherche à ce que le générateur a écrit dans chaque compte rendu. Ils
vérifient aussi que la solution est unique et que les trois pièges (négation, signes incomplets, synonymes)
mènent à un message d'erreur clair.

## Dépôt public

Le dépôt est public et servi par GitHub Pages. La solution n'est jamais en clair dans les fichiers publiés : le
jeu ne contient que des empreintes SHA-256 des identifiants, et le bilan est chiffré avec l'identifiant du
patient zéro. `docs/solution.md` et `tests/attendu.js` sont exclus de git. En revanche, `docs/scenario.md` et le
générateur racontent l'histoire : un joueur qui les lirait sur GitHub trouverait la réponse.
