# pvcool · Welcomebot

Bot Discord séparé qui accueille les nouveaux membres dans un fil privé et leur explique le fonctionnement réel de pvcool.

## Parcours d'accueil

Le tutoriel est organisé en quatre étapes :

1. **Whitelists** — explique qu'une whitelist donne accès à une fonctionnalité et ne crée pas un rôle Discord.
2. **Rôle personnel** — présente la WL Perso, le panneau de gestion du rôle et la commande `/perso @membre`.
3. **Vocal personnel** — présente la WL PV et le panneau de création et de gestion du salon vocal.
4. **Support** — indique comment ouvrir un ticket owner si un accès manque ou si une aide est nécessaire.

Chaque question propose plusieurs réponses. Une mauvaise réponse affiche une explication claire avant de laisser le membre réessayer. Le bot modifie un seul panneau dans le fil afin d'éviter le spam.

Le parcours est désactivé par défaut. Tant que `WELCOME_ENABLED=false`, aucune arrivée ne déclenche de fil. La commande `/welcome-test` permet néanmoins au testeur privé ou à un propriétaire de tester le parcours.

## Commandes

- `/welcome-test` — lance le tutoriel uniquement pour l'utilisateur autorisé.
- `/welcome-config` — choisit le salon d'accueil et active ou désactive le parcours automatique (propriétaires uniquement).

## Installation sur Railway

1. Créer le bot dans le Discord Developer Portal.
2. Activer **Server Members Intent**.
3. Lui accorder : voir les salons, envoyer des messages, créer et gérer des fils, et ajouter des membres aux fils.
4. Copier les variables de `.env.example` dans Railway.
5. Monter un volume persistant sur `/data`.
6. Définir le salon avec `/welcome-config` ou `WELCOME_CHANNEL_ID`.
7. Passer `WELCOME_ENABLED=true` lorsque le tutoriel doit être envoyé aux nouveaux membres.

Variables indispensables : `DISCORD_TOKEN` et `GUILD_ID`. `CLIENT_ID` est facultatif : le bot récupère automatiquement l'identifiant de son application.

Le bot ne donne aucun rôle et ne modifie aucune permission : il sert uniquement de guide interactif vers les systèmes déjà gérés par les autres bots.

## Vérification locale

```bash
npm install
npm run check
npm start
```

