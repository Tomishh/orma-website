# Orma agencement — site vitrine

Site monopage d'**Orma agencement** (« Orma »), ébéniste / agenceur haut de gamme. Image sobre et luxueuse.
Contenu entièrement géré dans Strapi, front en Astro (SSR), hébergement Docker. Site **uniquement en français**.

Domaine de production : **https://orma.tomish.fr**

## Architecture

```
navigateur ──► apache (80/443, Let's Encrypt via mod_md, HTTP → HTTPS)
                 ├─ orma.tomish.fr      ──► astro:4321   (front SSR, Node standalone)
                 └─ strapi.tomish.fr    ──► strapi:1337  (admin + API)
astro ──(réseau docker « strapi », http://strapi:1337)──► strapi ──► postgres:5432
```

| Dossier / fichier      | Rôle |
|------------------------|------|
| `astro/`               | Front Astro 7, `output: 'server'`, adaptateur `@astrojs/node` (standalone) |
| `strapi-app/`          | CMS Strapi 5 (Postgres) |
| `Dockerfile`           | Image Strapi (lancée en `develop`) |
| `astro/Dockerfile`     | Image du front (build multi-étapes, `node dist/server/entry.mjs`) |
| `docker-compose.yml`   | postgres + strapi + astro + apache sur le réseau `strapi` |
| `apache/httpd.conf`    | Reverse proxy Apache : vhosts, TLS, certificats Let's Encrypt (mod_md, volume `apache_md`) |
| `.env` (non versionné) | Secrets Postgres (`POSTGRES_*`, `STRAPI_TOKEN` optionnel), voir `.env.example` |
| `strapi-app/.env` (non versionné) | Secrets Strapi + `DATABASE_*` (doivent correspondre à `POSTGRES_*`) |
| `orma.svg`             | Logo source (noir). Copies : `astro/src/assets/orma.svg` (`currentColor`), `astro/public/favicon.svg` (doré) |

### Ports

| Port | Service | Exposition |
|------|---------|------------|
| 80 / 443 | apache | public (80 : défis ACME + redirection vers 443) |
| 4321 | Astro | `127.0.0.1` seulement (accès public via apache) |
| 1337 | Strapi (admin + API) | `127.0.0.1` seulement (accès public via apache) |
| 5432 | Postgres | `127.0.0.1` seulement, jamais public |

En production derrière le proxy, renseigner dans `strapi-app/.env` : `PUBLIC_URL=https://strapi.tomish.fr` et `IS_PROXIED=true`.

## Modèle de contenu Strapi

- **Article** (`api::article.article`) : les réalisations. `title`, `slug` (UID depuis le titre), `date` (obligatoire, sert au tri et à l'affichage), `photos` (images uniquement, multiples), `description`. Draft & publish.
- **Membre de l'équipe** (`api::team-member.team-member`) : `firstName`, `lastName`, `role`, `photo`, `bio`, `order` (tri croissant).
- **Accueil** (`api::homepage.homepage`, single type) : `shortName` (Orma), `fullName` (Orma agencement), `tagline`, `introduction`, `photos`, `email`, `phone`, `address`.

Les permissions publiques en lecture (`find` / `findOne`) sont accordées automatiquement au démarrage par `strapi-app/src/index.ts` : rien à cocher dans l'admin.

## Front Astro (`astro/src`)

- `lib/strapi.ts` : client REST (URL via `astro:env` → `STRAPI_URL`, token optionnel `STRAPI_TOKEN`), types, `srcset`, formatage des dates.
- `pages/index.astro` : la monopage. Sections Accueil (`#accueil`), Réalisations (`#realisations`), Équipes (`#equipes`), Contact (`#contact`).
- `pages/realisations/[slug].astro` : page détail partageable (galerie, lightbox, bouton Partager, balises OpenGraph). Repli sur le `documentId` si l'article n'a pas de slug.
- `pages/equipe.astro` : toute l'équipe, dans l'ordre du champ `order`.
- `pages/partials/realisations.astro` : fragment HTML chargé par le bouton « Afficher plus » (`?start=&limit=`).
- `pages/uploads/[...path].ts` : proxy des médias Strapi, pour que les images soient servies depuis le domaine du site.
- Composants : `Nav` (barre horizontale fixe ≥ 1024 px, menu plein écran en dessous), `Hero`, `Works` + `WorkCard` + `PhotoStack` (cartes photo empilées : la 1re au-dessus, 2 max qui dépassent en dessous), `Team` + `TeamCard` (carrousel en scroll-snap), `Contact`, `Footer`.

### Règles d'affichage

- Réalisations triées par le **champ `date`** saisi dans Strapi (`date:desc`, puis `publishedAt:desc`), la plus récente en premier. Date affichée au format « 30 septembre 2026 » (repli sur la date de publication si `date` est vide).
- « Afficher plus » ajoute **3 cartes (mobile < 640 px), 6 (tablette < 1024 px) ou 9 (ordinateur)** par clic.
- Charte : fond anthracite `#141517` ; titres et noms en **Playfair Display** doré `#c6a15b` ; textes en **Plus Jakarta Sans** blanc `#f2eee7` ou ocre `#c9965f`. Polices auto-hébergées (fontsource). La palette reste **provisoire** : les jetons sont dans `astro/src/styles/global.css` (`:root`).

## Commandes

```bash
docker compose up -d --build            # tout le projet
docker compose up -d --build astro      # reconstruire le front seul
cd astro && npm run dev                 # front en dev (STRAPI_URL=http://localhost:1337 par défaut)
cd astro && npx astro check && npm run build
```

## État d'avancement

### Fait
- [x] Nettoyage des secrets : mot de passe Postgres déplacé de `docker-compose.yml` vers `.env` (non versionné), `.gitignore` racine, Postgres limité à `127.0.0.1`.
- [x] Strapi : slug sur Article, photos limitées aux images, collections Membre de l'équipe et Accueil, permissions publiques automatiques, prise en charge d'un reverse proxy (`PUBLIC_URL`, `IS_PROXIED`).
- [x] Front Astro SSR : monopage, navbar verticale / menu pop-over, accueil, mosaïque des réalisations + « Afficher plus », carrousel équipe + page `/equipe`, page détail `/realisations/[slug]`, 404, proxy des médias.
- [x] Retours v1 : tri et affichage sur le champ `date`, preview en cartes empilées (3 photos max), navbar horizontale sur PC.
- [x] Conteneur apache : reverse proxy pour `orma.tomish.fr` → astro et `strapi.tomish.fr` → strapi, HTTPS automatique (Let's Encrypt), HTTP → HTTPS, hôtes inconnus refusés. Certificats Let's Encrypt obtenus pour les deux domaines (25/09/2026, expiration 24/12/2026, renouvellement automatique).
- [x] Formulaire de contact : **visuel uniquement** (validation, message d'attente, pas d'envoi).
- [x] Image Docker du front + service `astro` dans le compose. Vérifié : `astro check` et le build passent, les routes répondent contre le Strapi local.

### À faire
- [ ] **Envoi des e-mails du formulaire** : choisir un fournisseur (SMTP / Brevo / Resend…), ajouter un endpoint `POST` côté Astro (ou le plugin email de Strapi), un anti-spam (honeypot et/ou Turnstile), et la case RGPD / les mentions légales.
- [ ] Palette définitive de la charte graphique.
- [ ] Remplir le contenu dans Strapi : single type Accueil, membres de l'équipe, slugs des articles existants (régénérer le slug depuis l'admin).
- [ ] Mise en ligne : DNS A/AAAA de `orma.tomish.fr` et `strapi.tomish.fr` vers le serveur, ports 80/443 ouverts, `ACME_EMAIL` dans `.env`, `PUBLIC_URL` + `IS_PROXIED` dans `strapi-app/.env`.
- [ ] Strapi tourne encore en `develop` dans Docker : prévoir un build `NODE_ENV=production` pour la mise en ligne. Le content-type builder n'est alors plus disponible.
- [ ] Optionnel : mentions légales, sitemap, `robots.txt`.

## Points d'attention

- `ACME_EMAIL` est **obligatoire** dans `.env` : sans lui, `docker compose` refuse de démarrer. Pour tester sans consommer les quotas Let's Encrypt, définir `ACME_CA` sur l'URL staging (voir `.env.example`), puis vider le volume `apache_md` avant de repasser en production. Tant qu'aucun certificat n'est obtenu, le HTTPS répond 503.
- Un certificat obtenu ou renouvelé par mod_md n'est actif qu'après un redémarrage en douceur d'Apache : le conteneur en fait un par jour (`command` dans le compose). Pour forcer : `docker exec apache httpd -k graceful`. Les étapes de mod_md apparaissent dans `docker logs apache` (`LogLevel md:info`). Après un échec, mod_md attend avant de réessayer et n'écrit rien entre-temps.

- Sous Windows, le bind mount de `strapi-app/src` ne déclenche pas le rechargement de Strapi : après une modification de schéma, lancer `docker restart strapi`.
- Les URLs de médias Strapi sont relatives (`/uploads/...`) et passent par le proxy Astro. Si un fournisseur d'upload externe (S3…) est ajouté plus tard, les URLs deviennent absolues et le proxy n'est plus utilisé.
- Les styles scopés des cartes sont chargés par la page d'accueil. Les fragments `/partials/realisations` en dépendent : ne pas les afficher ailleurs sans importer `WorkCard`.
