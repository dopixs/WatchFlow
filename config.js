// ─────────────────────────────────────────────────────────────
//  Configuration WatchFlow — c'est le SEUL fichier à modifier.
//
//  1. Crée un projet gratuit sur https://supabase.com
//  2. Va dans  Project Settings → API
//  3. Copie « Project URL » et la clé « anon public » ci-dessous.
//
//  La clé « anon » est faite pour être publique : tes données sont
//  protégées par la connexion (email + mot de passe) et par les règles
//  de sécurité (RLS) créées par supabase/schema.sql.
//  Ne mets JAMAIS la clé « service_role » ici.
//
//  Tant que ces deux valeurs sont vides, l'appli tourne en « mode local » :
//  tout est enregistré uniquement sur l'appareil (utile pour essayer).
// ─────────────────────────────────────────────────────────────
window.WATCHFLOW_CONFIG = {
  SUPABASE_URL: 'https://kjeybncyvtyzcrulgoaj.supabase.co',        // ex. 'https://abcdxyz.supabase.co'
  SUPABASE_ANON_KEY: 'sb_publishable_W6nM6vm47W-nC27dXDGhiw_-S-nCP-b',   // ex. 'eyJhbGciOi...'

  // Optionnel — analyse IA des photos (voir README, étape 7).
  // URL de la fonction Supabase « analyze-watch ». Laisse vide pour désactiver.
  AI_ENDPOINT: ''
};
