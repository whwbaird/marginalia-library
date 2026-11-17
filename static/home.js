// The home page's "Pull a card at random": swaps the card for a random work MR's evaluation of is positive.
(function () {
  'use strict';
  var button = document.getElementById('pull-another');
  var slot = document.getElementById('random-card');
  if (!button || !slot) return;
  var SIGN = { p: '+', m: '±', n: '−', '': '·' };
  var cards = null;

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }

  function render(c) {
    // [id, title, subtitle, authors, year, shelfmark, tyler, alex, mentions, first year, last year, recommends, topic,
    //  self-recommending]
    var card = el('article', { 'class': 'card mini-card' });
    var head = el('div', { 'class': 'card-head' });
    head.appendChild(el('span', null, c[5]));
    head.appendChild(el('span', null, 'No. ' + c[0]));
    card.appendChild(head);
    card.appendChild(el('div', { 'class': 'card-rule' }));
    if (c[13] > 0) card.appendChild(el('span', { 'class': 'stamp' }, 'SELF-RECOMMENDING'));
    else if (c[11] > 0) card.appendChild(el('span', { 'class': 'stamp' }, 'RECOMMENDED' + (c[11] > 1 ? ' ×' + c[11] : '')));
    card.appendChild(el('a', { 'class': 'title', href: '/work/' + c[0] + '/' }, c[1]));
    if (c[2]) card.appendChild(el('p', { 'class': 'subtitle' }, c[2]));
    card.appendChild(el('p', { 'class': 'byline' }, [c[3], c[4]].filter(Boolean).join(', ')));
    var view = '+ positive';
    var who = [];
    if (c[6]) who.push('Tyler ' + SIGN[c[6]]);
    if (c[7]) who.push('Alex ' + SIGN[c[7]]);
    if (who.length) view += ' (' + who.join(', ') + ')';
    var span = c[9] === c[10] ? c[9] : c[9] + ' to ' + c[10];
    var rows = [['EVALUATION', view], ['MENTIONS', c[8] + ', ' + span]];
    if (c[12]) rows.push(['TOPIC', c[12]]);
    var dl = el('dl', { 'class': 'fields' });
    rows.forEach(function (r) {
      var d = el('div');
      d.appendChild(el('dt', null, r[0]));
      d.appendChild(el('dd', null, r[1]));
      dl.appendChild(d);
    });
    card.appendChild(dl);
    slot.replaceChildren(card);
  }

  function pull() {
    if (cards) { render(cards[Math.floor(Math.random() * cards.length)]); return; }
    button.disabled = true;
    fetch('/data/cards.json').then(function (r) { return r.json(); }).then(function (data) {
      cards = data;
      button.disabled = false;
      pull();
    }).catch(function () { button.disabled = false; });
  }

  // The first card: a random one from the sample inline in the page (the page's own card stays without JavaScript).
  try {
    var sample = JSON.parse(document.getElementById('card-sample').textContent);
    if (sample.length) render(sample[Math.floor(Math.random() * sample.length)]);
  } catch (e) { /* keep the page's card */ }
  slot.classList.remove('pending');
  button.hidden = false;
  button.addEventListener('click', pull);
})();
