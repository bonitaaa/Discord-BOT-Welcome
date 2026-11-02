# pvcool · Welcome bot

Bot Discord séparé qui crée un fil d'accueil à chaque arrivée et accompagne le membre par étapes :

Le parcours est actuellement désactivé par défaut. Tant que `WELCOME_ENABLED=false`, le bot ne crée aucun fil et n'envoie aucune question ni aucun message à l'arrivée. Passe cette variable à `true` uniquement pour le réactiver.

- choix de la langue ;
- pays ;
- genre ;
- tranche d'âge ;
- notifications ;
- résumé final enregistré durablement.

Le bot modifie un seul panneau dans le fil au lieu d'envoyer une suite de messages.

## Installation

1. Créer un bot dans le Discord Developer Portal.
2. Activer **Server Members Intent**.
3. Inviter le bot avec les permissions : voir les salons, envoyer des messages, créer/gérer des fils, ajouter des membres aux fils et gérer les rôles (uniquement si des rôles sont configurés).
4. Ajouter les variables de `.env.example` dans Railway.
5. Monter un volume Railway sur `/data`.
6. Lancer une première fois le bot, puis utiliser `/welcome-config` dans le salon de bienvenue.

`WELCOME_CHANNEL_ID` peut remplacer `/welcome-config`.

Variables indispensables : `DISCORD_TOKEN` et `GUILD_ID`. `CLIENT_ID` est facultatif : le bot utilise automatiquement l'identifiant de son application.

## Rôles automatiques

Les quatre variables `*_ROLE_IDS` sont des objets JSON. Exemple :

```json
{"france":"123456789", "belgique":"987654321"}
```

Si aucun identifiant n'est indiqué, le choix est tout de même sauvegardé et affiché dans le résumé.

