# hellcase-daily

Automatisation personnelle des actions gratuites quotidiennes sur Hellcase : inscription au giveaway gratuit du jour et ouverture de la caisse `newbie` gratuite.

Le projet utilise Playwright avec une session Hellcase persistante. La connexion est effectuée manuellement une première fois, puis le runner quotidien exécute deux actions : rejoindre le giveaway gratuit du jour et ouvrir la caisse gratuite `newbie` sur `https://hellcase.com/fr/open/newbie`.

## Principes de sécurité

- `DRY_RUN=true` par défaut.
- Aucun mot de passe Steam n'est stocké dans le projet.
- La session Playwright est enregistrée localement dans `data/hellcase-session.json` et ignorée par Git.
- Le runner refuse de continuer si la page semble demander un dépôt, un achat, une ouverture de caisse ou une dépense.
- Aucun contournement de CAPTCHA ou de protection anti-bot.
- Si la session expire ou si le giveaway ne peut pas être identifié avec suffisamment de certitude, le runner s'arrête.

## Installation

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

## 1. Enregistrer la session Hellcase

Cette étape doit être faite sur une machine avec une interface graphique :

```bash
npm run auth
```

Un navigateur s'ouvre sur Hellcase. Connecte-toi manuellement, puis reviens dans le terminal et valide avec Entrée.

La session est enregistrée dans :

```text
data/hellcase-session.json
```

Ne commite jamais ce fichier.

## 2. Tester sans rejoindre le giveaway

Le mode dry-run est activé par défaut :

```bash
npm run daily
```

Ou explicitement :

```bash
DRY_RUN=true npm run daily
```

Le script :

1. charge la session Hellcase ;
2. ouvre la page des giveaways ;
3. cherche un giveaway avec des signaux `free/gratuit` + `daily/quotidien` ;
4. rejette les pages qui semblent demander une action payante ;
5. vérifie si le compte est déjà inscrit ;
6. ouvre ensuite la page `/open/newbie` ;
7. vérifie que la caisse est explicitement gratuite et qu'aucune dépense n'est demandée ;
8. ouvre la caisse si elle n'a pas déjà été ouverte aujourd'hui ;
9. en dry-run, affiche uniquement ce qu'il ferait.

## 3. Activer réellement l'inscription

Une fois le dry-run validé :

```env
DRY_RUN=false
```

Puis :

```bash
npm run daily
```

## Docker

```bash
docker compose build
docker compose run --rm hellcase-daily
```

Le dossier local `./data` est monté dans le conteneur afin de réutiliser la session.

## Notification ntfy

Optionnellement :

```env
NTFY_URL=https://ntfy.example.com/hellcase-daily
```

Le runner enverra le résultat de l'exécution sur ce topic.

## Planification sur Raspberry Pi

Exemple avec cron à 08:15 :

```cron
15 8 * * * cd /opt/hellcase-daily && docker compose run --rm hellcase-daily
```

Pour une utilisation réelle, mettre `DRY_RUN=false` dans le fichier `.env` uniquement après avoir vérifié plusieurs exécutions dry-run.

## Scripts

| Commande | Description |
| --- | --- |
| `npm run auth` | Connexion manuelle et sauvegarde de la session |
| `npm run daily` | Lance le runner quotidien |
| `npm run daily:dry` | Force le mode dry-run |
| `npm run typecheck` | Vérifie les types TypeScript |

## Limites actuelles

La V1 utilise des heuristiques sur les liens et textes visibles de la page Hellcase. Le DOM réel peut nécessiter d'ajuster les sélecteurs après une première exécution.

Le runner est volontairement conservateur : en cas de doute, il ne clique pas. Les deux actions sont isolées : si l'une échoue, l'autre est quand même tentée.

## Roadmap

- Valider les sélecteurs du giveaway et de la caisse `newbie` sur le DOM actuel de Hellcase.
- Ajouter des tests sur des fixtures HTML.
- Ajouter une capture d'écran en cas d'échec.
- Ajouter un statut distinct pour session expirée / CAPTCHA.
- Déployer le cron sur le Raspberry Pi.
