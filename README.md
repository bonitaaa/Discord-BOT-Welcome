# pvcool · Welcomebot

Bot Discord séparé qui accueille les nouveaux membres dans un fil privé et leur explique le fonctionnement réel de pvcool.

## Parcours d'accueil

Le tutoriel est organisé en quatre étapes :

1. **Whitelists** — explique qu'une whitelist donne accès à une fonctionnalité et ne crée pas un rôle Discord.
2. **Rôle personnel** — présente la WL Perso, le panneau de gestion du rôle et la commande `/perso @membre`.
3. **Vocal personnel** — présente la WL PV et le panneau de création et de gestion du salon vocal.
4. **Support** — indique comment ouvrir un ticket owner si un accès manque ou si une aide est nécessaire.

Chaque question propose plusieurs réponses. Une mauvaise réponse affiche une explication claire avant de laisser le membre réessayer. Le bot modifie un seul panneau dans le fil afin d'éviter le spam.

Le parcours est désactivé par défaut. Tant que `WELCOME_ENABLED=false`, aucune arrivée ne déclenche le parcours automatique.

## Fonctions incluses

- attribution et protection du rôle d’attente ;
- panneau de vérification avec acceptation, refus et fil privé ;
- parcours d’accueil interactif en français ou en anglais ;
- parrainage final avec demande de récompense au service des flocons ;
- sauvegarde persistante des profils, sessions et vérifications.

Le bot ne publie actuellement aucune commande slash. Au démarrage, il retire les anciennes commandes enregistrées afin de ne laisser aucune commande obsolète.

## Installation sur Railway

1. Créer le bot dans le Discord Developer Portal.
2. Activer **Server Members Intent**.
3. Lui accorder : voir les salons, envoyer des messages, créer et gérer des fils, et ajouter des membres aux fils.
4. Copier les variables de `.env.example` dans Railway.
5. Monter un volume persistant sur `/data`.
6. Définir le salon avec `WELCOME_CHANNEL_ID`.
7. Passer `WELCOME_ENABLED=true` lorsque le tutoriel doit être envoyé aux nouveaux membres.

Variables indispensables : `DISCORD_TOKEN` et `GUILD_ID`. `CLIENT_ID` est facultatif : le bot récupère automatiquement l'identifiant de son application.

Le bot ne gère que le rôle d’attente et ses permissions d’isolement. Il n’administre pas les rôles personnels, les salons vocaux personnels ni les tickets présentés dans le tutoriel.

## Vérification locale

```bash
npm install
npm run check
npm test
npm start
```

Les données sont conservées dans `data/welcome-state.json` (ou dans le chemin indiqué par `DATA_FILE`). Ce fichier n’est pas publié sur GitHub.

## Périmètre

Ce dépôt contient uniquement WelcomeBot : accueil, rôle d’attente, vérification et parrainage de fin de parcours. Il ne contient aucun moteur de tickets, quiz, statistiques, modération générale, rôles personnels ou salons vocaux personnels. Les références à ces services dans le tutoriel sont uniquement des explications ou des destinations Discord ; WelcomeBot ne les implémente pas.

## Sécurité

Ne publie jamais le fichier `.env`, le jeton Discord ou les données des membres. Consulte [SECURITY.md](SECURITY.md) pour signaler un problème sensible.

