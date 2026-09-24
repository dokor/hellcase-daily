# Browser Automations

> Le dépôt conserve pour l'instant son nom GitHub historique `hellcase-daily`, mais il héberge désormais le worker Playwright partagé du homelab.

Ce service centralise les automatisations qui nécessitent un vrai navigateur. n8n reste responsable du scheduling, des conditions, des retries et des notifications ; ce worker reste responsable de Playwright, Chromium, des sessions navigateur et de la logique DOM.

## Architecture

```text
n8n
  |
  | HTTP POST
  v
browser-automations
  |
  +-- hellcase.daily
  +-- future-site.daily
  +-- ...
```

L'objectif est de ne plus créer un projet Docker/Playwright et un cron pour chaque petite automatisation.

## API

### Health

```http
GET /health
```

### Lister les automatisations

```http
GET /automations
Authorization: Bearer <AUTOMATION_API_TOKEN>
```

### Exécuter une automatisation

```http
POST /run/hellcase.daily
Authorization: Bearer <AUTOMATION_API_TOKEN>
```

Exemple de réponse :

```json
{
  "automation": "hellcase.daily",
  "ok": true,
  "dryRun": true,
  "messages": [
    "🧪 Giveaway dry-run: would join ...",
    "🧪 Newbie case dry-run: would open ..."
  ]
}
```

Une même automatisation ne peut pas être lancée deux fois simultanément : le worker renvoie HTTP 409 si elle est déjà en cours.

## Hellcase

Le module `hellcase.daily` :

1. charge la session navigateur persistante ;
2. cherche le giveaway gratuit éligible ;
3. refuse les actions qui semblent payantes ;
4. rejoint le giveaway si nécessaire ;
5. ouvre la caisse gratuite `newbie` si elle est disponible ;
6. renvoie un résultat structuré à n8n.

Les deux sous-tâches restent indépendantes : une erreur sur le giveaway n'empêche pas la tentative d'ouverture de la caisse.

## Ajouter une nouvelle automatisation

Créer uniquement un nouveau module dans :

```text
src/automations/
```

Puis l'enregistrer dans `src/automations/index.ts`.

Le module implémente :

```ts
type AutomationDefinition = {
  id: string;
  description: string;
  run: () => Promise<AutomationRunResult>;
};
```

Il n'est pas nécessaire de recréer :

- un serveur HTTP ;
- un conteneur Chromium ;
- un cron ;
- une logique n8n ;
- une gestion de concurrence.

## Session Hellcase

La session reste dans :

```text
data/hellcase-session.json
```

Elle n'est jamais commitée.

Pour la créer depuis un poste avec interface graphique :

```bash
npm install
npx playwright install chromium
npm run auth
```

Puis transférer le fichier vers le Raspberry.

## Développement

```bash
npm install
npm run typecheck
npm run server
```

Le mode sécurisé est activé par défaut :

```env
HEADLESS=true
DRY_RUN=true
```

## Docker

Le réseau Docker `automation` doit être créé une seule fois et partagé avec n8n :

```bash
docker network create automation
docker compose up -d --build
```

Le worker n'expose volontairement aucun port sur l'hôte. n8n l'appelle sur le réseau Docker :

```text
http://browser-automations:3000/run/hellcase.daily
```

## Authentification interne

Définir idéalement :

```env
AUTOMATION_API_TOKEN=<secret-long>
```

Le node HTTP Request n8n envoie ensuite :

```text
Authorization: Bearer <secret-long>
```

`/health` reste accessible sans token pour les health checks.

## Compatibilité CLI

Le runner historique reste disponible :

```bash
npm run daily
```

Il utilise exactement le même module `hellcase.daily` que l'API, afin d'éviter toute duplication de logique.

## Sécurité

- aucune action payante volontaire ;
- `DRY_RUN=true` par défaut ;
- aucun mot de passe Steam dans le repo ;
- aucun contournement de CAPTCHA ;
- worker non exposé publiquement ;
- token HTTP interne optionnel mais recommandé.
