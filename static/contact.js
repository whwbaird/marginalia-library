// The contact address: written out as "user [at] domain" on the About page, and split over two attributes in the
// "Let me know" links on work and author pages, then put together here, so address scrapers that don't run scripts
// never see it whole. A report link becomes an email whose subject names the record and whose body starts with the
// page's address, so every report says which record it means.
(function () {
  'use strict';
  Array.prototype.forEach.call(document.querySelectorAll('.email[data-u][data-d]'), function (span) {
    var address = span.getAttribute('data-u') + '@' + span.getAttribute('data-d');
    var link = document.createElement('a');
    link.href = 'mailto:' + address;
    link.textContent = address;
    span.replaceWith(link);
  });
  Array.prototype.forEach.call(document.querySelectorAll('a.report[data-u][data-d]'), function (link) {
    var address = link.getAttribute('data-u') + '@' + link.getAttribute('data-d');
    var page = location.origin + location.pathname;
    link.href = 'mailto:' + address + '?subject=' + encodeURIComponent(link.getAttribute('data-subject') || 'Marginalia Library') +
      '&body=' + encodeURIComponent('Page: ' + page + '\n\nWhat is wrong:\n\n');
  });
})();
