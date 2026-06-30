/**
 * PKCE Keycloak Auth for JCC Static Site
 * 
 * Flow:
 * 1. User clicks "Se connecter" → redirect to Keycloak with PKCE
 * 2. Keycloak redirects back with ?code=...&state=...
 * 3. JS exchanges code for tokens at Keycloak /token endpoint
 * 4. JWT is decoded, role checked, session stored in sessionStorage
 * 5. On every page load, session is restored silently
 * 6. Protected menu items shown/hidden based on role
 */

var JCC_AUTH = (function () {

  var KC_URL    = 'https://auth.judo-cattenom.fr';
  var KC_REALM  = 'jccattenom';
  var KC_CLIENT = 'jcc-frontend';
  var KC_ROLE   = 'bureau';

  // ── Helpers ──

  function b64url(buf) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function parseJWT(token) {
    try {
      return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (e) {
      return null;
    }
  }

  function getCurrentUrl() {
    var url = window.location.protocol + '//' + window.location.host + window.location.pathname;
    // Remove trailing slash for consistency
    if (url.endsWith('/')) url = url.slice(0, -1);
    return url;
  }

  // ── Public API ──

  return {

    /**
     * Initiate PKCE login: redirect to Keycloak
     * @param {string} [redirectUrl] - Where to return after login (default: current page)
     */
    login: function (redirectUrl) {
      var rurl = redirectUrl || getCurrentUrl();
      var verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
      var state = b64url(crypto.getRandomValues(new Uint8Array(16)));

      sessionStorage.setItem('jcc_pkce_v', verifier);
      sessionStorage.setItem('jcc_pkce_s', state);
      sessionStorage.setItem('jcc_redirect', rurl);

      crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (buf) {
        var params = new URLSearchParams({
          client_id: KC_CLIENT,
          redirect_uri: rurl,
          response_type: 'code',
          scope: 'openid profile email',
          state: state,
          code_challenge: b64url(buf),
          code_challenge_method: 'S256'
        });
        window.location.href = KC_URL + '/realms/' + KC_REALM + '/protocol/openid-connect/auth?' + params;
      });
    },

    /**
     * Logout: clear session and redirect to Keycloak logout
     */
    logout: function () {
      var idToken = sessionStorage.getItem('jcc_id_token') || '';
      sessionStorage.clear();
      var params = new URLSearchParams({
        client_id: KC_CLIENT,
        post_logout_redirect_uri: getCurrentUrl()
      });
      if (idToken) {
        params.set('id_token_hint', idToken);
      }
      window.location.href = KC_URL + '/realms/' + KC_REALM + '/protocol/openid-connect/logout?' + params;
    },

    /**
     * Check if the current page load is a Keycloak callback
     * If yes, exchange code for token and return true
     * If no, return false
     */
    handleCallback: function () {
      var p = new URLSearchParams(window.location.search);
      var code = p.get('code');
      var state = p.get('state');

      if (!code || state !== sessionStorage.getItem('jcc_pkce_s')) {
        return false;
      }

      var rurl = sessionStorage.getItem('jcc_redirect') || getCurrentUrl();
      var verifier = sessionStorage.getItem('jcc_pkce_v');

      // Clean up PKCE state
      sessionStorage.removeItem('jcc_pkce_v');
      sessionStorage.removeItem('jcc_pkce_s');
      sessionStorage.removeItem('jcc_redirect');

      if (!verifier) return false;

      var body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KC_CLIENT,
        redirect_uri: rurl,
        code: code,
        code_verifier: verifier
      });

      // Exchange code for token
      var self = this;
      fetch(KC_URL + '/realms/' + KC_REALM + '/protocol/openid-connect/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })
      .then(function (r) { return r.json(); })
      .then(function (tok) {
        var payload = parseJWT(tok.access_token);
        var roles = (payload && payload.realm_access && payload.realm_access.roles) || [];
        var hasRole = roles.indexOf(KC_ROLE) >= 0;

        if (hasRole) {
          sessionStorage.setItem('jcc_token', tok.access_token);
          sessionStorage.setItem('jcc_id_token', tok.id_token || '');
          sessionStorage.setItem('jcc_user', JSON.stringify({
            name: payload.name || payload.preferred_username || '',
            email: payload.email || '',
            sub: payload.sub
          }));
        }

        // Clear URL params and redirect
        history.replaceState({}, '', rurl);

        if (!hasRole) {
          alert('Accès refusé : vous devez être membre du bureau pour accéder à cet espace.');
        }

        // Dispatch event so other scripts can react
        window.dispatchEvent(new CustomEvent('jcc-auth-changed', {
          detail: { authenticated: hasRole, role: KC_ROLE }
        }));
      })
      .catch(function (err) {
        console.error('JCC Auth: Token exchange failed', err);
        history.replaceState({}, '', rurl);
      });

      return true; // callback was handled (async)
    },

    /**
     * Restore session from sessionStorage
     * Returns { authenticated: bool, user: object|null, token: string|null }
     */
    restoreSession: function () {
      var token = sessionStorage.getItem('jcc_token');
      if (!token) {
        return { authenticated: false, user: null, token: null };
      }

      var payload = parseJWT(token);
      if (!payload) {
        sessionStorage.removeItem('jcc_token');
        return { authenticated: false, user: null, token: null };
      }

      // Check expiration
      var now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now) {
        // Token expired — try silent refresh via iframe? For now just clear
        sessionStorage.removeItem('jcc_token');
        sessionStorage.removeItem('jcc_id_token');
        sessionStorage.removeItem('jcc_user');
        return { authenticated: false, user: null, token: null };
      }

      // Verify bureau role
      var roles = (payload.realm_access && payload.realm_access.roles) || [];
      if (roles.indexOf(KC_ROLE) < 0) {
        sessionStorage.removeItem('jcc_token');
        return { authenticated: false, user: null, token: null };
      }

      var userJson = sessionStorage.getItem('jcc_user');
      var user = null;
      try { user = JSON.parse(userJson); } catch (e) { /* ignore */ }

      return {
        authenticated: true,
        user: user || { name: payload.name || payload.preferred_username },
        token: token,
        payload: payload
      };
    },

    /**
     * Update protected menu visibility based on auth state
     * Should be called on every page load after restoreSession
     */
    updateUI: function () {
      var session = this.restoreSession();
      var els = document.querySelectorAll('[data-jcc-auth]');

      els.forEach(function (el) {
        var required = el.getAttribute('data-jcc-auth');
        if (required === 'true') {
          el.style.display = session.authenticated ? '' : 'none';
        } else if (required === 'false') {
          el.style.display = session.authenticated ? 'none' : '';
        }
      });

      // Update user display
      var userEls = document.querySelectorAll('[data-jcc-user]');
      userEls.forEach(function (el) {
        el.textContent = session.user ? session.user.name || session.user.email : '';
      });

      return session;
    }

  };

})();

// ── Auto-init on page load ──
(function () {
  // Handle Keycloak callback if present
  var isCallback = JCC_AUTH.handleCallback();

  if (!isCallback) {
    // Normal page load: restore session and update UI
    JCC_AUTH.updateUI();
  }
})();
