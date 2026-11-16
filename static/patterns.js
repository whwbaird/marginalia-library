// Patterns: long lists start with ten rows and a button for the rest, and the pile-to-read list can be sorted.
// Without JavaScript every row shows, in its first order.
(function () {
  'use strict';
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  each(document.querySelectorAll('[data-show]'), function (list) {
    var n = +list.getAttribute('data-show');
    var noun = list.getAttribute('data-noun') || 'rows';
    if (list.children.length <= n) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-quiet show-all';
    button.textContent = 'SHOW ALL ' + list.children.length + ' ' + noun.toUpperCase();
    function apply() {
      var open = list.getAttribute('data-open') === '1';
      each(list.children, function (li, i) { li.hidden = !open && i >= n; });
      button.hidden = open;
    }
    button.addEventListener('click', function () { list.setAttribute('data-open', '1'); apply(); });
    list.parentNode.insertBefore(button, list.nextSibling);
    list.applyLimit = apply;
    apply();
  });

  each(document.querySelectorAll('[data-sort-for]'), function (bar) {
    var list = document.getElementById(bar.getAttribute('data-sort-for'));
    if (!list) return;
    bar.hidden = false;
    var buttons = bar.querySelectorAll('button');
    each(buttons, function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-sort');
        var rows = Array.prototype.slice.call(list.children);
        rows.sort(function (x, y) {
          var byDate = x.dataset.first < y.dataset.first ? -1 : x.dataset.first > y.dataset.first ? 1 : 0;
          if (key === 'first') return byDate;
          var d = (+x.dataset.days) - (+y.dataset.days);
          return (key === 'days' ? d : -d) || byDate;
        });
        rows.forEach(function (li) { list.appendChild(li); });
        each(buttons, function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        if (list.applyLimit) list.applyLimit();
      });
    });
  });
})();
