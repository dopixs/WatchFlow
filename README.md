# WatchFlow — appli web / PWA

Suivi d'achat-revente de montres : stock, cash, profit, ledger.
Une page web installable sur téléphone (PWA), hébergée gratuitement sur **GitHub Pages**,
avec les données sauvegardées dans **Supabase** (gratuit).

```
index.html  styles.css  app.js  store.js   ← l'appli
config.js                                  ← le SEUL fichier à modifier
sw.js  manifest.webmanifest  icons/        ← partie « installable / hors ligne »
supabase/schema.sql                        ← à coller dans Supabase (étape 2)
supabase/functions/analyze-watch/          ← option : analyse IA des photos (étape 7)
```

## Essayer tout de suite (sans rien configurer)

Ouvre `index.html` via un petit serveur (ex. `python3 -m http.server`) ou après la mise en ligne :
tant que `config.js` est vide, l'appli fonctionne en **mode local** (données sur l'appareil uniquement).
Réglages (rond en haut à droite) → *Charger des données d'exemple* pour voir l'appli remplie.

## Mise en route (≈ 15 min)

### 1. Créer le projet Supabase
1. Compte gratuit sur https://supabase.com → **New project** (choisis une région proche, ex. Paris/Frankfurt).
2. Note le mot de passe de la base quelque part (tu n'en auras pas besoin dans l'appli).

### 2. Créer les tables
**SQL Editor → New query** → colle tout `supabase/schema.sql` → **Run**.
Ça crée les tables, la sécurité (chaque utilisateur ne voit que ses lignes) et le dossier privé de photos.

### 3. Brancher l'appli
**Project Settings → API** : copie *Project URL* et la clé *anon public* dans `config.js`.
(La clé `anon` est publique par conception. Ne mets jamais la clé `service_role`.)

### 4. Créer ton compte, puis fermer les inscriptions
- **Authentication → Providers → Email** : désactive *Confirm email* (plus simple pour un usage perso).
- Ouvre l'appli, *Créer un compte* avec ton email + mot de passe.
- Ensuite : **Authentication → Sign In / Providers** → désactive *Allow new users to sign up*.
  Ainsi personne d'autre ne peut créer de compte sur ton projet.

### 5. Mettre en ligne sur GitHub Pages
1. Nouveau dépôt GitHub (peut être **privé** si ton offre le permet, sinon public : le code ne contient aucun secret).
2. Envoie **tous les fichiers de ce dossier** à la racine du dépôt (`index.html` doit être à la racine).
3. **Settings → Pages** → *Deploy from a branch* → `main` / `(root)` → Save.
4. L'adresse est du type `https://TON-PSEUDO.github.io/NOM-DU-DEPOT/`.

### 6. Installer sur le téléphone
- **iPhone (Safari)** : Partager → *Sur l'écran d'accueil*.
- **Android (Chrome)** : menu ⋮ → *Installer l'application*.
L'appli s'ouvre alors en plein écran, même sans réseau.

## Comment ça sauvegarde
- Chaque action est appliquée **tout de suite** sur le téléphone, puis envoyée à Supabase en arrière-plan.
- **Hors ligne** : tu peux continuer à saisir ; tout part au retour du réseau (un point doré sur le rond
  de profil indique des modifications en attente).
- À chaque ouverture, l'appli relit le serveur → tu retrouves les mêmes données sur tous tes appareils.
- Les **photos** sont envoyées en haute qualité dans Supabase Storage (dossier privé) ; une miniature reste
  dans les données pour s'afficher instantanément.
- **Sauvegarde de secours** : Réglages → *Exporter mes données (JSON)*.

## Fonctionnement des chiffres
Tout vient du **ledger** (mouvements d'argent) : cash = capital de départ + entrées encaissées − sorties.
- Achat / frais / transport / travaux → sorties immédiates.
- Vente → entrée *en attente* (comptée dans le patrimoine) jusqu'à « Confirmer le paiement reçu ».
- Coût réel = achat + frais + transport + travaux. Profit = prix de vente − frais plateforme − envoi − coût réel.
- Capital de départ : à régler dans Réglages.

## 7. (Option) Analyse IA des photos
Le mode « Analyser avec l'IA » est prêt côté interface mais **désactivé** tant que `AI_ENDPOINT` est vide.
Il nécessite une clé API Anthropic, qui doit rester côté serveur :
1. Installe la CLI Supabase, puis `supabase link --project-ref TON_REF`.
2. `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
3. `supabase functions deploy analyze-watch`
4. Dans `config.js` : `AI_ENDPOINT: 'https://TON_REF.supabase.co/functions/v1/analyze-watch'`.

> Cette fonction n'a pas pu être testée de bout en bout : essaie-la avec une montre dont tu connais la réponse.
> Les suggestions restent toujours à valider une par une. Elle consomme des crédits API (quelques centimes par analyse).

## Mettre à jour l'appli
Remplace les fichiers dans GitHub. Si le téléphone garde l'ancienne version, change `VERSION`
dans `sw.js` (ex. `watchflow-v2`) : l'appli se met à jour à la prochaine ouverture.
