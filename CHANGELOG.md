# jccr-site — Changelog

## v1.0.0 (2026-07-08)
Première version paramétrée. Auto-détection test/prod.

### Changements
- **auth.js** : `KC_URL` détecté depuis `window.location.hostname`
- **baseof.html** : wp-login URLs via `hasPrefix .Site.BaseURL`
- **calendar.html** : KC_URL + REDIRECT_URI auto-détectés
- **espace-membre/list.html** : wp-login URL auto-détectée
- **VERSION + CHANGELOG** ajoutés

### Avant
URLs prod codées en dur dans les layouts et JS.
Sync prod→test cassait tout.

### Après
Le même code fonctionne en test et prod.
Détection automatique via le hostname.
