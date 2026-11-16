// Surprise me: a random work that matches the filters, shown as its full index card (taken from the work's own
// page) and linked to that page. Reads the browse index (data/works.json) once. The filters live in the URL
// (?form=fiction&by=tyler), so a starting point can be shared.
(function () {
  'use strict';
  var root = document.getElementById('random');
  if (!root) return;
  var STANCE = { positive: 'p', mixed: 'm', negative: 'n', no_view: '' };
  var PRESETS = {
    'tyler-novel': { form: 'fiction', by: 'tyler', eval: 'positive' },
    'alex-rec': { by: 'alex', rec: true, eval: 'any' },
    'self': { self: true, eval: 'any' },
    'old': { pub: 'pre1900', eval: 'positive' },
    'econ': { subject: 'econ', eval: 'positive' },
    'poetry': { form: 'poetry', eval: 'any' },
    'any': { eval: 'any' }
  };
  var FACETS = { form: 'form', subject: 'topic', place: 'place', period: 'period' };
  var works, catIndex = {}, state, matches = [], lastId = null;
  var ids = { form: 'r-form', subject: 'r-subject', place: 'r-place', period: 'r-period', by: 'r-by', eval: 'r-eval',
              pub: 'r-pub' };

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }
  function fmt(n) { return n.toLocaleString('en-US'); }

  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(init).catch(function () {});

  function init(d) {
    var at = {};
    d.fields.forEach(function (name, i) { at[name] = i; });
    d.cats.forEach(function (c, i) { catIndex[d.facets[c[0]] + ':' + c[1]] = i; });
    works = d.works.map(function (r) {
      var w = {};
      d.fields.forEach(function (name) { w[name] = r[at[name]]; });
      return w;
    }).filter(function (w) { return !w.own && w.kind !== 's'; });
    readUrl();
    Object.keys(ids).forEach(function (k) {
      var node = document.getElementById(ids[k]);
      node.addEventListener('change', function () { state[k] = node.value; changed(); });
    });
    [['rec', 'r-rec'], ['self', 'r-self']].forEach(function (pair) {
      var box = document.getElementById(pair[1]);
      box.addEventListener('change', function () { state[pair[0]] = box.checked; changed(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-preset]'), function (b) {
      b.addEventListener('click', function () {
        state = blank();
        var p = PRESETS[b.getAttribute('data-preset')];
        Object.keys(p).forEach(function (k) { state[k] = p[k]; });
        changed();
      });
    });
    document.getElementById('random-again').addEventListener('click', pick);
    document.getElementById('presets').hidden = false;
    document.getElementById('random-tools').hidden = false;
    document.getElementById('random-again').hidden = false;
    changed();
  }

  function blank() {
    return { form: '', subject: '', place: '', period: '', by: '', eval: 'positive', pub: '', rec: false, self: false };
  }
  function readUrl() {
    var p = new URLSearchParams(location.search);
    state = blank();
    ['form', 'subject', 'place', 'period', 'by', 'pub'].forEach(function (k) { state[k] = p.get(k) || ''; });
    if (p.has('eval')) state.eval = p.get('eval');
    state.rec = p.get('rec') === '1';
    state.self = p.get('self') === '1';
  }
  function writeUrl() {
    var p = new URLSearchParams();
    ['form', 'subject', 'place', 'period', 'by', 'pub'].forEach(function (k) { if (state[k]) p.set(k, state[k]); });
    if (state.eval !== 'positive') p.set('eval', state.eval);
    if (state.rec) p.set('rec', '1');
    if (state.self) p.set('self', '1');
    var s = p.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }
  function syncControls() {
    Object.keys(ids).forEach(function (k) { document.getElementById(ids[k]).value = state[k]; });
    document.getElementById('r-rec').checked = state.rec;
    document.getElementById('r-self').checked = state.self;
  }

  function evalOf(w) { return state.by === 'tyler' ? w.tyler : state.by === 'alex' ? w.alex : w.eval; }
  function pass(w) {
    var fs = Object.keys(FACETS);
    for (var i = 0; i < fs.length; i++) {
      var v = state[fs[i]];
      if (v) {
        var ci = catIndex[FACETS[fs[i]] + ':' + v];
        if (ci == null || w.cats.indexOf(ci) < 0) return false;
      }
    }
    if (state.by === 'tyler' && !w.by_tyler) return false;
    if (state.by === 'alex' && !w.by_alex) return false;
    if (state.eval !== 'any' && evalOf(w) !== STANCE[state.eval]) return false;
    var rec = state.by ? w['rec_' + state.by] : w.recommend;
    if (state.rec && !rec) return false;
    var self = state.by ? w['self_' + state.by] : w.selfrec;
    if (state.self && !self) return false;
    if (state.pub === 'pre1900' && !(w.year != null && w.year < 1900)) return false;
    if (state.pub === '1900s' && !(w.year != null && w.year >= 1900 && w.year < 2000)) return false;
    if (state.pub === '2000s' && !(w.year != null && w.year >= 2000)) return false;
    return true;
  }

  function changed() {
    syncControls();
    writeUrl();
    matches = works.filter(pass);
    pick();
  }

  function pick() {
    var count = document.getElementById('random-count');
    var slot = document.getElementById('random-pick');
    if (!matches.length) {
      count.textContent = 'No book matches all of these. Try fewer filters.';
      slot.replaceChildren();
      return;
    }
    var w = matches[Math.floor(Math.random() * matches.length)];
    if (matches.length > 1 && w.id === lastId) w = matches[(matches.indexOf(w) + 1) % matches.length];
    lastId = w.id;
    count.textContent = matches.length === 1 ? 'The only book that matches.' :
      'One of ' + fmt(matches.length) + ' books that match.';
    // The full card, taken from the work's own page so it is the same card
    fetch('/work/' + w.id + '/').then(function (r) { return r.text(); }).then(function (html) {
      var found = new DOMParser().parseFromString(html, 'text/html').querySelector('article.card');
      if (w.id === lastId) render(w, found);
    }).catch(function () { if (w.id === lastId) render(w, null); });
  }

  function render(w, found) {
    var slot = document.getElementById('random-pick');
    var c = found ? document.importNode(found, true) : el('article', { 'class': 'card' });
    c.classList.add('linked');
    var h2 = el('h2', { 'class': 'card-title' });
    h2.appendChild(el('a', { 'class': 'cover', href: '/work/' + w.id + '/' }, w.title));
    var h1 = c.querySelector('h1');
    if (h1) h1.replaceWith(h2); else c.appendChild(h2);
    slot.replaceChildren(c);
  }
})();
