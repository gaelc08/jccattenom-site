/**
 * Shared PKCE/JWT helpers used by auth.js and any page-level admin auth
 * flow (e.g. calendar.html). Pure functions, no side effects, no DOM
 * access — loaded as a blocking script (not defer) so it is available
 * synchronously to inline page scripts that run before deferred scripts.
 */
var JCC_PKCE = (function () {

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

  return { b64url: b64url, parseJWT: parseJWT };

})();
