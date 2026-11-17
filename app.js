/* Interface du jeu : éditeur de circuit (SVG), progression, accessibilité. */
(function () {
  'use strict';
  const E = window.Engine;
  const LEVELS = window.LEVELS;
  const W = 1100, H = 680;
  const STORE_KEY = 'nand-lycee-v1';
  const PREF_KEY = 'nand-lycee-prefs';
  const $ = (s) => document.querySelector(s);
  const svg = $('#board');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Sauvegarde ----------
  let progress = { solved: {}, drafts: {}, current: 0, seenHelp: false };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) progress = Object.assign(progress, JSON.parse(raw));
  } catch (e) { /* stockage indisponible : on joue sans sauvegarde */ }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* ignoré */ }
  }

  // ---------- Préférences (thème, taille, contraste, espacement) ----------
  const prefs = { theme: null, size: 'md', contrast: null, spacing: false };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { /* ignoré */ }
  const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  const mqContrast = window.matchMedia('(prefers-contrast: more)');
  const isDark = () => (prefs.theme ? prefs.theme === 'dark' : mqDark.matches);
  const isHighContrast = () => (prefs.contrast == null ? mqContrast.matches : prefs.contrast);
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignoré */ } }
  function applyPrefs() {
    const r = document.documentElement;
    r.dataset.theme = isDark() ? 'dark' : 'light';
    r.dataset.size = prefs.size;
    r.dataset.contrast = isHighContrast() ? 'high' : 'normal';
    r.dataset.spacing = prefs.spacing ? 'on' : 'off';
    { const t = isDark() ? 'Passer en mode clair' : 'Passer en mode sombre'; $('#btn-theme').setAttribute('aria-label', t); $('#btn-theme').title = t; }
    document.querySelectorAll('input[name="size"]').forEach((i) => { i.checked = i.value === prefs.size; });
    $('#opt-contrast').checked = isHighContrast();
    $('#opt-spacing').checked = prefs.spacing;
  }
  $('#btn-theme').addEventListener('click', () => { prefs.theme = isDark() ? 'light' : 'dark'; savePrefs(); applyPrefs(); });
  $('#btn-a11y').addEventListener('click', () => $('#dlg-a11y').showModal());
  document.querySelectorAll('input[name="size"]').forEach((i) => i.addEventListener('change', () => { prefs.size = i.value; savePrefs(); applyPrefs(); }));
  $('#opt-contrast').addEventListener('change', (e) => { prefs.contrast = e.target.checked; savePrefs(); applyPrefs(); });
  $('#opt-spacing').addEventListener('change', (e) => { prefs.spacing = e.target.checked; savePrefs(); applyPrefs(); });
  mqDark.addEventListener('change', applyPrefs);
  mqContrast.addEventListener('change', applyPrefs);

  // Annonce pour les lecteurs d'écran
  let liveTimer = 0;
  function announce(msg) {
    const l = $('#live');
    l.textContent = '';
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { l.textContent = msg; }, 60);
  }

  // ---------- État ----------
  const S = {
    idx: 0, level: null, lib: {}, circuit: { nodes: [], wires: [] },
    sel: null, inputs: {}, sim: null, simDirty: true, undo: [],
    result: null, hints: 0, tests: [], idCounter: 0,
  };
  let wiring = null; // { anchor:{n,p,dir}|null, orig:wire|null, start, cur, snap, detached }
  let dragging = null; // { id, dx, dy, snap, moved }

  function buildLib(idx) {
    const lib = { NAND: Object.assign({}, E.NAND_DEF) };
    for (let i = 0; i < idx; i++) {
      const lv = LEVELS[i];
      const sol = progress.solved[lv.id];
      if (!sol) continue;
      lib[lv.id] = { name: lv.title, label: lv.label, inputs: lv.inputs, outputs: lv.outputs, circuit: sol.circuit };
    }
    return lib;
  }
  const isUnlocked = (i) => i === 0 || !!progress.solved[LEVELS[i - 1].id];

  // Noms lisibles (utilisés par les lecteurs d'écran et le dialogue de connexions)
  function nodeName(node) {
    const def = S.lib[node.type];
    const same = S.circuit.nodes.filter((n) => n.type === node.type);
    return `${def.label} ${same.indexOf(node) + 1}`;
  }
  function endpointText(n, p, dir) {
    if (n.startsWith('in:')) return `Entrée ${p}`;
    if (n.startsWith('out:')) return `Sortie ${p}`;
    const node = S.circuit.nodes.find((x) => x.id === n);
    return node ? `${nodeName(node)}, ${dir === 'in' ? 'entrée' : 'sortie'} ${p}` : '?';
  }

  // ---------- Géométrie ----------
  const ioY = (i, n) => (H * (i + 1)) / (n + 1);
  // Portes de base dessinées avec leur symbole normalisé (largeur du dessin, hauteur 64)
  const GATE_W = { NAND: 82, non: 66, et: 72, ou: 72, xor: 80 };
  const GATE_LBL_X = { NAND: 32, non: 22, et: 32, ou: 30, xor: 40 };
  const OR_BODY = 'M0 0H20C46 0 62 14 72 32C62 50 46 64 20 64H0C14 48 14 16 0 0Z';
  function gateShape(type) {
    switch (type) {
      case 'NAND': return '<path class="body" d="M0 0H40a32 32 0 0 1 0 64H0Z"/><circle class="body" cx="77" cy="32" r="5"/>';
      case 'et': return '<path class="body" d="M0 0H40a32 32 0 0 1 0 64H0Z"/>';
      case 'non': return '<path class="body" d="M0 0L56 32L0 64Z"/><circle class="body" cx="61" cy="32" r="5"/>';
      case 'ou': return `<path class="body" d="${OR_BODY}"/><path class="stub" d="M0 20H9.3M0 44H9.3"/>`;
      case 'xor': return `<g transform="translate(8 0)"><path class="body" d="${OR_BODY}"/></g><path class="stub" d="M0 64C14 48 14 16 0 0M0 20H17.3M0 44H17.3"/>`;
      default: return '';
    }
  }
  function nodeSize(node) {
    const def = S.lib[node.type];
    if (GATE_W[node.type]) return { w: GATE_W[node.type], h: 64, def, shape: true };
    const n = Math.max(def.inputs.length, def.outputs.length, 1);
    return { w: Math.max(104, def.label.length * 10 + 56), h: n * 24 + 16, def };
  }
  function pinPos(nodeId, pin, dir) {
    if (nodeId.startsWith('in:')) return { x: 92, y: ioY(S.level.inputs.indexOf(pin), S.level.inputs.length) };
    if (nodeId.startsWith('out:')) return { x: W - 92, y: ioY(S.level.outputs.indexOf(pin), S.level.outputs.length) };
    const node = S.circuit.nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    const { w, h, def } = nodeSize(node);
    const list = dir === 'in' ? def.inputs : def.outputs;
    return { x: node.x + (dir === 'in' ? 0 : w), y: node.y + (h - list.length * 24) / 2 + 12 + list.indexOf(pin) * 24 };
  }

  // ---------- Simulation ----------
  function ensureSim() {
    if (!S.simDirty && S.sim) return;
    S.sim = E.compile(S.circuit, S.level.inputs, S.level.outputs, S.lib);
    E.setInputs(S.sim, S.inputs);
    E.settle(S.sim);
    S.simDirty = false;
  }
  const wireVal = (w) => (w && S.sim ? S.sim.v[S.sim.wireSig[w.id]] : 0);

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
    announce(`${nodeName(node)} ajouté`);
  }
  function connect(from, to) {
    if (S.circuit.wires.some((w) => w.from.n === from.n && w.from.p === from.p && w.to.n === to.n && w.to.p === to.p)) return;
    S.circuit.wires = S.circuit.wires.filter((w) => !(w.to.n === to.n && w.to.p === to.p));
    S.circuit.wires.push({ id: newId('w'), from: { n: from.n, p: from.p }, to: { n: to.n, p: to.p } });
  }
  function removeNode(id) {
    S.circuit.nodes = S.circuit.nodes.filter((n) => n.id !== id);
    S.circuit.wires = S.circuit.wires.filter((w) => w.from.n !== id && w.to.n !== id);
  }
  function deleteSelection() {
    if (!S.sel) return;
    pushUndo();
    let msg;
    if (S.sel.kind === 'node') {
      const node = S.circuit.nodes.find((n) => n.id === S.sel.id);
      msg = node ? `${nodeName(node)} supprimé` : '';
      removeNode(S.sel.id);
    } else {
      S.circuit.wires = S.circuit.wires.filter((w) => w.id !== S.sel.id);
      msg = 'Connexion supprimée';
    }
    S.sel = null;
    changed();
    announce(msg);
    // le focus était sur l'élément supprimé : on le replace sur le plan
    if (!document.activeElement || document.activeElement === document.body) $('#work').focus({ preventScroll: true });
  }
  function undo() {
    const snap = S.undo.pop();
    if (!snap) return;
    S.circuit = JSON.parse(snap);
    S.sel = null;
    changed();
    announce('Action annulée');
  }
  function toggleInput(name) {
    S.inputs[name] = S.inputs[name] ? 0 : 1;
    E.setInputs(S.sim, S.inputs);
    E.settle(S.sim);
    renderBoard();
    renderTable();
    announce(`Entrée ${name} à ${S.inputs[name]}. ` + S.level.outputs.map((o) => `${o} = ${S.sim.v[S.sim.outSig[o]]}`).join(', '));
  }

  // ---------- Rendu du plan ----------
  function curve(a, b) {
    const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
    return `M${a.x} ${a.y} C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
  }
  function pinSvg(n, p, dir, x, y, on, wired, label) {
    return `<circle class="pin-hit" data-pin="${p}" data-pnode="${n}" data-dir="${dir}" cx="${x}" cy="${y}" r="14"><title>${label}, valeur ${on ? 1 : 0}</title></circle>` +
      `<circle class="pin ${on ? 'on' : ''} ${wired ? '' : 'free'}" cx="${x}" cy="${y}" r="6"/>`;
  }
  function renderBoard() {
    ensureSim();
    const lv = S.level;
    // mémorise l'élément qui a le focus pour le lui rendre après le rendu
    let fk = null;
    const act = document.activeElement;
    if (act && svg.contains(act)) fk = act.dataset.node ? ['node', act.dataset.node] : act.dataset.toggle ? ['toggle', act.dataset.toggle] : null;

    const wiredOut = new Set(S.circuit.wires.map((w) => w.from.n + '|' + w.from.p));
    let h = '';

    for (const w of S.circuit.wires) {
      const a = pinPos(w.from.n, w.from.p, 'out'), b = pinPos(w.to.n, w.to.p, 'in');
      if (!a || !b) continue;
      const d = curve(a, b);
      const sel = S.sel && S.sel.kind === 'wire' && S.sel.id === w.id;
      h += `<path class="wire ${wireVal(w) ? 'on' : ''} ${sel ? 'sel' : ''}" d="${d}" aria-hidden="true"/>`;
      h += `<path class="wire-hit" data-wire="${w.id}" d="${d}" aria-hidden="true"/>`;
    }
    if (wiring && wiring.anchor) {
      const p = pinPos(wiring.anchor.n, wiring.anchor.p, wiring.anchor.dir);
      if (p) h += `<path class="wire preview" d="${wiring.anchor.dir === 'out' ? curve(p, wiring.cur) : curve(wiring.cur, p)}"/>`;
    }

    // Entrées du niveau (interrupteurs)
    lv.inputs.forEach((name, i) => {
      const y = ioY(i, lv.inputs.length), on = S.inputs[name] ? 1 : 0;
      h += `<g class="switch ${on ? 'on' : ''}" data-toggle="${name}" role="switch" tabindex="0" aria-checked="${!!on}" aria-label="Entrée ${name}">
        <rect class="ring" x="24" y="${y - 21}" width="72" height="42" rx="21"/>
        <text class="io-name" x="60" y="${y - 26}">${name}</text>
        <rect class="track" x="30" y="${y - 15}" width="60" height="30" rx="15"/>
        <circle class="knob" cx="${on ? 75 : 45}" cy="${y}" r="11"/>
        <text class="sw-val" x="${on ? 45 : 75}" y="${y + 4}">${on}</text>
      </g>`;
      h += pinSvg('in:' + name, name, 'out', 92, y, on, wiredOut.has('in:' + name + '|' + name), `Entrée ${name}`);
    });

    // Sorties du niveau (LED)
    lv.outputs.forEach((name, i) => {
      const y = ioY(i, lv.outputs.length);
      const w = S.circuit.wires.find((x) => x.to.n === 'out:' + name);
      const on = wireVal(w);
      h += `<g role="img" aria-label="Sortie ${name} : ${on}">
        <text class="io-name" x="${W - 60}" y="${y - 28}">${name}</text>
        <line x1="${W - 92}" y1="${y}" x2="${W - 76}" y2="${y}" stroke="var(--wire-off)" stroke-width="3"/>
        <circle class="led ${on ? 'on' : ''}" cx="${W - 60}" cy="${y}" r="16"/>
        <text class="led-val ${on ? 'on' : ''}" x="${W - 60}" y="${y + 5}">${on}</text></g>`;
      h += pinSvg('out:' + name, name, 'in', W - 92, y, on, !!w, `Sortie ${name}`);
    });

    // Composants
    for (const n of S.circuit.nodes) {
      const { w, h: hh, def, shape } = nodeSize(n);
      const sel = S.sel && S.sel.kind === 'node' && S.sel.id === n.id;
      const nm = nodeName(n);
      h += `<g class="node ${n.type === 'NAND' ? 'nand' : ''} ${sel ? 'sel' : ''}" data-node="${n.id}" transform="translate(${n.x},${n.y})"
        tabindex="0" role="button" aria-label="${nm}, ${def.inputs.length} entrées, ${def.outputs.length} sortie${def.outputs.length > 1 ? 's' : ''}. Flèches pour déplacer, Suppr pour supprimer.">
        <rect class="ring" x="-5" y="-5" width="${w + 10}" height="${hh + 10}" rx="9"/>
        <title>${def.name}</title>
        ${shape ? gateShape(n.type) + `<text class="lbl gate" x="${GATE_LBL_X[n.type]}" y="32">${def.label}</text>` : `<rect class="body" width="${w}" height="${hh}" rx="6"/><text class="lbl" x="${w / 2}" y="${hh / 2}">${def.label}</text>`}`;
      if (!shape) def.inputs.forEach((p, i) => { h += `<text class="pl" x="9" y="${(hh - def.inputs.length * 24) / 2 + 12 + i * 24}">${p}</text>`; });
      if (!shape) def.outputs.forEach((p, i) => { h += `<text class="pl" text-anchor="end" x="${w - 9}" y="${(hh - def.outputs.length * 24) / 2 + 12 + i * 24}">${p}</text>`; });
      h += '</g>';
    }
    for (const n of S.circuit.nodes) {
      const { def } = nodeSize(n);
      def.inputs.forEach((p) => {
        const pos = pinPos(n.id, p, 'in');
        const w = S.circuit.wires.find((x) => x.to.n === n.id && x.to.p === p);
        h += pinSvg(n.id, p, 'in', pos.x, pos.y, wireVal(w), !!w, endpointText(n.id, p, 'in'));
      });
      def.outputs.forEach((p) => {
        const pos = pinPos(n.id, p, 'out');
        h += pinSvg(n.id, p, 'out', pos.x, pos.y, S.sim.v[S.sim.nodeOutSig[n.id + '|' + p]], wiredOut.has(n.id + '|' + p), endpointText(n.id, p, 'out'));
      });
    }
    svg.innerHTML = h;
    $('#btn-delete').disabled = !S.sel;

    if (fk) {
      const el = svg.querySelector(`[data-${fk[0]}="${fk[1]}"]`);
      if (el) el.focus({ preventScroll: true });
    }
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
      toggleInput(tog.dataset.toggle);
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
      if (w.anchor) {
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const target = t && t.closest ? t.closest('[data-pin]') : null;
        if (target && target.dataset.dir !== w.anchor.dir) {
          const tp = { n: target.dataset.pnode, p: target.dataset.pin };
          const a = w.anchor;
          pushUndo(w.snap);
          if (a.dir === 'out') connect(a, tp); else connect(tp, a);
          changed();
          announce('Connexion créée');
          return;
        }
      }
      if (w.detached) { pushUndo(w.snap); changed(); announce('Connexion supprimée'); } else renderBoard();
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

  // Clavier sur le plan : interrupteurs, composants
  svg.addEventListener('keydown', (e) => {
    const tog = e.target.closest && e.target.closest('[data-toggle]');
    const nodeEl = e.target.closest && e.target.closest('[data-node]');
    if (tog && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleInput(tog.dataset.toggle); return; }
    if (nodeEl) {
      const n = S.circuit.nodes.find((x) => x.id === nodeEl.dataset.node);
      const step = e.shiftKey ? 50 : 10;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (n && d) {
        e.preventDefault();
        const { w, h } = nodeSize(n);
        const nx = clamp(n.x + d[0], 120, W - 120 - w), ny = clamp(n.y + d[1], 10, H - h - 10);
        if (nx !== n.x || ny !== n.y) {
          pushUndo();
          n.x = nx; n.y = ny;
          progress.drafts[S.level.id] = S.circuit; save();
          renderBoard();
        }
      }
    }
  });
  // Un composant qui reçoit le focus devient la sélection
  svg.addEventListener('focusin', (e) => {
    const nodeEl = e.target.closest && e.target.closest('[data-node]');
    if (nodeEl && !(S.sel && S.sel.kind === 'node' && S.sel.id === nodeEl.dataset.node)) {
      S.sel = { kind: 'node', id: nodeEl.dataset.node };
      renderBoard();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    const onBoard = e.target === document.body || e.target === $('#work') || svg.contains(e.target);
    if (!onBoard) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); deleteSelection(); }
    else if (e.key === 'Escape' && S.sel) { S.sel = null; renderBoard(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });

  // ---------- Panneaux ----------
  function renderPalette() {
    const box = $('#palette');
    box.innerHTML = '';
    for (const type in S.lib) {
      const def = S.lib[type];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (type === 'NAND' ? ' nand' : '');
      b.draggable = true;
      b.innerHTML = `${def.label}<small aria-hidden="true">${def.inputs.length}→${def.outputs.length}</small>`;
      b.setAttribute('aria-label', `Ajouter ${def.name} (${def.inputs.length} entrées, ${def.outputs.length} sortie${def.outputs.length > 1 ? 's' : ''})`);
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
    if (tests.length > 24) {
      if (!res) { wrap.innerHTML = `<p class="muted">${tests.length} cas à vérifier : trop pour les lister. Clique sur « Tester le circuit ».</p>`; return; }
      const bad = res.rows.map((r, i) => ({ t: tests[i], r, i })).filter((x) => !x.r.ok).slice(0, 10);
      wrap.innerHTML = bad.length ? '<p class="muted">Premiers cas en échec :</p>' + tableHtml(bad, seq) : '';
      return;
    }
    wrap.innerHTML = tableHtml(tests.map((t, i) => ({ t, r: res ? res.rows[i] : null, i })), seq);
  }
  function tableHtml(items, seq) {
    const lv = S.level;
    let h = `<table class="tt"><caption class="sr-only">Table de vérité du niveau ${lv.title}</caption><thead><tr>`;
    if (seq) h += '<th scope="col">Étape</th>';
    lv.inputs.forEach((n) => { h += `<th scope="col">${n}</th>`; });
    lv.outputs.forEach((n, i) => { h += `<th scope="col" class="${i === 0 ? 'sep' : ''}">${n}</th>`; });
    h += '</tr></thead><tbody>';
    for (const { t, r, i } of items) {
      const cur = !seq && lv.inputs.every((n) => (S.inputs[n] ? 1 : 0) === t.in[n]);
      h += `<tr class="${cur ? 'cur' : ''}"${cur ? ' aria-current="true"' : ''}>`;
      if (seq) h += `<td>${i + 1}</td>`;
      lv.inputs.forEach((n) => { h += `<td>${t.in[n]}</td>`; });
      lv.outputs.forEach((n, k) => {
        const exp = t.out[n];
        const sep = k === 0 ? 'sep ' : '';
        if (exp === undefined) h += `<td class="${sep}na">${r ? r.actual[n] : '–'}</td>`;
        else if (!r) h += `<td class="${sep}">${exp}</td>`;
        else if (r.actual[n] === exp) h += `<td class="${sep}ok">${exp}<span class="sr-only"> correct</span></td>`;
        else h += `<td class="${sep}ko">${r.actual[n]}<span aria-hidden="true"> → ${exp}</span><span class="sr-only"> incorrect, attendu ${exp}</span></td>`;
      });
      h += '</tr>';
    }
    return h + '</tbody></table>';
  }

  function resultText(r) {
    const bad = r.rows.filter((x) => !x.ok).length;
    return r.ok
      ? `Réussi : tous les cas sont corrects (${r.rows.length} sur ${r.rows.length}), ${r.nands} porte${r.nands > 1 ? 's' : ''} NAND.`
      : `Incorrect : ${bad} cas sur ${r.rows.length} ${bad > 1 ? 'sont faux' : 'est faux'}.` + (r.unstable ? ' Le circuit oscille : vérifie tes boucles.' : '');
  }
  function renderBanner() {
    const b = $('#result-banner');
    const r = S.result;
    if (!r) { b.hidden = true; return; }
    b.hidden = false;
    b.className = 'banner ' + (r.ok ? 'ok' : 'ko');
    b.textContent = (r.ok ? '✓ ' : '✗ ') + resultText(r);
  }

  function renderHints() {
    const hs = S.level.hints;
    $('#hint-list').innerHTML = hs.slice(0, S.hints).map((h) => `<li>${h}</li>`).join('');
    const btn = $('#btn-hint');
    btn.disabled = S.hints >= hs.length;
    btn.textContent = S.hints === 0 ? 'Indice' : S.hints >= hs.length ? 'Plus d’indice' : `Indice suivant (${S.hints}/${hs.length})`;
  }

  function renderHeader() {
    $('#lvl-counter').textContent = `Niveau ${S.idx + 1} sur ${LEVELS.length}`;
    const n = S.sim ? S.sim.gates.length : 0;
    $('#nand-counter').textContent = `${n} porte${n > 1 ? 's' : ''} NAND utilisée${n > 1 ? 's' : ''}`;
    $('#lvl-title').textContent = S.level.title + (progress.solved[S.level.id] ? ' (réussi)' : '');
  }

  function refresh() {
    renderBoard();
    renderHeader();
    renderTable();
    renderBanner();
    $('#btn-undo').disabled = !S.undo.length;
    if ($('#dlg-conn').open) renderConn();
  }

  // ---------- Dialogue de connexions (alternative au glisser-déposer) ----------
  function renderConn() {
    const lv = S.level;
    const src = [], dst = [];
    lv.inputs.forEach((p) => src.push({ n: 'in:' + p, p, dir: 'out' }));
    lv.outputs.forEach((p) => dst.push({ n: 'out:' + p, p, dir: 'in' }));
    for (const node of S.circuit.nodes) {
      const def = S.lib[node.type];
      def.outputs.forEach((p) => src.push({ n: node.id, p, dir: 'out' }));
      def.inputs.forEach((p) => dst.push({ n: node.id, p, dir: 'in' }));
    }
    const keep = [$('#conn-from').value, $('#conn-to').value];
    const opt = (e, k) => `<option value="${k}">${endpointText(e.n, e.p, e.dir)}</option>`;
    $('#conn-from').innerHTML = src.map((e) => opt(e, e.n + '|' + e.p)).join('');
    $('#conn-to').innerHTML = dst.map((e) => {
      const used = S.circuit.wires.find((w) => w.to.n === e.n && w.to.p === e.p);
      return `<option value="${e.n}|${e.p}">${endpointText(e.n, e.p, e.dir)}${used ? ' (déjà reliée : sera remplacée)' : ''}</option>`;
    }).join('');
    if (keep[0]) $('#conn-from').value = keep[0];
    if (keep[1]) $('#conn-to').value = keep[1];
    $('#conn-list').innerHTML = S.circuit.wires.length
      ? S.circuit.wires.map((w) => {
        const txt = `${endpointText(w.from.n, w.from.p, 'out')} → ${endpointText(w.to.n, w.to.p, 'in')}`;
        return `<li><span>${txt}</span><button type="button" class="btn small" data-delwire="${w.id}" aria-label="Supprimer la connexion : ${txt}">Supprimer</button></li>`;
      }).join('')
      : '<li class="muted">Aucune connexion pour l’instant.</li>';
    $('#comp-list').innerHTML = S.circuit.nodes.length
      ? S.circuit.nodes.map((n) => `<li><span>${nodeName(n)}</span><button type="button" class="btn small" data-delnode="${n.id}" aria-label="Supprimer ${nodeName(n)}">Supprimer</button></li>`).join('')
      : '<li class="muted">Aucun composant. Ajoute-en depuis la barre « Composants ».</li>';
  }
  function splitKey(k) { const i = k.lastIndexOf('|'); return { n: k.slice(0, i), p: k.slice(i + 1) }; }
  $('#btn-conn').addEventListener('click', () => { renderConn(); $('#dlg-conn').showModal(); });
  $('#conn-add').addEventListener('click', () => {
    if (!$('#conn-from').value || !$('#conn-to').value) return;
    const from = splitKey($('#conn-from').value), to = splitKey($('#conn-to').value);
    pushUndo();
    connect(from, to);
    changed();
    announce(`Connexion créée : ${endpointText(from.n, from.p, 'out')} vers ${endpointText(to.n, to.p, 'in')}`);
  });
  $('#dlg-conn').addEventListener('click', (e) => {
    const dw = e.target.closest('[data-delwire]'), dn = e.target.closest('[data-delnode]');
    if (!dw && !dn) return;
    pushUndo();
    if (dw) S.circuit.wires = S.circuit.wires.filter((w) => w.id !== dw.dataset.delwire);
    else { removeNode(dn.dataset.delnode); S.sel = null; }
    changed();
    announce(dw ? 'Connexion supprimée' : 'Composant supprimé');
    $('#conn-from').focus();
  });

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
    document.title = `${S.level.title} – NAND Lycée`;
    announce(`Niveau ${i + 1} : ${S.level.title}. ${S.level.desc}`);
  }

  function renderLevelList() {
    let h = '', part = '';
    LEVELS.forEach((lv, i) => {
      if (lv.part !== part) { part = lv.part; h += `<h3 class="part-title">${part}</h3>`; }
      const sol = progress.solved[lv.id], ok = isUnlocked(i);
      h += `<button type="button" class="lvl-item ${i === S.idx ? 'current' : ''}" data-i="${i}" ${ok ? '' : 'disabled'} ${i === S.idx ? 'aria-current="true"' : ''}>
        <span class="st">${sol ? '✓ Réussi' : ok ? 'À faire' : 'Verrouillé'}</span><span class="nm">${i + 1}. ${lv.title}</span>
        <span class="sc">${sol ? 'meilleur : ' + sol.best + ' NAND' : ''}</span></button>`;
    });
    $('#levels-list').innerHTML = h;
  }

  function testCircuit() {
    S.result = E.runTests(S.level, S.circuit, S.lib);
    const r = S.result;
    announce(resultText(r));
    if (r.ok) {
      const prev = progress.solved[S.level.id];
      const best = prev ? Math.min(prev.best, r.nands) : r.nands;
      progress.solved[S.level.id] = { circuit: JSON.parse(JSON.stringify(S.circuit)), nands: r.nands, best };
      save();
      refresh();
      const last = S.idx === LEVELS.length - 1;
      $('#success-title').textContent = last ? 'Tu as tout reconstruit !' : 'Bravo, niveau réussi !';
      $('#success-text').textContent =
        `Ton circuit « ${S.level.title} » utilise ${r.nands} porte${r.nands > 1 ? 's' : ''} NAND (meilleur score : ${best}). ` +
        (last ? 'À partir d’une seule porte logique, tu as construit de quoi calculer et mémoriser : les deux briques d’un processeur.'
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
    announce('Circuit effacé');
  });
  $('#btn-hint').addEventListener('click', () => {
    S.hints++; renderHints();
    announce('Indice : ' + S.level.hints[S.hints - 1]);
  });
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
  applyPrefs();
  const start = clamp(progress.current | 0, 0, LEVELS.length - 1);
  loadLevel(isUnlocked(start) ? start : 0);
  if (!progress.seenHelp) {
    progress.seenHelp = true; save();
    $('#dlg-help').showModal();
  }
})();
