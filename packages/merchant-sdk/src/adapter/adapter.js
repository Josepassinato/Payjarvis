/**
 * PayJarvis Adapter — Vanilla JS (standalone)
 *
 * Inject via <script src="..." data-merchant="YOUR_ID" async></script>
 * Detects BDIT tokens, calls /v1/verify, and injects a visual seal.
 */
(function () {
  "use strict";

  var merchantId = document.currentScript
    ? document.currentScript.getAttribute("data-merchant")
    : null;

  if (!merchantId) {
    console.error("[PayJarvis] data-merchant attribute required");
    return;
  }

  var API_URL =
    document.currentScript.getAttribute("data-api") ||
    "https://api.payjarvis.com";

  window.PayJarvis = {
    merchantId: merchantId,

    /**
     * Verify a BDIT token against the PayJarvis API
     */
    verify: function (token) {
      if (!token) {
        return Promise.resolve({ valid: false, reason: "No token provided" });
      }

      return fetch(API_URL + "/v1/verify", {
        method: "GET",
        headers: {
          "X-Bdit-Token": token,
          "X-Merchant-Id": merchantId,
        },
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (data.verified) {
            return { valid: true, bot: data.bot, authorization: data.authorization };
          }
          return { valid: false, reason: data.error || "Verification failed" };
        })
        .catch(function (err) {
          // Fallback: local decode (no signature verification)
          try {
            var parts = token.split(".");
            if (parts.length !== 3)
              return { valid: false, reason: "Invalid token format" };

            var payload = JSON.parse(atob(parts[1]));

            if (payload.merchant_id !== merchantId)
              return { valid: false, reason: "Merchant mismatch" };

            if (payload.exp * 1000 < Date.now())
              return { valid: false, reason: "Token expired" };

            return { valid: true, bot: payload, fallback: true };
          } catch (e) {
            return { valid: false, reason: "Parse error: " + e.message };
          }
        });
    },

    /**
     * Extract token from URL params, cookies, or headers
     */
    extractToken: function () {
      // URL parameter
      var params = new URLSearchParams(window.location.search);
      var fromUrl = params.get("payjarvis_token");
      if (fromUrl) return fromUrl;

      // Cookie
      var cookies = document.cookie.split(";");
      for (var i = 0; i < cookies.length; i++) {
        var cookie = cookies[i].trim();
        if (cookie.indexOf("__payjarvis_bdit=") === 0) {
          return cookie.substring("__payjarvis_bdit=".length);
        }
      }

      return null;
    },

    /**
     * Inject a visual verification seal into the page
     */
    injectSeal: function (containerId, result) {
      var container = document.getElementById(containerId);
      if (!container) return;

      var seal = document.createElement("div");
      seal.style.cssText =
        "display:inline-flex;align-items:center;gap:8px;padding:8px 16px;" +
        "border-radius:8px;font-family:system-ui,sans-serif;font-size:13px;";

      if (result.valid) {
        seal.style.cssText +=
          "background:#22c55e15;border:1px solid #22c55e30;color:#22c55e;";
        seal.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>' +
          "</svg>" +
          "<span>Bot Verificado — Trust Score: " +
          (result.bot.trustScore || result.bot.trust_score || "?") +
          "/100</span>";
      } else {
        seal.style.cssText +=
          "background:#ef444415;border:1px solid #ef444430;color:#ef4444;";
        seal.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>' +
          "</svg>" +
          "<span>Bot Não Verificado</span>";
      }

      container.appendChild(seal);
    },
  };

  // Auto-detect and verify on load
  var token = window.PayJarvis.extractToken();
  if (token) {
    window.PayJarvis.verify(token).then(function (result) {
      window.PayJarvis.lastResult = result;
      // Dispatch custom event
      var event = new CustomEvent("payjarvis:verified", { detail: result });
      document.dispatchEvent(event);
    });
  }
})();
