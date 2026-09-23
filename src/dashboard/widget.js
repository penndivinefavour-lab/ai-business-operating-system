/**
 * AI Business Operating System — Customer Chat Widget Embed
 * 
 * Usage on hotel website:
 * <script src="https://your-domain.com/widget.js" data-hotel="demo" async></script>
 * 
 * Or programmatically:
 * <script>
 *   window.CW_CONFIG = { hotelSlug: 'demo' };
 *   var s = document.createElement('script');
 *   s.src = 'https://your-domain.com/widget.js';
 *   s.async = true;
 *   document.body.appendChild(s);
 * </script>
 */

(function() {
  'use strict';

  // Configuration
  function getConfig() {
    if (window.CW_CONFIG) return window.CW_CONFIG;
    var scripts = document.querySelectorAll('script[src*="widget.js"]');
    if (scripts.length === 0) return { hotelSlug: 'demo' };
    var src = scripts[scripts.length - 1].src;
    var match = src.match(/[?&]hotel=([^&]+)/);
    return { hotelSlug: match ? decodeURIComponent(match[1]) : 'demo' };
  }

  var config = getConfig();

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.id = 'cw-widget-iframe';
  iframe.src = (config.apiBase || '') + '/widget.html?hotel=' + encodeURIComponent(config.hotelSlug);
  iframe.style.cssText = 'position:fixed;bottom:20px;right:20px;width:380px;height:600px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:999999;';
  iframe.setAttribute('allowtransparency', 'true');
  iframe.setAttribute('title', 'Chat avec la réception');

  // Mobile responsive
  function resize() {
    if (window.innerWidth < 480) {
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.bottom = '0';
      iframe.style.right = '0';
      iframe.style.borderRadius = '0';
    } else {
      iframe.style.width = '380px';
      iframe.style.height = '600px';
      iframe.style.bottom = '20px';
      iframe.style.right = '20px';
      iframe.style.borderRadius = '16px';
    }
  }

  window.addEventListener('resize', resize);
  
  // Append when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      document.body.appendChild(iframe);
      resize();
    });
  } else {
    document.body.appendChild(iframe);
    resize();
  }
})();
