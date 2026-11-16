// Authors: sort and filter every author by what MR wrote about their works, in the reader's browser.
// It reads the browse index (data/works.json) and the author list (data/authors.json). The choices live in the URL
// (?sort=neg&by=tyler&form=fiction), so any list can be shared. Without JavaScript the page keeps its top 100.
(function () {
  'use strict';
  var root = document.getElementById('authors');
  if (!root) return;
  var PAGE = 100;
  var SORT_UNIT = { mentions: 'mention', works: 'work', rec: 'recommendation', self: 'self-recommending',
                    pos: 'positive', neg: 'negative', mixed: 'mixed' };
  var NEEDS_ONE = { rec: true, self: true, pos: true, neg: true, mixed: true };  // list only authors with at least one
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var works, people = {}, formIndex = {}, state = {}, shown = PAGE, current = [];
  var q = document.getElementById('aq'), by = document.getElementById('aby'), form = document.getElementById('aform'),
      sort = document.getElementById('asort'), list = document.getElementById('author-results'),
      more = document.getElementById('author-more'), note = document.getElementById('author-note');

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function plural(n, word) {
    if (word === 'positive' || word === 'negative' || word === 'mixed') return fmt(n) + ' ' + word;
    if (word === 'self-recommending') return fmt(n) + ' self-recommending';
    return fmt(n) + ' ' + word + (n === 1 ? '' : 's');
  }
  function norm(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/['’]/g, '').replace(/[^a-z0-9Ѐ-ӿͰ-Ͽ]+/g, ' ').trim();
  }

  Promise.all([fetch(root.getAttribute('data-works')).then(function (r) { return r.json(); }),
               fetch(root.getAttribute('data-authors')).then(function (r) { return r.json(); })])
    .then(function (res) { init(res[0], res[1]); })
    .catch(function () { /* the static top 100 stays */ });

  function init(d, authors) {
    var at = {};
    d.fields.forEach(function (name, i) { at[name] = i; });
    var formFacet = d.facets.indexOf('form');
    d.cats.forEach(function (c, i) { if (c[0] === formFacet && c[4] === 1) formIndex[c[1]] = i; });
    works = d.works.map(function (r) {
      var w = {};
      d.fields.forEach(function (name) { w[name] = r[at[name]]; });
      w.peopleList = w.people ? w.people.split(' ') : [];
      return w;
    });
    authors.forEach(function (a) { people[a[0]] = { slug: a[0], name: a[1], sort: norm(a[2]), tokens: norm(a[1]).split(' ') }; });
    var p = new URLSearchParams(location.search);
    state = { q: p.get('q') || '', by: p.get('by') || '', form: p.get('form') || '', sort: p.get('sort') || 'mentions' };
    if (['', 'tyler', 'alex'].indexOf(state.by) < 0) state.by = '';
    if (state.form && formIndex[state.form] == null) state.form = '';
    if (!(state.sort in SORT_UNIT) && state.sort !== 'recent' && state.sort !== 'name') state.sort = 'mentions';
    q.value = state.q; by.value = state.by; form.value = state.form; sort.value = state.sort;
    var timer;
    q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.q = q.value.trim(); shown = PAGE; update(); }, 120);
    });
    [[by, 'by'], [form, 'form'], [sort, 'sort']].forEach(function (pair) {
      pair[0].addEventListener('change', function () { state[pair[1]] = pair[0].value; shown = PAGE; update(); });
    });
    more.addEventListener('click', function () { shown += PAGE; render(); });
    document.getElementById('author-tools').hidden = false;
    document.getElementById('author-key').hidden = false;
    update();
  }

  function aggregate() {
    var f = state.form ? formIndex[state.form] : null, who = state.by, agg = {};
    works.forEach(function (w) {
      if (f != null && w.cats.indexOf(f) < 0) return;
      var n = who ? w['by_' + who] : w.mentions;
      if (!n) return;
      var ev = who ? w[who] : w.eval;
      var rec = who ? w['rec_' + who] : w.recommend;
      var last = who ? w['last_' + who] : w.last;
      var self = who ? w['self_' + who] : w.selfrec;
      w.peopleList.forEach(function (slug) {
        if (!people[slug]) return;
        var a = agg[slug] || (agg[slug] = { p: people[slug], works: 0, mentions: 0, rec: 0, self: 0, pos: 0, neg: 0, mixed: 0, last: '' });
        a.works++; a.mentions += n; a.rec += rec;
        if (self) a.self++;
        if (ev === 'p') a.pos++; else if (ev === 'n') a.neg++; else if (ev === 'm') a.mixed++;
        if (last > a.last) a.last = last;
      });
    });
    return Object.keys(agg).map(function (k) { return agg[k]; });
  }

  function update() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.by) p.set('by', state.by);
    if (state.form) p.set('form', state.form);
    if (state.sort !== 'mentions') p.set('sort', state.sort);
    var s = p.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));

    var rows = aggregate();
    var qt = norm(state.q).split(' ').filter(Boolean);
    if (qt.length) rows = rows.filter(function (a) {
      return qt.every(function (t) { return a.p.tokens.some(function (x) { return x.lastIndexOf(t, 0) === 0; }); });
    });
    if (NEEDS_ONE[state.sort]) rows = rows.filter(function (a) { return a[state.sort] > 0; });
    var key = state.sort;
    rows.sort(function (a, b) {
      if (key === 'name') return a.p.sort.localeCompare(b.p.sort);
      if (key === 'recent') return (b.last > a.last) - (b.last < a.last) || b.mentions - a.mentions;
      return b[key] - a[key] || b.mentions - a.mentions || a.p.sort.localeCompare(b.p.sort);
    });
    current = rows;
    render();
  }

  function render() {
    var frag = document.createDocumentFragment();
    current.slice(0, shown).forEach(function (a) {
      var li = el('li');
      var what = el('span', { 'class': 'what' });
      what.appendChild(el('a', { href: '/author/' + a.p.slug + '/' }, a.p.name));
      var bits = [plural(a.works, 'work'), plural(a.mentions, 'mention')];
      if (a.rec) bits.push(plural(a.rec, 'recommendation'));
      if (a.self) bits.push(plural(a.self, 'self-recommending'));
      var ev = [];
      if (a.pos) ev.push('+ ' + a.pos);
      if (a.mixed) ev.push('± ' + a.mixed);
      if (a.neg) ev.push('− ' + a.neg);
      if (ev.length) bits.push(ev.join(' '));
      what.appendChild(el('span', { 'class': 'meta' }, bits.join(' · ')));
      li.appendChild(what);
      var main;
      if (state.sort === 'recent') main = a.last ? MONTHS[+a.last.slice(5, 7) - 1] + ' ' + a.last.slice(0, 4) : '';
      else if (state.sort === 'name') main = plural(a.mentions, 'mention');
      else main = plural(a[state.sort], SORT_UNIT[state.sort]);
      li.appendChild(el('span', { 'class': 'counts' }, main));
      frag.appendChild(li);
    });
    list.replaceChildren(frag);
    var n = current.length;
    note.textContent = fmt(n) + (n === 1 ? ' author' : ' authors') + (n > shown ? ', showing ' + fmt(shown) : '');
    more.hidden = n <= shown;
  }
})();
