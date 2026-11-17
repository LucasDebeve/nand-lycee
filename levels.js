/* Définition des niveaux. `fn` décrit le comportement attendu (circuits combinatoires),
   `steps` une suite d'étapes (circuits avec mémoire ; out = {} ou absent pour « on ne vérifie pas »). */
(function (root) {
  'use strict';

  const b = (x) => (x ? 1 : 0);

  const LEVELS = [
    {
      id: 'non', part: 'Logique de base', title: 'NON', label: 'NON',
      inputs: ['A'], outputs: ['S'],
      desc: 'Construis une porte NON (inverseur) : la sortie S est l’opposé de l’entrée A.',
      lesson: 'Une porte NAND (« NON-ET ») donne 0 uniquement quand ses deux entrées valent 1, sinon elle donne 1. Que se passe-t-il quand on lui envoie deux fois la même valeur ?',
      hints: [
        'La porte NAND a deux entrées. Essaie de leur donner la même valeur.',
        'Relie A aux deux entrées d’une même porte NAND, puis sa sortie à S.',
      ],
      fn: (i) => ({ S: b(!i.A) }),
    },
    {
      id: 'et', part: 'Logique de base', title: 'ET', label: 'ET',
      inputs: ['A', 'B'], outputs: ['S'],
      desc: 'Construis une porte ET : S vaut 1 uniquement si A et B valent 1 tous les deux.',
      lesson: 'NAND signifie « NON-ET » : c’est un ET dont la sortie est inversée. Donc inverser un NAND redonne un ET.',
      hints: [
        'Un NAND, c’est un ET suivi d’un NON.',
        'Place une porte NON (que tu as construite !) après un NAND.',
      ],
      fn: (i) => ({ S: b(i.A && i.B) }),
    },
    {
      id: 'ou', part: 'Logique de base', title: 'OU', label: 'OU',
      inputs: ['A', 'B'], outputs: ['S'],
      desc: 'Construis une porte OU : S vaut 1 si A vaut 1, ou si B vaut 1 (ou les deux).',
      lesson: 'Loi de De Morgan : A OU B = NON( NON(A) ET NON(B) ). Et NON( x ET y ) n’est rien d’autre qu’un NAND !',
      hints: [
        'Commence par inverser A et B avec deux portes NON.',
        'Envoie NON A et NON B dans une porte NAND.',
      ],
      fn: (i) => ({ S: b(i.A || i.B) }),
    },
    {
      id: 'xor', part: 'Logique de base', title: 'OU exclusif', label: 'XOR',
      inputs: ['A', 'B'], outputs: ['S'],
      desc: 'Construis un OU exclusif (XOR) : S vaut 1 quand A et B sont différents.',
      lesson: 'A XOR B = (A OU B) ET NON(A ET B). Il existe une astuce qui n’utilise que 4 portes NAND : calcule N = NAND(A, B), puis NAND(A, N) et NAND(B, N), puis un dernier NAND des deux résultats.',
      hints: [
        'Commence par une porte NAND(A, B). Appelons son résultat N.',
        'Calcule ensuite NAND(A, N) d’un côté et NAND(B, N) de l’autre.',
        'Termine avec un NAND qui combine ces deux résultats. Total : 4 NAND.',
      ],
      fn: (i) => ({ S: b(i.A !== i.B) }),
    },
    {
      id: 'mux', part: 'Aiguillage', title: 'Multiplexeur', label: 'MUX',
      inputs: ['A', 'B', 'Sel'], outputs: ['S'],
      desc: 'Un multiplexeur choisit une entrée : S = A quand Sel = 0, et S = B quand Sel = 1.',
      lesson: 'S = (A ET NON Sel) OU (B ET Sel). C’est un aiguillage : le signal Sel décide quelle entrée « passe ». On le retrouve partout dans un processeur.',
      hints: [
        'Calcule NON Sel.',
        'Calcule (A ET NON Sel) d’un côté, et (B ET Sel) de l’autre.',
        'Combine les deux résultats avec un OU.',
      ],
      fn: (i) => ({ S: i.Sel ? i.B : i.A }),
    },
    {
      id: 'dec', part: 'Aiguillage', title: 'Décodeur 2 → 4', label: 'DÉC',
      inputs: ['A1', 'A0'], outputs: ['Y0', 'Y1', 'Y2', 'Y3'],
      desc: 'Une seule sortie vaut 1 : celle dont le numéro est la valeur binaire de A1 A0 (par exemple A1 A0 = 10 → Y2 = 1).',
      lesson: 'Y0 = NON A1 ET NON A0 ; Y1 = NON A1 ET A0 ; Y2 = A1 ET NON A0 ; Y3 = A1 ET A0. Un décodeur sert par exemple à choisir une case mémoire grâce à son adresse.',
      hints: [
        'Prépare NON A1 et NON A0, tu en auras besoin plusieurs fois.',
        'Chaque sortie est un ET de deux signaux (A ou son inverse).',
      ],
      fn: (i) => {
        const v = i.A1 * 2 + i.A0;
        return { Y0: b(v === 0), Y1: b(v === 1), Y2: b(v === 2), Y3: b(v === 3) };
      },
    },
    {
      id: 'demi', part: 'Arithmétique', title: 'Demi-additionneur', label: '½ ADD',
      inputs: ['A', 'B'], outputs: ['S', 'R'],
      desc: 'Additionne deux bits A + B. Le résultat s’écrit sur deux bits : R S (R = retenue, S = somme). Par exemple 1 + 1 = 10 en binaire.',
      lesson: 'En binaire : 0+0 = 00, 0+1 = 01, 1+0 = 01, 1+1 = 10. La somme S est un OU exclusif, la retenue R est un ET.',
      hints: [
        'Regarde la table : S vaut 1 quand A et B sont différents.',
        'S = A XOR B et R = A ET B.',
      ],
      fn: (i) => ({ S: i.A ^ i.B, R: i.A & i.B }),
    },
    {
      id: 'add1', part: 'Arithmétique', title: 'Additionneur complet', label: 'ADD',
      inputs: ['A', 'B', 'Re'], outputs: ['S', 'Rs'],
      desc: 'Additionne trois bits : A + B + Re (la retenue d’entrée). Sorties : S (somme) et Rs (retenue de sortie).',
      lesson: 'On peut enchaîner deux demi-additionneurs : le premier additionne A et B, le second ajoute la retenue d’entrée. Les deux retenues ne peuvent jamais valoir 1 en même temps.',
      hints: [
        'Premier demi-additionneur : A et B.',
        'Second demi-additionneur : la somme précédente et Re.',
        'La retenue de sortie Rs est un OU des deux retenues.',
      ],
      fn: (i) => { const t = i.A + i.B + i.Re; return { S: t & 1, Rs: t >> 1 }; },
    },
    {
      id: 'add4', part: 'Arithmétique', title: 'Additionneur 4 bits', label: 'ADD 4',
      inputs: ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'Re'],
      outputs: ['S0', 'S1', 'S2', 'S3', 'Rs'],
      desc: 'Additionne deux nombres de 4 bits A3A2A1A0 et B3B2B1B0 (bit 0 = poids faible), plus une retenue d’entrée. Tu peux maintenant calculer jusqu’à 15 + 15 + 1 = 31 !',
      lesson: 'Pour additionner à la main, on part de la droite et on propage la retenue. Un additionneur 4 bits fait pareil : 4 additionneurs complets en chaîne, la retenue de sortie de l’un est la retenue d’entrée du suivant.',
      hints: [
        'Utilise 4 additionneurs complets : un par bit.',
        'Le premier additionne A0, B0 et Re. Sa retenue Rs va dans le Re du deuxième, etc.',
        'La retenue de sortie du dernier additionneur est la sortie Rs du circuit.',
      ],
      fn: (i) => {
        const a = i.A0 + 2 * i.A1 + 4 * i.A2 + 8 * i.A3;
        const c = i.B0 + 2 * i.B1 + 4 * i.B2 + 8 * i.B3;
        const t = a + c + i.Re;
        return { S0: t & 1, S1: (t >> 1) & 1, S2: (t >> 2) & 1, S3: (t >> 3) & 1, Rs: t >> 4 };
      },
    },
    {
      id: 'rs', part: 'Mémoire', title: 'Verrou RS', label: 'RS',
      inputs: ['nS', 'nR'], outputs: ['Q', 'nQ'],
      desc: 'Ton premier circuit capable de se souvenir ! nS = 0 met Q à 1 (Set), nR = 0 met Q à 0 (Reset). Quand nS = nR = 1, Q garde sa valeur. (Ne teste jamais nS = nR = 0.)',
      lesson: 'Jusqu’ici, les sorties ne dépendaient que des entrées du moment. Ici on crée une boucle : la sortie de chaque porte est renvoyée vers l’entrée de l’autre. Le circuit a deux états stables, c’est un bit de mémoire ! Joue avec les interrupteurs pour t’en convaincre.',
      hints: [
        'Il suffit de deux portes NAND.',
        'Porte 1 : entrées nS et la sortie de la porte 2 → sortie Q. Porte 2 : entrées nR et la sortie de la porte 1 → sortie nQ.',
        'Oui, un fil peut revenir en arrière : relie la sortie d’une porte à l’entrée de l’autre.',
      ],
      steps: [
        { in: { nS: 0, nR: 1 }, out: { Q: 1, nQ: 0 } },
        { in: { nS: 1, nR: 1 }, out: { Q: 1, nQ: 0 } },
        { in: { nS: 1, nR: 0 }, out: { Q: 0, nQ: 1 } },
        { in: { nS: 1, nR: 1 }, out: { Q: 0, nQ: 1 } },
        { in: { nS: 0, nR: 1 }, out: { Q: 1, nQ: 0 } },
        { in: { nS: 1, nR: 1 }, out: { Q: 1, nQ: 0 } },
        { in: { nS: 1, nR: 0 }, out: { Q: 0, nQ: 1 } },
        { in: { nS: 0, nR: 1 }, out: { Q: 1, nQ: 0 } },
      ],
    },
    {
      id: 'dlatch', part: 'Mémoire', title: 'Verrou D', label: 'VERROU D',
      inputs: ['D', 'E'], outputs: ['Q'],
      desc: 'Un verrou D mémorise la donnée D. Quand E (Enable) vaut 1, Q recopie D. Quand E vaut 0, Q garde la dernière valeur.',
      lesson: 'Le verrou RS est peu pratique : il faut deux fils pour écrire. Ici une seule donnée D et un signal d’autorisation E suffisent. On calcule nS = NAND(D, E) et nR = NAND(NON D, E) pour piloter un verrou RS.',
      hints: [
        'Utilise ton verrou RS comme composant.',
        'Quand E = 0, nS et nR doivent valoir 1 (mémoire).',
        'nS = NAND(D, E) et nR = NAND(NON D, E). Sortie : Q du verrou RS.',
      ],
      steps: [
        { in: { D: 1, E: 1 }, out: { Q: 1 } },
        { in: { D: 1, E: 0 }, out: { Q: 1 } },
        { in: { D: 0, E: 0 }, out: { Q: 1 } },
        { in: { D: 0, E: 1 }, out: { Q: 0 } },
        { in: { D: 1, E: 0 }, out: { Q: 0 } },
        { in: { D: 0, E: 0 }, out: { Q: 0 } },
        { in: { D: 1, E: 1 }, out: { Q: 1 } },
        { in: { D: 0, E: 0 }, out: { Q: 1 } },
      ],
    },
    {
      id: 'dff', part: 'Mémoire', title: 'Bascule D', label: 'BASCULE D',
      inputs: ['D', 'Clk'], outputs: ['Q'],
      desc: 'Une bascule D ne mémorise D qu’à l’instant précis où l’horloge Clk passe de 0 à 1 (front montant). Entre deux fronts, D peut changer sans effet sur Q.',
      lesson: 'Les processeurs synchronisent tout avec une horloge. Pour qu’une mémoire ne change qu’à un instant précis, on met deux verrous D à la suite : le maître est ouvert quand Clk = 0, l’esclave est ouvert quand Clk = 1. Ils ne sont jamais ouverts en même temps.',
      hints: [
        'Utilise deux verrous D : un maître et un esclave.',
        'Maître : D → verrou D, avec E = NON Clk. Esclave : sortie du maître → verrou D, avec E = Clk.',
        'La sortie Q est celle de l’esclave.',
      ],
      steps: [
        { in: { D: 0, Clk: 0 } },
        { in: { D: 0, Clk: 1 }, out: { Q: 0 } },
        { in: { D: 1, Clk: 1 }, out: { Q: 0 } },
        { in: { D: 1, Clk: 0 }, out: { Q: 0 } },
        { in: { D: 1, Clk: 1 }, out: { Q: 1 } },
        { in: { D: 0, Clk: 1 }, out: { Q: 1 } },
        { in: { D: 0, Clk: 0 }, out: { Q: 1 } },
        { in: { D: 0, Clk: 1 }, out: { Q: 0 } },
        { in: { D: 1, Clk: 0 }, out: { Q: 0 } },
        { in: { D: 0, Clk: 0 }, out: { Q: 0 } },
        { in: { D: 1, Clk: 0 }, out: { Q: 0 } },
        { in: { D: 1, Clk: 1 }, out: { Q: 1 } },
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
