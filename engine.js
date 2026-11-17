/*
 * Moteur de simulation : tout circuit est « aplati » en portes NAND,
 * puis simulé par relaxation jusqu'à stabilité (permet aussi les circuits avec mémoire).
 *
 * Format d'un circuit :
 *   { nodes: [{id, type, x, y}], wires: [{id, from:{n,p}, to:{n,p}}] }
 *   - les nœuds d'entrée/sortie du niveau ne sont pas stockés : leurs ids sont "in:NOM" et "out:NOM"
 *   - une bibliothèque `lib` associe un type à { inputs, outputs, circuit } (ou { nand:true } pour NAND)
 */
(function (root) {
  'use strict';

  const NAND_DEF = { nand: true, name: 'NAND', label: 'NAND', inputs: ['A', 'B'], outputs: ['S'] };

  // Nœud de dérivation : ne fait que prolonger un fil (aucune porte)
  const JUNCTION_DEF = { junction: true, name: 'Nœud', label: 'Nœud', inputs: ['I'], outputs: ['O'] };

  function compile(circuit, inNames, outNames, lib) {
    let nSig = 1 + inNames.length; // signal 0 = constante 0 (fil non branché)
    const inSig = {};
    inNames.forEach((n, i) => { inSig[n] = 1 + i; });
    const gates = [];
    const nands = [];
    const MAX_DEPTH = 500;

    function makeCtx(circ, inResolver, depth) {
      const ctx = { circ, inResolver, inst: {}, toMap: {} };
      for (const w of circ.wires) ctx.toMap[w.to.n + '|' + w.to.p] = w;
      for (const node of circ.nodes) {
        const def = lib[node.type];
        if (!def) continue;
        if (def.junction) {
          ctx.inst[node.id] = { junction: true };
        } else if (def.nand) {
          const g = { a: 0, b: 0, o: nSig++ };
          gates.push(g);
          ctx.inst[node.id] = { nand: true, g };
          nands.push({ ctx, id: node.id, g });
        } else if (depth < 30 && def.circuit) {
          const id = node.id;
          ctx.inst[id] = {
            sub: makeCtx(def.circuit, (pin, d) => resolveInput(ctx, id, pin, d), depth + 1),
          };
        }
      }
      return ctx;
    }

    function resolveSource(ctx, from, d) {
      if (d > MAX_DEPTH) return 0;
      if (from.n.startsWith('in:')) return ctx.inResolver(from.p, d + 1);
      const inst = ctx.inst[from.n];
      if (!inst) return 0;
      if (inst.nand) return inst.g.o;
      if (inst.junction) return resolveInput(ctx, from.n, 'I', d + 1);
      return resolveOut(inst.sub, from.p, d + 1);
    }
    function resolveInput(ctx, nodeId, pin, d) {
      const w = ctx.toMap[nodeId + '|' + pin];
      return w ? resolveSource(ctx, w.from, d) : 0;
    }
    function resolveOut(ctx, pin, d) {
      const w = ctx.toMap['out:' + pin + '|' + pin];
      return w ? resolveSource(ctx, w.from, d) : 0;
    }

    const top = makeCtx(circuit, (pin) => inSig[pin] || 0, 0);
    for (const n of nands) {
      n.g.a = resolveInput(n.ctx, n.id, 'A', 0);
      n.g.b = resolveInput(n.ctx, n.id, 'B', 0);
    }

    const outSig = {};
    for (const name of outNames) outSig[name] = resolveOut(top, name, 0);
    const wireSig = {};
    for (const w of circuit.wires) wireSig[w.id] = resolveSource(top, w.from, 0);
    const nodeOutSig = {};
    for (const node of circuit.nodes) {
      const def = lib[node.type];
      if (!def) continue;
      for (const p of def.outputs) nodeOutSig[node.id + '|' + p] = resolveSource(top, { n: node.id, p }, 0);
    }
    return { gates, inSig, outSig, wireSig, nodeOutSig, v: new Uint8Array(nSig) };
  }

  // Met à jour les portes (dans l'ordre, sur place) jusqu'à stabilité. false = oscillation.
  function settle(sim) {
    const { gates, v } = sim;
    const max = gates.length * 2 + 20;
    for (let pass = 0; pass < max; pass++) {
      let changed = false;
      for (let i = 0; i < gates.length; i++) {
        const g = gates[i];
        const nv = (v[g.a] & v[g.b]) ? 0 : 1;
        if (v[g.o] !== nv) { v[g.o] = nv; changed = true; }
      }
      if (!changed) return true;
    }
    return false;
  }

  function setInputs(sim, values) {
    for (const name in sim.inSig) sim.v[sim.inSig[name]] = values[name] ? 1 : 0;
  }
  function readOutputs(sim) {
    const o = {};
    for (const name in sim.outSig) o[name] = sim.v[sim.outSig[name]];
    return o;
  }

  // Génère la liste des cas de test d'un niveau
  function buildTests(level) {
    if (level.steps) return level.steps.map((s) => ({ in: s.in, out: s.out || {} }));
    const n = level.inputs.length;
    const tests = [];
    for (let i = 0; i < (1 << n); i++) {
      const inp = {};
      level.inputs.forEach((name, k) => { inp[name] = (i >> (n - 1 - k)) & 1; });
      tests.push({ in: inp, out: level.fn(inp) });
    }
    return tests;
  }

  function runTests(level, circuit, lib) {
    const sim = compile(circuit, level.inputs, level.outputs, lib);
    const tests = buildTests(level);
    const rows = [];
    let ok = true;
    let unstable = false;
    for (const t of tests) {
      if (!level.steps) sim.v.fill(0); // circuit combinatoire : on repart de zéro à chaque cas
      setInputs(sim, t.in);
      const stable = settle(sim);
      if (!stable) unstable = true;
      const actual = readOutputs(sim);
      let rowOk = stable;
      for (const k in t.out) if (t.out[k] !== actual[k]) rowOk = false;
      if (!rowOk) ok = false;
      rows.push({ in: t.in, expected: t.out, actual, ok: rowOk });
    }
    return { ok, rows, nands: sim.gates.length, unstable };
  }

  const api = { NAND_DEF, JUNCTION_DEF, compile, settle, setInputs, readOutputs, buildTests, runTests };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
