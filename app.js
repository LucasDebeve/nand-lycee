/* Interface du jeu : éditeur de circuit (SVG), progression, panneaux. */
(function () {
  'use strict';
  const E = window.Engine;
  const LEVELS = window.LEVELS;
  const W = 1100, H = 680;
  const STORE_KEY = 'nand-lycee-v1';
  const $ = (s) => document.querySelector(s);
  const svg = $('#board');

  // ---------- Sauvegarde ----------
  let progress = { solved: {}, drafts: {}, current: 0, seenHelp: false };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) progress = Object.assign(progress, JSON.parse(raw));
  } catch (e) { /* stockage indisponible : on joue sans sauvegarde */ }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* ignoré */ }
  }

  // ---------- État ----------
  const S = {
    idx: 0, level: null, lib: {}, circuit: { nodes: [], wires: [] },
    sel: null, inputs: {}, sim: null, simDirty: true, undo: [],
    result: null, hints: 0, tests: [], idCounter: 0,
  };
  let wiring = null; // { anchor:{n,p,dir}|null, orig:wire|null, start:{x,y}, cur:{x,y} }
  let dragging = null; // { id, dx, dy, snap, moved }

  const colorFor = (i) => `hsl(${(i * 47 + 160) % 360} 50% 40%)`;

  function buildLib(idx) {
    const lib = { NAND: Object.assign({}, E.NAND_DEF, { color: '#4f46e5' }) };
    for (let i = 0; i < idx; i++) {
      const lv = LEVELS[i];
      const sol = progress.solved[lv.id];
      if (!sol) continue;
      lib[lv.id] = { name: lv.title, label: lv.label, inputs: lv.inputs, outputs: lv.outputs, circuit: sol.circuit, color: colorFor(i) };
    }
    return lib;
  }
  const isUnlocked = (i) => i === 0 || !!progress.solved[LEVELS[i - 1].id];

  // ---------- Géométrie ----------
  const ioY = (i, n) => (H * (i + 1)) / (n + 1);
  function nodeSize(node) {
    const def = S.lib[node.type];
    const n = Math.max(def.inputs.length, def.outputs.length, 1);
    const w = node.type === 'NAND' ? 84 : Math.max(104, def.label.length * 10 + 56);
    return { w, h: n * 24 + 16, def };
  }
  function pinPos(nodeId, pin, dir) {
    if (nodeId.startsWith('in:')) {
      const i = S.level.inputs.indexOf(pin);
      return { x: 92, y: ioY(i, S.level.inputs.length) };
    }
    if (nodeId.startsWith('out:')) {
      const i = S.level.outputs.indexOf(pin);
      return { x: W - 92, y: ioY(i, S.level.outputs.length) };
    }
    const node = S.circuit.nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    const { w, h, def } = nodeSize(node);
    const list = dir === 'in' ? def.inputs : def.outputs;
    const i = list.indexOf(pin);
    return { x: node.x + (dir === 'in' ? 0 : w), y: node.y + (h - list.length * 24) / 2 + 12 + i * 24 };
  }

  // ---------- Simulation ----------
  function ensureSim() {
    if (!S.simDirty && S.sim) return;
    S.sim = E.compile(S.circuit, S.level.inputs, S.level.outputs, S.lib);
    E.setInputs(S.sim, S.inputs);
    E.settle(S.sim);
    S.simDirty = false;
  }
  function wireVal(w) { return w && S.sim ? S.sim.v[S.sim.wireSig[w.id]] : 0; }

  // ---------- Modification du circuit ----------
  const snapshot = () => JSON.stringify(S.circuit);
  function pushUndo(snap) {
    S.undo.push(snap || snapshot());
    if (S.undo.length > 100) S.undo.shift();
  }
  function changed() {
    S.simDirty = true;
    S.result = null;
    progress.drafts[S.level.id] = S.circuit;
    save();
    refresh();
  }
  const newId = (p) => p + (++S.idCounter);

  function addNode(type, x, y) {
    pushUndo();
    const node = { id: newId('c'), type, x: 0, y: 0 };
    const { w, h } = nodeSize(node);
    if (x == null) {
      // première place libre sur une grille
      outer:
      for (let yy = 70; yy < H - h; yy += 80) {
        for (let xx = 190; xx < W - 190 - w; xx += 140) {
          const free = S.circuit.nodes.every((o) => {
            const s = nodeSize(o);
            return xx + w + 20 < o.x || o.x + s.w + 20 < xx || yy + h + 12 < o.y || o.y + s.h + 12 < yy;
          });
          if (free) { x = xx; y = yy; break outer; }
        }
      }
      if (x == null) { x = 300; y = 300; }
    } else { x -= w / 2; y -= h / 2; }
    node.x = clamp(Math.round(x / 10) * 10, 120, W - 120 - w);
    node.y = clamp(Math.round(y / 10) * 10, 10, H - h - 10);
    S.circuit.nodes.push(node);
    S.sel = { kind: 'node', id: node.id };
    changed();
  }
  function connect(from, to) {
    if (S.circuit.wires.some((w) => w.from.n === from.n && w.from.p === from.p && w.to.n === to.n && w.to.p === to.p)) return;
    S.circuit.wires = S.circuit.wires.filter((w) => !(w.to.n === to.n && w.to.p === to.p));
    S.circuit.wires.push({ id: newId('w'), from: { n: from.n, p: from.p }, to: { n: to.n, p: to.p } });
  }
  function deleteSelection() {
    if (!S.sel) return;
    pushUndo();
    if (S.sel.kind === 'node') {
      S.circuit.nodes = S.circuit.nodes.filter((n) => n.id !== S.sel.id);
      S.circuit.wires = S.circuit.wires.filter((w) => w.from.n !== S.sel.id && w.to.n !== S.sel.id);
    } else {
      S.circuit.wires = S.circuit.wires.filter((w) => w.id !== S.sel.id);
    }
    S.sel = null;
    changed();
  }
  function undo() {
    const snap = S.undo.pop();
    if (!snap) return;
    S.circuit = JSON.parse(snap);
    S.sel = null;
    changed();
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Rendu du plan ----------
  function curve(a, b) {
    const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
    return `M${a.x} ${a.y} C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
  }
  function renderBoard() {
    ensureSim();
    const lv = S.level;
    const wiredIn = new Set(S.circuit.wires.map((w) => w.to.n + '|' + w.to.p));
    const wiredOut = new Set(S.circuit.wires.map((w) => w.from.n + '|' + w.from.p));
    let h = '';

    for (const w of S.circuit.wires) {
      const a = pinPos(w.from.n, w.from.p, 'out'), b = pinPos(w.to.n, w.to.p, 'in');
      if (!a || !b) continue;
      const d = curve(a, b);
      const sel = S.sel && S.sel.kind === 'wire' && S.sel.id === w.id;
      h += `<path class="wire ${wireVal(w) ? 'on' : ''} ${sel ? 'sel' : ''}" d="${d}"/>`;
      h += `<path class="wire-hit" data-wire="${w.id}" d="${d}"/>`;
    }
    if (wiring && wiring.anchor) {
      const p = pinPos(wiring.anchor.n, wiring.anchor.p, wiring.anchor.dir);
      if (p) h += `<path class="wire preview" d="${wiring.anchor.dir === 'out' ? curve(p, wiring.cur) : curve(wiring.cur, p)}"/>`;
    }

    // Entrées du niveau (interrupteurs)
    lv.inputs.forEach((name, i) => {
      const y = ioY(i, lv.inputs.length), on = S.inputs[name] ? 1 : 0;
      h += `<g class="switch ${on ? 'on' : ''}" data-toggle="${name}" role="switch" aria-checked="${!!on}" aria-label="Entrée ${name}">
        <text class="io-name" x="60" y="${y - 24}">${name}</text>
        <rect class="track" x="30" y="${y - 15}" width="60" height="30" rx="15"/>
        <circle class="knob" cx="${on ? 75 : 45}" cy="${y}" r="11"/>
        <text x="${on ? 45 : 75}" y="${y + 4}" text-anchor="middle" fill="#fff" font-size="12" font-weight="700" pointer-events="none">${on}</text>
      </g>`;
      h += pinSvg('in:' + name, name, 'out', 92, y, on, wiredOut.has('in:' + name + '|' + name));
    });

    // Sorties du niveau (LED)
    const rows = S.result ? S.result.rows : null;
    lv.outputs.forEach((name, i) => {
      const y = ioY(i, lv.outputs.length);
      const w = S.circuit.wires.find((x) => x.to.n === 'out:' + name);
      const on = wireVal(w);
      h += `<text class="io-name" x="${W - 60}" y="${y - 28}">${name}</text>
        <line x1="${W - 92}" y1="${y}" x2="${W - 76}" y2="${y}" stroke="var(--wire-off)" stroke-width="3"/>
        <circle class="led ${on ? 'on' : ''}" cx="${W - 60}" cy="${y}" r="16"/>
        <text x="${W - 60}" y="${y + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="${on ? '#422006' : '#94a3b8'}" pointer-events="none">${on}</text>`;
      h += pinSvg('out:' + name, name, 'in', W - 92, y, on, !!w);
    });

    // Composants
    for (const n of S.circuit.nodes) {
      const { w, h: hh, def } = nodeSize(n);
      const sel = S.sel && S.sel.kind === 'node' && S.sel.id === n.id;
      h += `<g class="node ${sel ? 'sel' : ''}" data-node="${n.id}" transform="translate(${n.x},${n.y})">
        <rect class="body" width="${w}" height="${hh}" rx="10" fill="${def.color}"/>
        <text class="lbl" x="${w / 2}" y="${hh / 2}">${def.label}</text>`;
      def.inputs.forEach((p, i) => { h += `<text class="pl" x="9" y="${(hh - def.inputs.length * 24) / 2 + 12 + i * 24}">${p}</text>`; });
      def.outputs.forEach((p, i) => { h += `<text class="pl" text-anchor="end" x="${w - 9}" y="${(hh - def.outputs.length * 24) / 2 + 12 + i * 24}">${p}</text>`; });
      h += '</g>';
    }
    for (const n of S.circuit.nodes) {
      const { def } = nodeSize(n);
      def.inputs.forEach((p) => {
        const pos = pinPos(n.id, p, 'in');
        const w = S.circuit.wires.find((x) => x.to.n === n.id && x.to.p === p);
        h += pinSvg(n.id, p, 'in', pos.x, pos.y, wireVal(w), !!w);
      });
      def.outputs.forEach((p) => {
        const pos = pinPos(n.id, p, 'out');
        h += pinSvg(n.id, p, 'out', pos.x, pos.y, S.sim.v[S.sim.nodeOutSig[n.id + '|' + p]], wiredOut.has(n.id + '|' + p));
      });
    }
    svg.innerHTML = h;
  }
  function pinSvg(n, p, dir, x, y, on, wired) {
    return `<circle class="pin-hit" data-pin="${p}" data-pnode="${n}" data-dir="${dir}" cx="${x}" cy="${y}" r="14"/>` +
      `<circle class="pin ${on ? 'on' : ''} ${wired ? '' : 'free'}" cx="${x}" cy="${y}" r="6"/>`;
  }

  // ---------- Interactions sur le plan ----------
  function svgPoint(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }

  svg.addEventListener('pointerdown', (e) => {
    const pin = e.target.closest('[data-pin]');
    const tog = e.target.closest('[data-toggle]');
    const node = e.target.closest('[data-node]');
    const wire = e.target.closest('[data-wire]');
    const p = svgPoint(e);
    if (pin) {
      e.preventDefault();
      const n = pin.dataset.pnode, name = pin.dataset.pin, dir = pin.dataset.dir;
      wiring = { anchor: null, orig: null, start: p, cur: p, snap: snapshot() };
      if (dir === 'in') {
        const ex = S.circuit.wires.find((w) => w.to.n === n && w.to.p === name);
        if (ex) wiring.orig = ex; else wiring.anchor = { n, p: name, dir };
      } else wiring.anchor = { n, p: name, dir };
    } else if (tog) {
      e.preventDefault();
      const name = tog.dataset.toggle;
      S.inputs[name] = S.inputs[name] ? 0 : 1;
      E.setInputs(S.sim, S.inputs);
      E.settle(S.sim);
      renderBoard();
      renderTable();
    } else if (node) {
      e.preventDefault();
      const n = S.circuit.nodes.find((x) => x.id === node.dataset.node);
      S.sel = { kind: 'node', id: n.id };
      dragging = { id: n.id, dx: p.x - n.x, dy: p.y - n.y, snap: snapshot(), moved: false };
      renderBoard();
    } else if (wire) {
      S.sel = { kind: 'wire', id: wire.dataset.wire };
      renderBoard();
    } else {
      S.sel = null;
      renderBoard();
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (wiring) {
      const p = svgPoint(e);
      wiring.cur = p;
      if (!wiring.anchor && wiring.orig && Math.hypot(p.x - wiring.start.x, p.y - wiring.start.y) > 6) {
        // on « décroche » le fil existant pour le déplacer
        S.circuit.wires = S.circuit.wires.filter((w) => w !== wiring.orig);
        wiring.anchor = { n: wiring.orig.from.n, p: wiring.orig.from.p, dir: 'out' };
        wiring.detached = true;
        S.simDirty = true;
      }
      if (wiring.anchor) renderBoard();
    } else if (dragging) {
      const p = svgPoint(e);
      const n = S.circuit.nodes.find((x) => x.id === dragging.id);
      const { w, h } = nodeSize(n);
      const nx = clamp(Math.round((p.x - dragging.dx) / 10) * 10, 120, W - 120 - w);
      const ny = clamp(Math.round((p.y - dragging.dy) / 10) * 10, 10, H - h - 10);
      if (nx !== n.x || ny !== n.y) { n.x = nx; n.y = ny; dragging.moved = true; renderBoard(); }
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (wiring) {
      const w = wiring;
      wiring = null;
      let modified = !!w.detached;
      if (w.anchor) {
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const target = t && t.closest ? t.closest('[data-pin]') : null;
        if (target && target.dataset.dir !== w.anchor.dir) {
          const tp = { n: target.dataset.pnode, p: target.dataset.pin };
          if (tp.n !== w.anchor.n || w.anchor.dir !== 'in') {
            const a = w.anchor;
            pushUndo(w.snap);
            if (a.dir === 'out') connect(a, tp); else connect(tp, a);
            changed();
            return;
          }
        }
      }
      if (modified) { pushUndo(w.snap); changed(); } else renderBoard();
    } else if (dragging) {
      if (dragging.moved) { pushUndo(dragging.snap); progress.drafts[S.level.id] = S.circuit; save(); }
      dragging = null;
    }
  });

  svg.addEventListener('dragover', (e) => e.preventDefault());
  svg.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    if (!S.lib[type]) return;
    const p = svgPoint(e);
    addNode(type, p.x, p.y);
  });

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });

  // ---------- Panneaux ----------
  function renderPalette() {
    const box = $('#palette');
    box.innerHTML = '';
    for (const type in S.lib) {
      const def = S.lib[type];
      const b = document.createElement('button');
      b.className = 'chip';
      b.style.background = def.color;
      b.draggable = true;
      b.innerHTML = `${def.label}<small>${def.inputs.length}→${def.outputs.length}</small>`;
      b.title = `Ajouter : ${def.name}`;
      b.addEventListener('click', () => addNode(type));
      b.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', type));
      box.appendChild(b);
    }
  }

  function renderTable() {
    const lv = S.level;
    const wrap = $('#table-wrap');
    const res = S.result;
    const seq = !!lv.steps;
    const tests = S.tests;
    const BIG = 24;
    let rows;
    if (tests.length > BIG) {
      if (!res) { wrap.innerHTML = `<p class="muted">${tests.length} cas à vérifier : trop pour les lister. Clique sur « Tester le circuit ».</p>`; return; }
      rows = res.rows.map((r, i) => ({ r, i })).filter((x) => !x.r.ok).slice(0, 10);
      if (!rows.length) { wrap.innerHTML = ''; return; }
      wrap.innerHTML = '<p class="muted">Premiers cas en échec :</p>' + tableHtml(rows.map((x) => ({ t: tests[x.i], r: x.r, i: x.i })), seq);
      return;
    }
    wrap.innerHTML = tableHtml(tests.map((t, i) => ({ t, r: res ? res.rows[i] : null, i })), seq);
  }
  function tableHtml(items, seq) {
    const lv = S.level;
    let h = '<table class="tt"><thead><tr>';
    if (seq) h += '<th>#</th>';
    lv.inputs.forEach((n) => { h += `<th>${n}</th>`; });
    lv.outputs.forEach((n, i) => { h += `<th class="${i === 0 ? 'sep' : ''}">${n}</th>`; });
    h += '</tr></thead><tbody>';
    for (const { t, r, i } of items) {
      const cur = !seq && lv.inputs.every((n) => (S.inputs[n] ? 1 : 0) === t.in[n]);
      h += `<tr class="${cur ? 'cur' : ''}">`;
      if (seq) h += `<td>${i + 1}</td>`;
      lv.inputs.forEach((n) => { h += `<td>${t.in[n]}</td>`; });
      lv.outputs.forEach((n, k) => {
        const exp = t.out[n];
        const sep = k === 0 ? 'sep ' : '';
        if (exp === undefined) h += `<td class="${sep}na">${r ? r.actual[n] : '–'}</td>`;
        else if (!r) h += `<td class="${sep}">${exp}</td>`;
        else if (r.actual[n] === exp) h += `<td class="${sep}ok">${exp}</td>`;
        else h += `<td class="${sep}ko">${r.actual[n]}<sup>→${exp}</sup></td>`;
      });
      h += '</tr>';
    }
    return h + '</tbody></table>';
  }

  function renderBanner() {
    const b = $('#result-banner');
    const r = S.result;
    if (!r) { b.hidden = true; return; }
    b.hidden = false;
    const bad = r.rows.filter((x) => !x.ok).length;
    b.className = 'banner ' + (r.ok ? 'ok' : 'ko');
    b.textContent = r.ok
      ? `✓ Tous les cas sont corrects (${r.rows.length}/${r.rows.length}) — ${r.nands} NAND`
      : `✗ ${bad} cas sur ${r.rows.length} incorrect${bad > 1 ? 's' : ''}` + (r.unstable ? ' (le circuit oscille : vérifie tes boucles)' : '');
  }

  function renderHints() {
    const ol = $('#hint-list');
    const hs = S.level.hints;
    ol.innerHTML = hs.slice(0, S.hints).map((h) => `<li>${h}</li>`).join('');
    const btn = $('#btn-hint');
    btn.disabled = S.hints >= hs.length;
    btn.textContent = S.hints === 0 ? '💡 Indice' : S.hints >= hs.length ? '💡 Plus d’indice' : `💡 Indice suivant (${S.hints}/${hs.length})`;
  }

  function renderHeader() {
    $('#lvl-counter').textContent = `Niveau ${S.idx + 1} / ${LEVELS.length}`;
    const n = S.sim ? S.sim.gates.length : 0;
    $('#nand-counter').textContent = `${n} porte${n > 1 ? 's' : ''} NAND`;
    const sol = progress.solved[S.level.id];
    $('#lvl-title').textContent = S.level.title + (sol ? ' ✓' : '');
  }

  function refresh() {
    renderBoard();
    renderHeader();
    renderTable();
    renderBanner();
    $('#btn-undo').disabled = !S.undo.length;
    $('#btn-delete').disabled = !S.sel;
  }

  // ---------- Niveaux ----------
  function loadLevel(i) {
    S.idx = i;
    S.level = LEVELS[i];
    S.lib = buildLib(i);
    const draft = progress.drafts[S.level.id];
    S.circuit = draft ? JSON.parse(JSON.stringify(draft)) : { nodes: [], wires: [] };
    S.circuit.nodes = S.circuit.nodes.filter((n) => S.lib[n.type]);
    const ids = S.circuit.nodes.map((n) => n.id).concat(S.circuit.wires.map((w) => w.id));
    S.idCounter = ids.reduce((m, id) => Math.max(m, parseInt(id.slice(1), 10) || 0), 0);
    S.sel = null; S.undo = []; S.result = null; S.hints = 0; S.sim = null; S.simDirty = true;
    S.inputs = {}; S.level.inputs.forEach((n) => { S.inputs[n] = 0; });
    S.tests = E.buildTests(S.level);
    progress.current = i; save();
    $('#lvl-part').textContent = S.level.part;
    $('#lvl-desc').textContent = S.level.desc;
    $('#lvl-lesson').textContent = S.level.lesson;
    $('#lvl-lesson-box').open = false;
    renderPalette();
    renderHints();
    refresh();
  }

  function renderLevelList() {
    const box = $('#levels-list');
    let h = '', part = '';
    LEVELS.forEach((lv, i) => {
      if (lv.part !== part) { part = lv.part; h += `<h3 class="part-title">${part}</h3>`; }
      const sol = progress.solved[lv.id], ok = isUnlocked(i);
      h += `<button class="lvl-item ${i === S.idx ? 'current' : ''}" data-i="${i}" ${ok ? '' : 'disabled'}>
        <span class="st">${sol ? '✅' : ok ? '▶' : '🔒'}</span><span class="nm">${i + 1}. ${lv.title}</span>
        <span class="sc">${sol ? 'meilleur : ' + sol.best + ' NAND' : ''}</span></button>`;
    });
    box.innerHTML = h;
  }

  function testCircuit() {
    S.result = E.runTests(S.level, S.circuit, S.lib);
    const r = S.result;
    if (r.ok) {
      const prev = progress.solved[S.level.id];
      const best = prev ? Math.min(prev.best, r.nands) : r.nands;
      progress.solved[S.level.id] = { circuit: JSON.parse(JSON.stringify(S.circuit)), nands: r.nands, best };
      save();
      refresh();
      const last = S.idx === LEVELS.length - 1;
      $('#success-title').textContent = last ? '🎉 Tu as tout reconstruit !' : 'Bravo, niveau réussi !';
      $('#success-text').textContent =
        `Ton circuit « ${S.level.title} » utilise ${r.nands} porte${r.nands > 1 ? 's' : ''} NAND` +
        ` (meilleur score : ${best}). ` +
        (last ? 'Tu as construit une mémoire à partir d’une seule porte logique : c’est exactement le principe de tous les ordinateurs.'
          : 'Il est maintenant disponible comme composant dans les niveaux suivants. Peux-tu en utiliser moins ?');
      $('#btn-next').hidden = last;
      $('#dlg-success').showModal();
    } else {
      refresh();
    }
  }

  // ---------- Boutons ----------
  $('#btn-test').addEventListener('click', testCircuit);
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-delete').addEventListener('click', deleteSelection);
  $('#btn-clear').addEventListener('click', () => {
    if (!S.circuit.nodes.length && !S.circuit.wires.length) return;
    if (!confirm('Effacer tout le circuit de ce niveau ?')) return;
    pushUndo();
    S.circuit = { nodes: [], wires: [] };
    S.sel = null;
    changed();
  });
  $('#btn-hint').addEventListener('click', () => { S.hints++; renderHints(); });
  $('#btn-levels').addEventListener('click', () => { renderLevelList(); $('#dlg-levels').showModal(); });
  $('#btn-help').addEventListener('click', () => $('#dlg-help').showModal());
  $('#levels-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    $('#dlg-levels').close();
    loadLevel(+b.dataset.i);
  });
  $('#dlg-success').addEventListener('close', (e) => {
    if (e.target.returnValue === 'next' && S.idx + 1 < LEVELS.length) loadLevel(S.idx + 1);
    e.target.returnValue = '';
  });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Effacer toute ta progression et tous tes circuits ?')) return;
    progress = { solved: {}, drafts: {}, current: 0, seenHelp: true };
    save();
    $('#dlg-levels').close();
    loadLevel(0);
  });

  // ---------- Démarrage ----------
  const start = clamp(progress.current | 0, 0, LEVELS.length - 1);
  loadLevel(isUnlocked(start) ? start : 0);
  if (!progress.seenHelp) {
    progress.seenHelp = true; save();
    $('#dlg-help').showModal();
  }
})();
