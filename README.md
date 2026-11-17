# NAND Lycée – Guide enseignant

Jeu web pour comprendre comment un ordinateur est fait, **en partant d'une seule porte logique, la porte NAND**. L'élève assemble des circuits sur un plan de travail, les teste, et chaque circuit réussi devient un composant réutilisable dans les niveaux suivants. De la porte NON jusqu'à une UAL 4 bits et une mémoire.

Aucun compte, aucune installation, aucune donnée envoyée : tout fonctionne dans le navigateur de l'élève.

---

## 1. En bref

| | |
|---|---|
| **Public** | Lycée (spécialité NSI en priorité, option possible en SNT ou en enseignement scientifique pour les premiers niveaux) |
| **Durée** | Séances de 30 à 60 min ; le parcours complet représente plusieurs séances (voir § 3) |
| **Matériel** | Un ordinateur (ou tablette) avec un navigateur récent, par élève ou par binôme |
| **Connexion** | Non nécessaire une fois la page chargée |
| **Évaluation** | Le test intégré valide automatiquement chaque niveau (tous les cas de la table de vérité, ou une séquence pour les mémoires) |

### Accès

- **En ligne** : l'adresse GitHub Pages du dépôt (voir § 6).
- **Hors ligne** : copier le dossier sur les postes et ouvrir `index.html` dans le navigateur. Aucun serveur n'est requis.

---

## 2. Objectifs pédagogiques

À la fin du parcours, l'élève a **construit lui-même** :

- les opérateurs booléens usuels (NON, ET, OU, OU exclusif) à partir de NAND ;
- des circuits combinatoires d'aiguillage (multiplexeur, décodeur) ;
- l'addition binaire (demi-additionneur, additionneur complet, additionneur 4 bits) ;
- une cellule de mémoire (verrou RS, verrou D, bascule D synchronisée par une horloge) ;
- une unité arithmétique et logique (addition, soustraction, ET, OU, drapeau « zéro »).

Notions travaillées en transversal : tables de vérité, lois de De Morgan, représentation binaire, complément à deux (soustraction), retenue, **bouclage et mémoire** (la différence entre circuit combinatoire et circuit séquentiel), horloge et synchronisation, **abstraction** (réutiliser un composant sans repenser à son contenu) et **optimisation** (compteur de portes NAND).

> **Positionnement par rapport au programme.** Les portes logiques, le binaire et le modèle d'architecture de von Neumann relèvent du programme de NSI. La construction complète d'une UAL ou d'une mémoire à partir de NAND va **au-delà de ce qui est exigible** : elle est pensée comme une activité d'approfondissement guidée. Il vous revient de vérifier la correspondance avec le programme officiel en vigueur et de choisir jusqu'où aller avec votre classe.

---

## 3. Parcours et niveaux

Les niveaux se débloquent **dans l'ordre** : il faut réussir un niveau pour accéder au suivant. Le nombre de NAND ci-dessous est celui de la solution de référence ; les élèves peuvent faire mieux ou moins bien.

| # | Partie | Niveau | Ce que l'élève doit trouver | NAND (réf.) |
|---|---|---|---|---|
| 1 | Logique de base | NON | Relier les deux entrées d'un NAND | 1 |
| 2 | Logique de base | ET | Inverser la sortie d'un NAND | 2 |
| 3 | Logique de base | OU | Loi de De Morgan | 3 |
| 4 | Logique de base | OU exclusif | Astuce à 4 NAND | 4 |
| 5 | Aiguillage | Multiplexeur | Choisir une entrée selon un signal de sélection | 8 |
| 6 | Aiguillage | Décodeur 2 → 4 | Une seule sortie active selon une adresse | 10 |
| 7 | Arithmétique | Demi-additionneur | Somme = XOR, retenue = ET | 6 |
| 8 | Arithmétique | Additionneur complet | Chaîner deux demi-additionneurs | 15 |
| 9 | Arithmétique | Additionneur 4 bits | Propagation de la retenue | 60 |
| 10 | Mémoire | Verrou RS | Premier **bouclage** : deux NAND croisés | 2 |
| 11 | Mémoire | Verrou D | Une seule donnée + un signal d'autorisation | 5 |
| 12 | Mémoire | Bascule D (front montant) | Maître-esclave, notion d'horloge | 11 |
| 13 | UAL (défi) | UAL 1 bit | Soustraction par complément + choix de l'opération | 40 |
| 14 | UAL (défi) | Détecteur de zéro | Grand OU puis inversion | 10 |
| 15 | UAL (défi) | UAL 4 bits | Assemblage de 4 UAL 1 bit + drapeau Z | 170 |

### Repères de durée (estimations, à ajuster à votre classe)

Ces durées sont indicatives, je ne les ai pas mesurées avec des élèves :

- **Niveaux 1 à 4** : une séance, en autonomie.
- **Niveaux 5 à 9** : une à deux séances. L'additionneur 4 bits demande de la patience de câblage.
- **Niveaux 10 à 12** : une séance, avec une explication préalable au tableau sur le bouclage (le verrou RS surprend).
- **Niveaux 13 à 15** : prolongement pour élèves avancés ou projet en binôme ; l'UAL 4 bits (170 NAND, une soixantaine de fils) est surtout un travail d'assemblage.

### Découpages possibles

- **Découverte (1 séance)** : niveaux 1 à 4.
- **Arithmétique binaire (2 séances)** : niveaux 1 à 9.
- **Parcours complet « de la porte à la mémoire »** : niveaux 1 à 12.
- **Défi** : niveaux 13 à 15 pour les plus rapides.

---

## 4. Utilisation en classe

### Pour l'élève

- **Ajouter un composant** : clic sur un composant de la barre « Composants ».
- **Relier** : glisser d'une sortie (à droite) vers une entrée (à gauche). Une sortie peut alimenter plusieurs entrées.
- **Nœud de dérivation** : double-clic sur un fil pour y insérer un nœud, d'où l'on peut tirer d'autres fils.
- **Tester à la main** : basculer les interrupteurs d'entrée ; un fil **épais orange** porte un 1, un fil **fin gris** porte un 0 ; la ligne courante est surlignée dans la table de vérité.
- **Valider** : « Tester le circuit ». Les cas faux sont signalés avec la valeur attendue.
- **Aides intégrées** : rappel de cours et indices progressifs à chaque niveau.
- **Annuler** : Ctrl+Z (ou Cmd+Z). **Supprimer** : touche Suppr.
- **Tracé des fils** (liste en haut à droite du plan) : « Angles droits » (contourne les composants) ou « Courbes ».

### Pistes d'animation

1. **Avant le niveau 1** : demander de prédire la table de vérité d'un NAND dont on relie les deux entrées ensemble.
2. **Après chaque niveau** : faire verbaliser l'expression booléenne obtenue et la comparer au rappel de cours.
3. **Compteur de NAND** : lancer un défi « qui fait le XOR ou le multiplexeur avec le moins de portes ? ». Le meilleur score est mémorisé par niveau.
4. **Niveau 10 (verrou RS)** : demander aux élèves de « mettre en mémoire un 1 » puis « un 0 » avec les interrupteurs, avant d'introduire le vocabulaire de bascule.
5. **Niveau 12** : lien avec l'horloge du processeur et la synchronisation.
6. **Débrief final** : positionner l'UAL et la mémoire sur un schéma d'architecture de von Neumann.

### Modalités

- **Binôme** recommandé dès le niveau 8.
- Tous les niveaux peuvent être refaits ; le circuit en cours est sauvegardé par niveau.
- Comme les solutions sont vérifiées par test exhaustif, **il n'y a pas de correction à faire à la main** : un niveau coché est un niveau réussi.

---

## 5. Accessibilité et confort

L'interface a été pensée pour être utilisable par le plus grand nombre. Les points ci-dessous sont **conçus mais n'ont pas fait l'objet d'un audit externe** ; un essai avec vos élèves concernés reste recommandé.

- **Thème clair/sombre** (bouton soleil/lune), qui suit par défaut le réglage du système.
- **Bouton Accessibilité** : taille du texte (3 niveaux), contraste élevé, espacement du texte renforcé.
- **Couleurs** : bleu pour l'action, orange pour le signal actif, vert pour la réussite ; l'état d'un signal n'est jamais indiqué par la couleur seule (épaisseur du trait, valeurs 0/1 affichées, textes).
- **Clavier** : navigation par Tab, interrupteurs activables à Entrée/Espace, flèches pour déplacer un composant, et un dialogue « Connexions » (icône clavier) pour câbler et supprimer des fils **sans souris**.
- **Lecteurs d'écran** : étiquettes sur les éléments du plan et annonces des actions et des résultats.
- Les animations respectent le réglage « réduire les animations » du système.

---

## 6. Déploiement

### GitHub Pages (recommandé)

Le dépôt contient un workflow GitHub Actions (`.github/workflows/deploy.yml`) :

1. Créer un dépôt GitHub et y pousser le projet sur la branche `main`.
2. Dans **Settings → Pages → Build and deployment → Source**, choisir **GitHub Actions**.
3. À chaque push sur `main`, les vérifications automatiques s'exécutent puis le site est publié à l'adresse `https://<utilisateur>.github.io/<dépôt>/`.

Les vérifications automatiques contrôlent la syntaxe du code et **que les 15 niveaux sont résolubles** avec le moteur.

### Intranet / ENT / poste isolé

Le site est statique (HTML, CSS, JavaScript, sans dépendance externe). Il suffit de déposer ces fichiers sur n'importe quel serveur web, ou de les copier sur les postes : `index.html`, `style.css`, `engine.js`, `levels.js`, `app.js`.

---

## 7. Données, vie privée et limites

- **Aucune donnée n'est collectée ni transmise.** Pas de compte, pas de statistiques, pas de cookies.
- La **progression et les circuits** sont enregistrés dans le **stockage local du navigateur** (de l'appareil et du profil utilisés). Conséquences :
  - elle ne suit pas l'élève d'un poste à l'autre ;
  - vider les données du navigateur ou utiliser la navigation privée l'efface ;
  - sur un **poste partagé**, plusieurs élèves partagent la même progression sauf s'ils utilisent des sessions ou profils distincts ; le bouton « Effacer toute ma progression » (fenêtre Niveaux) remet à zéro.
- **Pas de tableau de bord enseignant** : vous ne pouvez pas consulter à distance l'avancement des élèves. Le suivi se fait en classe (niveau affiché, nombre de NAND) ou par capture d'écran.
- **Pas de mode enseignant** : les niveaux ne peuvent pas être débloqués librement.
- Certaines limites de l'interface sont connues : pas de zoom ni de défilement du plan, pas de sélection multiple, et les fils ne s'évitent pas entre eux.
- Navigateurs : testé uniquement par vérifications automatiques du moteur ; **l'interface elle-même n'a pas encore été vérifiée sur l'ensemble des navigateurs et appareils**. Faites un essai sur votre parc avant la séance.

---

## 8. Foire aux questions

**Mon élève est bloqué, que faire ?** Il peut ouvrir « Rappel de cours » et demander les indices un par un. Pour le verrou RS, une explication au tableau du bouclage débloque généralement la situation.

**Un fil semble ne rien faire.** Une entrée non reliée vaut 0. Les bornes non connectées sont affichées vides (creuses). L'icône clavier ouvre la liste des connexions existantes.

**Le test échoue alors que le circuit « marche » à la main.** La table de vérité indique, pour chaque cas faux, la valeur obtenue et la valeur attendue. Pour les mémoires, les étapes sont testées dans l'ordre : il faut tester les cas dans la séquence affichée.

**Le message « le circuit oscille » apparaît.** Une boucle sans état stable (par exemple une porte NON bouclée sur elle-même). C'est normal en dehors des niveaux de mémoire.

**Pourquoi le compteur de NAND est-il plus grand que ce que j'attendais ?** Il compte toutes les portes NAND posées, y compris à l'intérieur des composants réutilisés (un additionneur complet = 15 NAND).

**Peut-on utiliser un composant d'un niveau suivant ?** Non : seuls les composants des niveaux déjà réussis sont proposés.

---

## 9. Pour les enseignants qui veulent adapter le jeu

### Structure du projet

```
index.html          page et boîtes de dialogue
style.css           thème clair/sombre, contraste élevé, tailles de texte
engine.js           moteur : aplatit un circuit en portes NAND et le simule
levels.js           définition des niveaux (c'est ici qu'on en ajoute)
app.js              interface : plan de travail, routage des fils, accessibilité
test/solutions.test.js   solutions de référence de chaque niveau (test automatique)
.github/workflows/deploy.yml   vérifications + déploiement GitHub Pages
```

### Lancer les tests

```bash
node test/solutions.test.js
```

Chaque niveau y est résolu par une solution de référence ; le test échoue si un niveau devient irréalisable. Un circuit vide ne doit jamais valider un niveau.

### Ajouter ou modifier un niveau

Dans `levels.js`, un niveau est un objet. Exemple pour un circuit combinatoire :

```js
{
  id: 'nor', part: 'Logique de base', title: 'NON-OU', label: 'NOR',
  inputs: ['A', 'B'], outputs: ['S'],
  desc: 'Énoncé affiché à l’élève.',
  lesson: 'Rappel de cours.',
  hints: ['Indice 1', 'Indice 2'],
  fn: (i) => ({ S: (i.A || i.B) ? 0 : 1 }),   // comportement attendu
}
```

- Pour un circuit **avec mémoire**, remplacer `fn` par `steps` : une liste d'étapes `{ in: {...}, out: {...} }` jouées dans l'ordre (une sortie absente de `out` n'est pas vérifiée).
- Ajouter ensuite la solution de référence dans `test/solutions.test.js` (même `id`) pour garantir que le niveau est réalisable.
- L'ordre du tableau `LEVELS` fixe l'ordre de déblocage. Les niveaux avec beaucoup d'entrées (plus de 24 cas) ne listent que les cas en échec dans la table.

### Choix techniques

- Tout circuit est « aplati » en portes NAND puis simulé jusqu'à stabilité : cela permet de traiter les circuits à boucle (mémoires) avec le même moteur que les circuits combinatoires.
- Les fils à angles droits sont tracés par un routage simple sur boîtes englobantes (pas de recherche de chemin sur grille) ; les tracés sont mis en cache.
- Aucune dépendance, aucun outil de build.
