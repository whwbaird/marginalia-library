// The About page's contact address: written out as "user [at] domain" in the page, and turned into a link here,
// so address scrapers that don't run scripts never see it whole.
(function () {
  'use strict';
  Array.prototype.forEach.call(document.querySelectorAll('.email[data-u][data-d]'), function (span) {
    var address = span.getAttribute('data-u') + '@' + span.getAttribute('data-d');
    var link = document.createElement('a');
    link.href = 'mailto:' + address;
    link.textContent = address;
    span.replaceWith(link);
  });
})();
