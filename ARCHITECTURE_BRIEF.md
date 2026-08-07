# Architecture Review Brief — Judo Club Cattenom

## Contexte
Demande de **revue complète d'architecture** : site principal, sous-domaines, sécurité, stabilité, performances, maintenance.

## 1. Site Principal — judo-cattenom.fr

### Stack
- **Hugo v0.123.7** (extended) — générateur statique
- **Thème personnalisé** : `jccattenom-theme` (layouts sur mesure)
- **7 pages** : Accueil, Activités, Adhésion, Boutique, Calendrier, Contact, Espace Membre
- **Formulaires** : Netlify Forms pour contact
- **Assets** : CSS/JS/Images statiques, logo, favicon
- **Déploiement** : `bash deploy.sh` → `hugo --minify` → injection clé Supabase dans pages agenda → `rsync` vers `/var/www/jccattenom`
- **Webhook auto-déploiement** : `jcc-webhook.service` (port 18789, secret GITHUB_WEBHOOK_SECRET)
- **Bot nav mobile** : fond jaune `#e2b13c`, logo centré 90px, pas d'emojis dans l'UI

### Domaines
- `judo-cattenom.fr` + `www.judo-cattenom.fr` → Caddy → Hugo

## 2. Authentification — auth.judo-cattenom.fr

### Stack
|- **Keycloak 24.0.5** (quay.io/keycloak/keycloak:24.0, patch 5 vérifié)
- **Base PostgreSQL 15** dans container dédié
- **Port** : 127.0.0.1:8082
- **Realm** : `jccattenom`
- **Clients OIDC** :
  - `jcc-frontend` → PKCE (frontend statique Hugo)
  - `wordpress` → SSO WordPress (client secret)
  - `nextcloud` → SSO Nextcloud
  - `opencloud` → SSO OpenCloud (obsolète, à supprimer)
  - `radicale` → SSO CalDAV
- **Rôles** : `bureau` (accès espace membre)
- **Theme custom** : `/opt/keycloak-theme`
- **Proxy** : `edge` mode (Caddy gère TLS)

### Clients SSO détaillés
- **Espace membre** (jcc-frontend) : PKCE flow, auth JS (`static/js/auth.js`), vérification rôle `bureau` dans JWT, session sessionStorage
- **WordPress** : plugin `daggerhart-openid-connect-generic`, création auto des utilisateurs, redirect post-login
- **Nextcloud** : OIDC app, user backend
- **OpenCloud** : obsolète (client à supprimer de Keycloak)
- **Radicale** : CalDAV avec htpasswd ou OIDC

## 3. Boutique — WordPress/WooCommerce

### Stack
|- **WordPress** (php8.2-fpm, image: wordpress:php8.2-fpm) + **MariaDB 10.11**
- **Container** : `wordpress_php_1` sur port 9001 (FPM)
- **Thème** : Astra + child theme `astra-jcc-child`
- **Plugins** :
  - WooCommerce
  - Contact Form 7
  - daggerhart-openid-connect-generic (SSO Keycloak)
  - helloasso-payments-for-woocommerce
  - Wordfence (sécurité)
  - **jcc-boutique** (plugin custom : gestion stock variables, badge "Sur commande", personnalisations)
- **API personnalisée** : `/wp-json/jcc/v1/create-payment` (création commande WC + checkout HelloAsso)
- **Coupon** : `PRIXCOUTANT` / `COMITE2026` via negative fee
- **Validation coupon** : `/wp-json/jcc/v1/validate-coupon`
- **Base** : `wp_boutique`, utilisateur `wp_boutique`
| **Debug** : WP_DEBUG désactivé (false) en prod (vérifié) — fichiers debug résiduels (jcc-debug.php, raw-db-check.php, whoami.php) supprimés le 2026-07-02. Tout .php non whitelisté → 404 via Caddy (whitelist : index.php, wp-login.php, wp-cron.php)

### Intégration HelloAsso
- **API v5** : `https://api.helloasso.com/v5/`
- **Sync service** : `/opt/jccr-infra/services/helloasso-sync/` (Python)
- **Données** : adherents.json, commandes, paiements
- **URL checkout** : HelloAsso standard + API custom bridge
- **Frontend boutique** : Le thème WordPress est inactif/remplacé par Hugo. WordPress sert uniquement de **backend WooCommerce** (API REST, commandes, gestion stock, paiements). Les pages frontend `/boutique/`, `/panier/`, `/commander/` sont servies par Hugo, qui communique avec l'API WooCommerce/WP en backend.

## 4. Cloud — gestion.judo-cattenom.fr (Supabase)

### Stack
- **Supabase** (hébergé)
- **URL** : `https://ajbpzueanpeukozjhkiv.supabase.co`
- **Clé** : injectée dynamiquement via deploy.sh dans les pages agenda/calendrier
- **Sites** : gestion des adhérents, calendrier des cours
- **App frontend** : JS vanilla (pas de framework) — hébergé sur GitHub Pages
- **Environnements** : PROD + DEV (dev.supabase.co second projet)

## 5. Cloud/Files — Nextcloud + Radicale

### Nextcloud 34
- **Image** : docker.io/library/nextcloud:34
- **Port** : 127.0.0.1:8081
- **Base** : MariaDB 10.11
- **Domaine** : nextcloud.judo-cattenom.fr
- **Volumes** : nextcloud_data, db_data
- **Migration OpenCloud abandonnée** — on reste sur Nextcloud

### Radicale (CalDAV)
- Calendrier partagé, accès htpasswd
- Collection path = login email exact (ex: `/g.c%40gmail.com/`)
- Pas de migration prévue

## 6. Infrastructure — Podman / Caddy

### Hébergement
- **VPS** : 87.106.240.214
- **OS** : Ubuntu Linux
- **Container runtime** : Podman (rootless pour les services métier)
  - Utilisateur : `hermes` (UID 1002, XDG_RUNTIME_DIR=/run/user/1002)
  - Pods : `pod_keycloak` (running), `pod_wordpress` (running), `pod_nextcloud` (running), `pod_compose` (created)

### Containers actifs
| Container | Image | Statut | Port |
|-----------|-------|--------|------|
| keycloak_keycloak-db_1 | postgres:15 | Up 12h (healthy) | - |
| keycloak_keycloak_1 | keycloak:24.0 (v24.0.5) | Up 12h (healthy) | 127.0.0.1:8082→8080 |
| nextcloud_db_1 | mariadb:10.11 | Up 12h (healthy) | - |
| nextcloud_app_1 | nextcloud:34 | Up ~1h | 127.0.0.1:8081→80 |
| wordpress_db_1 | mariadb:10.11 | Up 12h (healthy) | - |
| wordpress_php_1 | wordpress:php8.2-fpm | Up 12h (healthy) | 127.0.0.1:9001→9000 |

### Reverse proxy — Caddy
- **Version** : 2.11.4
- **Fichier** : `/etc/caddy/Caddyfile`
- **Headers sécurité** : HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **Cache** : assets versionnés = 1 an (immutable), HTML = 5 min
- **Sous-domaines** :
  - `auth.judo-cattenom.fr` → proxy 127.0.0.1:8082 (Keycloak) — HEAD intercepté (200 direct) car Keycloak retourne 405
  - `nextcloud.judo-cattenom.fr` → proxy 127.0.0.1:8081 (Nextcloud)
  - `sync.judo-cattenom.fr` → proxy 127.0.0.1:8888 (sync HelloAsso) — HEAD intercepté (200 direct) car FastAPI retourne 405
  - `jcc-deploy.judo-cattenom.fr` → proxy 127.0.0.1:18789 (webhook)
- **Routing** : Hugo static first, puis WordPress (PHP-FPM) pour /wp-*, /panier/**, /mon-compte/**, *.php

### Services systemd
- `caddy.service` → Caddy reverse proxy
- `helloasso-sync-api.service` → Sync HelloAsso <-> base locale
- `jcc-webhook.service` → Webhook GitHub auto-deploy

### Réseau
- **Réseau Podman** : `judo-net` (external: true)
- **DNS** : IONOS (API key via X-API-Key)

## 7. Backups

### Script
- **Script** : `/opt/jccr-infra/backup/backup-to-nas.sh`
- **Cron** : quotidien à 3h00 → `sudo /opt/jccr-infra/backup/backup-to-nas.sh >> /opt/jccr-infra/backup/logs/cron.log`
- **Destination** : NAS Synology (100.88.229.47:22222, clé SSH `backup_nas`)
- **Processus** : stop → dumps SQL (WP + NC + KC) → archive fichiers → rsync → start
- **Ordre** : DBs → Keycloak (60s timeout) → NC+WP → Caddy
- **Downtime** : ~1m30
- **Rétention** : 14 derniers backups
| **Restauration** : procédure documentée dans `/opt/jccr-infra/backup/RESTORATION.md` — pas testée périodiquement (risque identifié par review Fable 5)
|- **Monitoring backup** : healthchecks.io (ping en fin de script) — alerte si backup non reçu dans les 30h (period=24h, grace=6h)

## 8. Monitoring — UptimeRobot

### Configuration
- **Service** : [UptimeRobot](https://uptimerobot.com) (free plan)
- **6 monitors** : judo-cattenom.fr, Boutique (WP), Nextcloud, Auth (Keycloak), Sync HelloAsso, Gestion (Supabase)
- **Checks** : toutes les ~5 min (HEAD request)
- **Alert contacts** : Email + Discord webhook (salon général du serveur Discord JCC)

### Fixes appliqués (2026-07-02)
- **HEAD 405** : Keycloak et FastAPI retournent 405 sur HEAD. Caddy intercepter HEAD → 200 avant proxy pour Auth et Sync.
- **Alert contacts** : tous les 6 monitors ont email + Discord (au départ Auth et Sync n'avaient que l'email).

### Alertes backup
- **healthchecks.io** : ping en fin de `/opt/jccr-infra/backup/backup-to-nas.sh`
- Period=24h, Grace=6h (alerte si backup non reçu)
- Dashboard : [healthchecks.io](https://healthchecks.io) (email de notification)

## 9. Stratégie d'Updates

### État actuel
- **Hugo** v0.123.7 → installé via apt Ubuntu, pas de mise à jour automatique
- **Caddy** 2.11.4 → service systemd, binaire statique, update manuelle
- **Keycloak** 24.0 → container Docker (quay.io), nécessite arrêt/relance manuelle avec nouvelle image
- **WordPress** php8.2-fpm → mises à jour plugins/WP core via wp-admin (?)
- **MariaDB** 10.11 → containers, version figée dans docker-compose
- **Nextcloud** 34 → container, update manuelle via nouvelle image
- WP_DEBUG = false en prod (vérifié)

### Processus
- Pas de pipeline CI/CD formel pour les builds
- Webhook auto-déploy (`jcc-webhook.service`) uniquement pour le site Hugo
- Déploiement rsync → pas de rollback natif
- Pas de notification en cas de nouvelle version disponible
- Pas de stratégie de test pré-déploiement

## 10. Points de vigilance identifiés

### Sécurité
- ~~WP_DEBUG = true en production (log/danger potentiel)~~ → **résolu** (false en prod). Fichiers PHP résiduels supprimés le 2026-07-02 : `jcc-debug.php`, `raw-db-check.php`, `whoami.php`
- OIDC_CLIENT_SECRET en dur dans wp-config.php (mot de passe en clair)
- Clé Supabase injectée via sed dans deploy.sh (fragile)
- HelloAsso sync stocke données adhérents en JSON local
- Caddy `Permissions-Policy` vide (geolocation/microphone/camera désactivés mais pas de方针 sur d'autres features)
- Wordfence présent mais pas de vérification CSP

### Architecture
- WordPress ET Hugo sur le même domaine → Caddy routing complexe (redirections, rewrite)
- Nextcloud version 34
- Radicale nécessite htpasswd avec email complet comme collection path (fragile)
- ~~Pas de monitoring / alerte uptime~~ → **résolu** (2026-07-02) : **UptimeRobot** actif sur 6 monitors avec notifications Discord + email. Voir [[#Monitoring]] ci-dessous
- Pas de CDN

### Technique
- Hugo v0.123.7 (pas la dernière version)
- Déploiement rsync (pas de rollback natif)
- Injection clé Supabase = faille potentielle si agencement de fichiers change
- Pas de CI/CD pipeline formel (juste webhook → shell)
- Cache navigateur : assets immutable = bon, mais HTML 5min = faible pour un site statique
- Keycloak 24.0 (version pas la plus récente)

---

## 11. Contexte Club — Services externes

| Service | Usage | API/Intégration |
|---|---|---|
| **HelloAsso** | Adhésions, paiements en ligne, boutique | API v5, sync Python vers JSON local |
| **URSSAF CEA** | Paie des employés (Chèque Emploi Associatif) | Portail web URSSAF, pas d'API connue |
| **Basicompta** | Comptabilité du club | Logiciel externe, pas d'intégration |
| **FFJDA** | Licences sportives des adhérents | Portail FFJDA, pas d'API publique |

**Objectif** : à terme, idéalement centraliser/automatiser tout ça depuis la solution de gestion (Supabase + site Hugo) — pas nécessairement une intégration API complète (souvent impossible), mais au moins avoir un tableau de bord unique et éviter les saisies manuelles redondantes.

---

## Demande de recommandations

Au-delà de la review d'architecture, j'aimerais des **idées concrètes pour améliorer la gestion du club** :

1. **Automatisations possibles** entre HelloAsso (adhésions), FFJDA (licences), URSSAF (paie), Basicompta (compta) — même sans API officielle
2. **Centralisation** : comment faire du site Hugo/Supabase un vrai tableau de bord du club ?
3. **Gains de temps** : qu'est-ce qui est automatisable dans le processus adhésion → licence → paie ?
4. **À éviter** : propositions trop lourdes/complexes qui nécessiteraient un développeur dédié

---

**Note pour Fable 5** : Cette architecture sert un club de judo amateur (~200 membres). Les priorités sont : **simplicité de maintenance** (une seule personne, pas développeur full-time), **coût minimal** (auto-hébergé sur VPS basique), **stabilité** (pas de downtime pendant la saison sportive), **sécurité** (données personnelles adhérents, paiements HelloAsso).
