// Browse: filters and title/author search over the whole catalog, in the reader's browser.
// The choices live in the URL (?subject=econ&by=tyler&view=positive&q=hayek), so any list can be shared.
(function () {
  'use strict';
  var root = document.getElementById('browse');
  if (!root) return;
  var PAGE = 50;
  var SIGN = { p: '+', m: '±', n: '−', '': '·' };
  var WORD = { p: 'positive', m: 'mixed', n: 'negative', '': 'no view' };
  var VIEW_PARAM = { positive: 'p', mixed: 'm', negative: 'n', none: '' };
  var KINDS = { book: 'b', series: 's', collection: 'c' };
  var KIND_LABEL = { b: 'Books', s: 'Series & sets', c: 'Collections' };
  var TREE_FACETS = ['topic', 'form', 'place', 'period'];
  var FACET_TITLE = { topic: 'Subject', form: 'Form', place: 'Place', period: 'Period' };
  var data, works, cats, slugOf = {}, catIndex = {};
  var state = {}, shown = PAGE, expanded = {};

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'hidden') node.hidden = attrs[k]; else node.setAttribute(k, attrs[k]);
    });
    if (text != null) node.textContent = text;
    return node;
  }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function norm(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/['’]/g, '').replace(/[^a-z0-9Ѐ-ӿͰ-Ͽ]+/g, ' ').trim();
  }
  function tokens(s) { return norm(s).split(' ').filter(Boolean); }

  // ------------------------------------------------------------------ load
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(init).catch(function () {
    document.getElementById('facet-lists').textContent = 'The catalog could not be loaded.';
  });

  function init(d) {
    data = d;
    var f = d.fields;
    var at = {};
    f.forEach(function (name, i) { at[name] = i; });
    cats = d.cats.map(function (c, i) {
      return { i: i, facet: d.facets[c[0]], id: c[1], label: c[2], parent: c[3], depth: c[4], kids: [] };
    });
    cats.forEach(function (c) {
      if (c.parent >= 0) cats[c.parent].kids.push(c.i);
      catIndex[c.facet + ':' + c.id] = c.i;
    });
    d.facets.forEach(function (fc, i) { slugOf[fc] = d.facet_slugs[i]; });
    works = d.works.map(function (r) {
      var w = {};
      f.forEach(function (name) { w[name] = r[at[name]]; });
      w.catSet = new Set(w.cats);
      w.titleTokens = tokens([w.title, w.subtitle].concat(w.aliases).join(' '));
      w.titleNorm = norm(w.title);
      w.authorTokens = tokens(w.authors);
      return w;
    });
    readUrl();
    buildStatic();
    update();
  }

  // ------------------------------------------------------------------ state and the URL
  function readUrl() {
    var p = new URLSearchParams(location.search);
    state = { q: p.get('q') || '', sort: p.get('sort') || '', cat: {}, by: p.get('by') || '',
              view: p.has('view') ? p.get('view') : null, viewer: p.get('viewer') || 'overall',
              rec: p.get('rec') === '1', selfrec: p.get('selfrec') === '1', kind: p.get('kind') || '', from: p.get('from') || '', to: p.get('to') || '',
              mfrom: p.get('mfrom') || '', mto: p.get('mto') || '', author: p.get('author') || '' };
    TREE_FACETS.forEach(function (fc) {
      var v = p.get(slugOf[fc]);
      if (v && catIndex[fc + ':' + v] != null) state.cat[fc] = catIndex[fc + ':' + v];
    });
    if (state.view != null && !(state.view in VIEW_PARAM)) state.view = null;
  }
  function writeUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    TREE_FACETS.forEach(function (fc) { if (state.cat[fc] != null) p.set(slugOf[fc], cats[state.cat[fc]].id); });
    ['by', 'kind', 'from', 'to', 'mfrom', 'mto', 'author'].forEach(function (k) { if (state[k]) p.set(k, state[k]); });
    if (state.view != null) p.set('view', state.view);
    if (state.view != null && state.viewer !== 'overall') p.set('viewer', state.viewer);
    if (state.rec) p.set('rec', '1');
    if (state.selfrec) p.set('selfrec', '1');
    if (state.sort) p.set('sort', state.sort);
    var s = p.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }

  // ------------------------------------------------------------------ filtering
  function yearMaskBetween(w, a, b) {
    for (var y = a; y <= b; y++) if (w.year_mask & (1 << (y - data.first_year))) return true;
    return false;
  }
  function viewOf(w) { return state.viewer === 'tyler' ? w.tyler : state.viewer === 'alex' ? w.alex : w.eval; }
  function pass(w, skip) {
    for (var k = 0; k < TREE_FACETS.length; k++) {
      var fc = TREE_FACETS[k];
      if (skip !== fc && state.cat[fc] != null && !w.catSet.has(state.cat[fc])) return false;
    }
    if (skip !== 'by' && state.by) {
      if (state.by === 'tyler' && !w.by_tyler) return false;
      if (state.by === 'alex' && !w.by_alex) return false;
      if (state.by === 'guests' && !w.by_guest) return false;
    }
    if (skip !== 'view' && state.view != null) {
      var v = viewOf(w);
      if (VIEW_PARAM[state.view] === '') { if (v !== '' || w.own) return false; if (state.viewer === 'tyler' && !w.by_tyler) return false; if (state.viewer === 'alex' && !w.by_alex) return false; }
      else if (v !== VIEW_PARAM[state.view]) return false;
    }
    if (skip !== 'rec' && state.rec && !w.recommend) return false;
    if (skip !== 'selfrec' && state.selfrec && !w.selfrec) return false;
    if (skip !== 'kind' && state.kind && w.kind !== KINDS[state.kind]) return false;
    if (state.author && (' ' + w.author_slugs + ' ').indexOf(' ' + state.author + ' ') < 0) return false;
    if (state.from && (w.year == null || w.year < +state.from)) return false;
    if (state.to && (w.year == null || w.year > +state.to)) return false;
    if (state.mfrom || state.mto) {
      if (!yearMaskBetween(w, +(state.mfrom || data.first_year), +(state.mto || data.last_year))) return false;
    }
    return true;
  }
  function editOne(a, b) {
    // true when a and b are at most one edit apart
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }
  function searchScore(w, qt, qn, fuzzy) {
    var hitTitle = 0, hitAuthor = 0;
    for (var k = 0; k < qt.length; k++) {
      var t = qt[k], found = false;
      for (var a = 0; a < w.titleTokens.length && !found; a++) {
        var x = w.titleTokens[a];
        if (x.lastIndexOf(t, 0) === 0 || (fuzzy && t.length >= 4 && editOne(t, x.slice(0, t.length + 1)) && editOne(t, x))) { found = true; hitTitle++; }
      }
      for (var b = 0; b < w.authorTokens.length && !found; b++) {
        var y = w.authorTokens[b];
        if (y.lastIndexOf(t, 0) === 0 || (fuzzy && t.length >= 4 && editOne(t, y))) { found = true; hitAuthor++; }
      }
      if (!found) return 0;
    }
    // A whole-title match wins; otherwise a book BY the person searched for beats a book with their name in its
    // title, and more-mentioned works rank higher.
    var s = 10 + 6 * Math.log(1 + w.mentions);
    if (w.titleNorm === qn) s += 100;
    else if (w.titleNorm.lastIndexOf(qn, 0) === 0) s += 15;
    if (hitAuthor === qt.length) s += 25;
    else if (hitTitle === qt.length) s += 20;
    return s;
  }

  // ------------------------------------------------------------------ the static controls
  function buildStatic() {
    var q = document.getElementById('bq');
    q.value = state.q;
    var timer;
    q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.q = q.value.trim(); shown = PAGE; update(); }, 120);
    });
    var sort = document.getElementById('sort');
    sort.value = state.sort || 'recent';
    sort.addEventListener('change', function () { state.sort = sort.value === 'recent' && !state.q ? '' : sort.value; shown = PAGE; update(); });
    document.getElementById('more').addEventListener('click', function () { shown += PAGE; renderResults(); });
  }

  function option(label, count, pressed, onClick, disabled) {
    var li = el('li');
    var b = el('button', { type: 'button', 'class': 'opt', 'aria-pressed': pressed ? 'true' : 'false' });
    b.appendChild(el('span', null, label));
    b.appendChild(el('span', { 'class': 'c' }, fmt(count)));
    if (disabled) b.disabled = true;
    b.addEventListener('click', onClick);
    li.appendChild(b);
    return li;
  }

  function treeFacet(fc, set) {
    var box = el('div', { 'class': 'facet' });
    box.appendChild(el('h2', { 'class': 'label' }, FACET_TITLE[fc]));
    var ul = el('ul');
    var sel = state.cat[fc];
    var counts = {};
    set.forEach(function (w) { w.cats.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; }); });
    var level;
    if (sel != null) {
      var chain = [];
      for (var c = sel; c >= 0; c = cats[c].parent) chain.unshift(c);
      ul.appendChild(option('All', '', false, function () { delete state.cat[fc]; shown = PAGE; update(); }));
      chain.forEach(function (ci) {
        ul.appendChild(option(cats[ci].label, counts[ci] || 0, ci === sel, function () {
          if (ci === sel) { if (cats[ci].parent >= 0) state.cat[fc] = cats[ci].parent; else delete state.cat[fc]; }
          else state.cat[fc] = ci;
          shown = PAGE; update();
        }));
      });
      level = cats[sel].kids;
    } else {
      level = cats.filter(function (c) { return c.facet === fc && c.depth === 1; }).map(function (c) { return c.i; });
    }
    var opts = level.filter(function (ci) { return counts[ci]; });
    if (fc === 'place' || (sel != null && opts.length > 12)) opts.sort(function (a, b) { return (counts[b] || 0) - (counts[a] || 0); });
    var limit = expanded[fc] ? opts.length : 12;
    var inner = sel != null ? el('ul') : ul;
    opts.slice(0, limit).forEach(function (ci) {
      inner.appendChild(option(cats[ci].label, counts[ci], false, function () { state.cat[fc] = ci; shown = PAGE; update(); }));
    });
    if (sel != null && opts.length) { var li = el('li'); li.appendChild(inner); ul.appendChild(li); }
    box.appendChild(ul);
    if (opts.length > limit) {
      var more = el('button', { type: 'button', 'class': 'expand' }, 'Show all ' + opts.length);
      more.addEventListener('click', function () { expanded[fc] = true; update(); });
      box.appendChild(more);
    }
    return box;
  }

  function choiceFacet(title, key, choices, skip) {
    var base = works.filter(function (w) { return pass(w, skip); });
    var box = el('div', { 'class': 'facet' });
    box.appendChild(el('h2', { 'class': 'label' }, title));
    var ul = el('ul');
    choices.forEach(function (ch) {
      var n = base.filter(ch.test).length;
      var on = state[key] === ch.value;
      ul.appendChild(option(ch.label, n, on, function () {
        state[key] = on ? (key === 'view' ? null : '') : ch.value; shown = PAGE; update();
      }, !n && !on));
    });
    box.appendChild(ul);
    return box;
  }

  function rangeFacet(title, fromKey, toKey, min, max, asSelect) {
    var box = el('div', { 'class': 'facet' });
    box.appendChild(el('h2', { 'class': 'label' }, title));
    var row = el('div', { 'class': 'row-pair' });
    function input(key, label) {
      var id = 'r-' + key;
      row.appendChild(el('label', { 'for': id }, label));
      var inp;
      if (asSelect) {
        inp = el('select', { id: id });
        inp.appendChild(el('option', { value: '' }, 'any'));
        for (var y = min; y <= max; y++) inp.appendChild(el('option', { value: String(y) }, String(y)));
      } else {
        inp = el('input', { id: id, type: 'number', inputmode: 'numeric', placeholder: 'any', step: '1' });
      }
      inp.value = state[key];
      inp.addEventListener('change', function () { state[key] = inp.value.trim(); shown = PAGE; update(); });
      row.appendChild(inp);
    }
    input(fromKey, 'from');
    input(toKey, 'to');
    box.appendChild(row);
    return box;
  }

  function renderFacets(set) {
    var lists = document.getElementById('facet-lists');
    var frag = document.createDocumentFragment();
    TREE_FACETS.forEach(function (fc) { frag.appendChild(treeFacet(fc, set)); });
    frag.appendChild(choiceFacet('Mentioned by', 'by', [
      { label: 'Tyler Cowen', value: 'tyler', test: function (w) { return w.by_tyler > 0; } },
      { label: 'Alex Tabarrok', value: 'alex', test: function (w) { return w.by_alex > 0; } },
      { label: 'Guest writers', value: 'guests', test: function (w) { return w.by_guest > 0; } }], 'by'));
    var viewBox = choiceFacet("MR's evaluation", 'view', [
      { label: '+ Positive', value: 'positive', test: function (w) { return viewOf(w) === 'p'; } },
      { label: '± Mixed', value: 'mixed', test: function (w) { return viewOf(w) === 'm'; } },
      { label: '− Negative', value: 'negative', test: function (w) { return viewOf(w) === 'n'; } },
      { label: '· No view stated', value: 'none', test: function (w) { return viewOf(w) === '' && !w.own && (state.viewer !== 'tyler' || w.by_tyler) && (state.viewer !== 'alex' || w.by_alex); } }], 'view');
    var whose = el('div', { 'class': 'row-pair', style: 'margin-top: 8px' });
    whose.appendChild(el('label', { 'for': 'viewer' }, 'Whose'));
    var sel = el('select', { id: 'viewer', style: 'width: auto' });
    [['overall', 'Overall'], ['tyler', "Tyler's"], ['alex', "Alex's"]].forEach(function (o) {
      sel.appendChild(el('option', { value: o[0] }, o[1]));
    });
    sel.value = state.viewer;
    sel.addEventListener('change', function () { state.viewer = sel.value; shown = PAGE; update(); });
    whose.appendChild(sel);
    viewBox.appendChild(whose);
    var rec = el('label', { 'class': 'check' });
    var box = el('input', { type: 'checkbox' });
    box.checked = state.rec;
    box.addEventListener('change', function () { state.rec = box.checked; shown = PAGE; update(); });
    rec.appendChild(box);
    rec.appendChild(document.createTextNode(' Recommended at least once (' + fmt(works.filter(function (w) { return pass(w, 'rec') && w.recommend; }).length) + ')'));
    viewBox.appendChild(rec);
    // Tyler's "self-recommending": the author or the subject is reason enough to read it
    var selfLabel = el('label', { 'class': 'check' });
    var selfBox = el('input', { type: 'checkbox' });
    selfBox.checked = state.selfrec;
    selfBox.addEventListener('change', function () { state.selfrec = selfBox.checked; shown = PAGE; update(); });
    selfLabel.appendChild(selfBox);
    selfLabel.appendChild(document.createTextNode(' Called \u201cself-recommending\u201d (' + fmt(works.filter(function (w) { return pass(w, 'selfrec') && w.selfrec; }).length) + ')'));
    viewBox.appendChild(selfLabel);
    frag.appendChild(viewBox);
    frag.appendChild(choiceFacet('Kind', 'kind', Object.keys(KINDS).map(function (k) {
      return { label: KIND_LABEL[KINDS[k]], value: k, test: function (w) { return w.kind === KINDS[k]; } };
    }), 'kind'));
    frag.appendChild(rangeFacet('First published', 'from', 'to'));
    frag.appendChild(rangeFacet('Mentioned on MR', 'mfrom', 'mto', data.first_year, data.last_year, true));
    lists.replaceChildren(frag);
  }

  // ------------------------------------------------------------------ results
  var current = [];
  function update() {
    writeUrl();
    var set = works.filter(function (w) { return pass(w, null); });
    var qt = tokens(state.q), qn = norm(state.q), scores = null;
    if (qt.length) {
      scores = new Map();
      var fuzzyNeeded = true;
      set.forEach(function (w) { var s = searchScore(w, qt, qn, false); if (s) { scores.set(w, s); fuzzyNeeded = false; } });
      if (fuzzyNeeded) set.forEach(function (w) { var s = searchScore(w, qt, qn, true); if (s) scores.set(w, s - 5); });
      set = set.filter(function (w) { return scores.has(w); });
    }
    var sort = state.sort || (qt.length ? 'match' : 'recent');
    var bySort = {
      match: function (a, b) { return scores.get(b) - scores.get(a); },
      recent: function (a, b) { return (b.last > a.last) - (b.last < a.last) || b.mentions - a.mentions; },
      mentions: function (a, b) { return b.mentions - a.mentions || ((b.last > a.last) - (b.last < a.last)); },
      first: function (a, b) { return (a.first > b.first) - (a.first < b.first); },
      title: function (a, b) { return a.titleNorm.localeCompare(b.titleNorm); },
      'year-new': function (a, b) { return (b.year == null ? -1e9 : b.year) - (a.year == null ? -1e9 : a.year); },
      'year-old': function (a, b) { return (a.year == null ? 1e9 : a.year) - (b.year == null ? 1e9 : b.year); }
    };
    set.sort(bySort[sort] || bySort.recent);
    var sortSel = document.getElementById('sort');
    var hasMatch = sortSel.querySelector('option[value="match"]');
    if (qt.length && !hasMatch) sortSel.insertBefore(el('option', { value: 'match' }, 'Best match'), sortSel.firstChild);
    if (!qt.length && hasMatch) hasMatch.remove();
    sortSel.value = sort;
    current = set;
    renderFacets(set);
    renderChosen();
    renderResults();
  }

  function renderChosen() {
    var box = document.getElementById('chosen');
    var chips = [];
    function chip(label, clear) { chips.push([label, clear]); }
    if (state.q) chip('“' + state.q + '”', function () { state.q = ''; document.getElementById('bq').value = ''; });
    TREE_FACETS.forEach(function (fc) {
      if (state.cat[fc] != null) chip(FACET_TITLE[fc] + ': ' + cats[state.cat[fc]].label, function () { delete state.cat[fc]; });
    });
    if (state.author) chip('Author: ' + state.author.replace(/-/g, ' '), function () { state.author = ''; });
    if (state.by) chip('Mentioned by ' + { tyler: 'Tyler', alex: 'Alex', guests: 'guests' }[state.by], function () { state.by = ''; });
    if (state.view != null) chip((state.viewer === 'overall' ? "MR's" : state.viewer === 'tyler' ? "Tyler's" : "Alex's") + ' evaluation: ' + (state.view === 'none' ? 'none' : state.view), function () { state.view = null; });
    if (state.rec) chip('Recommended', function () { state.rec = false; });
    if (state.selfrec) chip('Self-recommending', function () { state.selfrec = false; });
    if (state.kind) chip(KIND_LABEL[KINDS[state.kind]], function () { state.kind = ''; });
    if (state.from || state.to) chip('Published ' + (state.from || '…') + '–' + (state.to || '…'), function () { state.from = state.to = ''; });
    if (state.mfrom || state.mto) chip('Mentioned ' + (state.mfrom || '…') + '–' + (state.mto || '…'), function () { state.mfrom = state.mto = ''; });
    var frag = document.createDocumentFragment();
    chips.forEach(function (c) {
      var b = el('button', { type: 'button', 'aria-label': 'Remove ' + c[0] }, c[0] + ' ×');
      b.addEventListener('click', function () { c[1](); shown = PAGE; update(); });
      frag.appendChild(b);
    });
    if (chips.length > 1) {
      var all = el('button', { type: 'button' }, 'Clear all');
      all.addEventListener('click', function () {
        state = { q: '', sort: '', cat: {}, by: '', view: null, viewer: 'overall', rec: false, selfrec: false, kind: '', from: '', to: '', mfrom: '', mto: '', author: '' };
        document.getElementById('bq').value = '';
        shown = PAGE; update();
      });
      frag.appendChild(all);
    }
    box.replaceChildren(frag);
  }

  function renderResults() {
    var ul = document.getElementById('results');
    var frag = document.createDocumentFragment();
    current.slice(0, shown).forEach(function (w) {
      var li = el('li');
      li.appendChild(el('span', { 'class': 'shelf' }, w.shelfmark));
      var v = viewOf(w);
      li.appendChild(el('span', { 'class': 'sign' + (v === 'n' ? ' negative' : ''), title: WORD[v], 'aria-label': WORD[v] }, SIGN[v]));
      var what = el('span', { 'class': 'what' });
      what.appendChild(el('a', { href: '/work/' + w.id + '/' }, w.title));
      var bits = [];
      if (w.authors) bits.push(w.authors);
      if (w.year != null) bits.push(w.year < 0 ? (-w.year) + ' BCE' : String(w.year));
      if (w.recommend) bits.push('recommended' + (w.recommend > 1 ? ' ×' + w.recommend : ''));
      if (w.selfrec) bits.push('self-recommending');
      what.appendChild(el('span', { 'class': 'meta' }, bits.join(' · ')));
      li.appendChild(what);
      li.appendChild(el('span', { 'class': 'counts' }, fmt(w.mentions) + (w.mentions === 1 ? ' mention' : ' mentions')));
      frag.appendChild(li);
    });
    ul.replaceChildren(frag);
    var n = current.length;
    document.getElementById('result-count').textContent = fmt(n) + (n === 1 ? ' work' : ' works') + (n > shown ? ', showing ' + fmt(Math.min(shown, n)) : '');
    document.getElementById('more').hidden = n <= shown;
  }
})();
