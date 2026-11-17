// Vérifie que chaque niveau est résoluble avec le moteur : `node test/solutions.test.js`
const E = require('../engine.js');
const LEVELS = require('../levels.js');

const lib = { NAND: E.NAND_DEF };

function Builder() {
  const c = { nodes: [], wires: [] };
  let k = 0;
  const B = {
    c,
    IN: (n) => ({ n: 'in:' + n, p: n }),
    node(type) { const id = 'c' + (++k); c.nodes.push({ id, type, x: 0, y: 0 }); return id; },
    connect(src, id, pin) { c.wires.push({ id: 'w' + (++k), from: src, to: { n: id, p: pin } }); },
    src: (id, p) => ({ n: id, p }),
    out(name, src) { c.wires.push({ id: 'w' + (++k), from: src, to: { n: 'out:' + name, p: name } }); },
    use(type, ...srcs) {
      const id = B.node(type);
      lib[type].inputs.forEach((p, i) => B.connect(srcs[i], id, p));
      return lib[type].outputs.map((p) => B.src(id, p));
    },
  };
  return B;
}

const sol = {
  non(B) { B.out('S', B.use('NAND', B.IN('A'), B.IN('A'))[0]); },
  et(B) { const [n] = B.use('NAND', B.IN('A'), B.IN('B')); B.out('S', B.use('non', n)[0]); },
  ou(B) {
    const [a] = B.use('non', B.IN('A')); const [b] = B.use('non', B.IN('B'));
    B.out('S', B.use('NAND', a, b)[0]);
  },
  xor(B) {
    const A = B.IN('A'), Bb = B.IN('B');
    const [n] = B.use('NAND', A, Bb);
    const [x] = B.use('NAND', A, n); const [y] = B.use('NAND', Bb, n);
    B.out('S', B.use('NAND', x, y)[0]);
  },
  mux(B) {
    const [ns] = B.use('non', B.IN('Sel'));
    const [x] = B.use('et', B.IN('A'), ns); const [y] = B.use('et', B.IN('B'), B.IN('Sel'));
    B.out('S', B.use('ou', x, y)[0]);
  },
  dec(B) {
    const A1 = B.IN('A1'), A0 = B.IN('A0');
    const [n1] = B.use('non', A1); const [n0] = B.use('non', A0);
    B.out('Y0', B.use('et', n1, n0)[0]); B.out('Y1', B.use('et', n1, A0)[0]);
    B.out('Y2', B.use('et', A1, n0)[0]); B.out('Y3', B.use('et', A1, A0)[0]);
  },
  demi(B) {
    B.out('S', B.use('xor', B.IN('A'), B.IN('B'))[0]);
    B.out('R', B.use('et', B.IN('A'), B.IN('B'))[0]);
  },
  add1(B) {
    const [s1, r1] = B.use('demi', B.IN('A'), B.IN('B'));
    const [s2, r2] = B.use('demi', s1, B.IN('Re'));
    B.out('S', s2); B.out('Rs', B.use('ou', r1, r2)[0]);
  },
  add4(B) {
    let carry = B.IN('Re');
    for (let i = 0; i < 4; i++) {
      const [s, r] = B.use('add1', B.IN('A' + i), B.IN('B' + i), carry);
      B.out('S' + i, s); carry = r;
    }
    B.out('Rs', carry);
  },
  rs(B) {
    const n1 = B.node('NAND'), n2 = B.node('NAND');
    B.connect(B.IN('nS'), n1, 'A'); B.connect(B.src(n2, 'S'), n1, 'B');
    B.connect(B.IN('nR'), n2, 'A'); B.connect(B.src(n1, 'S'), n2, 'B');
    B.out('Q', B.src(n1, 'S')); B.out('nQ', B.src(n2, 'S'));
  },
  dlatch(B) {
    const D = B.IN('D'), En = B.IN('E');
    const [nS] = B.use('NAND', D, En);
    const [nd] = B.use('non', D);
    const [nR] = B.use('NAND', nd, En);
    B.out('Q', B.use('rs', nS, nR)[0]);
  },
  dff(B) {
    const [nc] = B.use('non', B.IN('Clk'));
    const [m] = B.use('dlatch', B.IN('D'), nc);
    B.out('Q', B.use('dlatch', m, B.IN('Clk'))[0]);
  },
};

let fail = 0;
for (const lv of LEVELS) {
  const B = Builder();
  sol[lv.id](B);
  const r = E.runTests(lv, B.c, lib);
  console.log((r.ok ? 'OK  ' : 'FAIL') + ' ' + lv.id.padEnd(8) + ' NAND=' + r.nands + (r.unstable ? ' (instable)' : ''));
  if (!r.ok) { fail++; console.log(r.rows.filter((x) => !x.ok).slice(0, 3)); }
  lib[lv.id] = { name: lv.title, label: lv.label, inputs: lv.inputs, outputs: lv.outputs, circuit: B.c };
  // un circuit vide ne doit pas réussir
  const empty = E.runTests(lv, { nodes: [], wires: [] }, lib);
  if (empty.ok) { fail++; console.log('FAIL: circuit vide accepté pour', lv.id); }
}
process.exit(fail ? 1 : 0);
