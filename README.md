# Pipeline Pilot — Prospection B2B

Prototype indépendant en français pour organiser la prospection commerciale, inspiré des workflows généraux des outils de prospection B2B. Ce projet n'est ni affilié à Pancake.ai ni une copie de son code ou de sa marque.

## Application en ligne

- Site : https://pancake-alternative.pages.dev
- Dépôt : https://github.com/mansstyle59/pancake-alternative
- Hébergement : Cloudflare Pages, avec déploiement automatique depuis `main`.

## Fonctions disponibles dans le prototype
- Tableau de bord commercial et campagnes de démonstration
- Gestion locale des prospects, score et statuts
- Profil du client idéal (ICP)
- Brouillons de messages, copie et export CSV
- Interface responsive mobile / ordinateur
- Écran de connexion Supabase, compte e-mail/mot de passe et synchronisation cloud des prospects
- Écran d'analyse IA d'un site public, via une fonction serveur authentifiée

## Configuration Supabase (à faire avant d'utiliser le cloud)

1. Créer un **projet Supabase dédié** à Pipeline Pilot.
2. Dans SQL Editor, exécuter le fichier `supabase/schema.sql`. Il crée les tables avec RLS et des politiques limitées à chaque utilisateur.
3. Dans les paramètres API du projet, copier l'URL et la clé **publishable** (ou l'ancienne clé anon). Dans l'application, ouvrir « Connexions » et enregistrer ces deux valeurs. Ne jamais mettre une clé `service_role` dans le navigateur.
4. Déployer la fonction `supabase/functions/analyze-site/index.ts` sous le nom `analyze-site`, avec vérification JWT activée.
5. Ajouter les secrets serveur `OPENAI_API_KEY` et, facultativement, `TAVILY_API_KEY`. La première clé permet l'analyse IA et peut générer des frais côté fournisseur; la seconde active une recherche web complémentaire et peut aussi être payante. Le site fonctionne sans ces secrets, mais l'analyse IA reste indisponible.
6. Créer un compte dans l'écran « Connexions », confirmer l'adresse e-mail si Supabase l'exige, puis se connecter.

Commandes de déploiement de la fonction depuis un environnement disposant de la CLI Supabase :
```bash
supabase login
supabase link --project-ref VOTRE_REF_SUPABASE
supabase secrets set OPENAI_API_KEY=VOTRE_CLE_OPENAI
# Facultatif :
supabase secrets set TAVILY_API_KEY=VOTRE_CLE_TAVILY
supabase functions deploy analyze-site
```
Ne partagez jamais les clés API dans un message, une capture d'écran ou un commit Git.

## État et limites connues
- Le site et son déploiement Pages sont configurés; le premier déploiement peut prendre un peu de temps à devenir actif.
- La base de données et la fonction Edge sont **préparées dans le dépôt, mais doivent encore être appliquées/déployées dans un projet Supabase dédié**.
- Les prospects restent locaux tant que Supabase n'est pas configuré et que la synchronisation n'a pas été lancée. L'écran cloud synchronise actuellement les prospects; les campagnes, profils ICP et brouillons ne sont pas encore synchronisés.
- L'analyse lit une page publique et peut utiliser Tavily si la clé est configurée. Elle ne fait pas de scraping massif, ne garantit pas que toutes les informations sont exactes et ne récupère pas de coordonnées privées. Vérifiez les sources avant de contacter une entreprise.
- Aucun envoi automatique d'e-mails, aucune collecte massive et aucun enrichissement de contacts n'est activé.
- Les clés OpenAI/Tavily et les quotas sont indépendants de l'hébergement gratuit. Vérifiez les tarifs des fournisseurs avant de configurer leurs API.

## Technologie
HTML, CSS et JavaScript natifs; Supabase Auth/Postgres/Edge Functions en option. Aucun build front-end requis.
