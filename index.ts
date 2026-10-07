// Fonction Supabase OPTIONNELLE — analyse IA des photos d'une montre.
// Non testée de bout en bout : voir README, étape 7.
//
// Déploiement :
//   supabase functions deploy analyze-watch
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// La clé Anthropic reste côté serveur : elle ne doit JAMAIS aller dans config.js.
// Par défaut Supabase exige un utilisateur connecté (JWT) pour appeler la fonction.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT = `Tu aides un revendeur de montres vintage à pré-remplir une fiche à partir de photos.
Réponds UNIQUEMENT par un objet JSON, sans texte autour, de la forme :
{"fields":[{"key":"brand|model|reference|period|movement","value":"...","confidence":0-100}],"note":"..."}
Règles : ne propose un champ que si tu as des indices visibles (signature du cadran, forme, boîtier, calibre visible).
La confiance doit refléter l'incertitude réelle : une référence ou une période déduite d'un cadran seul est rarement > 75.
"note" : une courte hypothèse d'inspection (verre rayé, cadran refait, bracelet non d'origine…) à confirmer à réception. En français.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  try {
    const { images } = await req.json();
    if (!Array.isArray(images) || !images.length) return json({ error: 'Aucune image' }, 400);
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ANTHROPIC_API_KEY manquante côté Supabase' }, 500);

    const content: unknown[] = images.slice(0, 4).map((d: string) => {
      const m = /^data:(image\/\w+);base64,(.+)$/.exec(d);
      if (!m) throw new Error('Image invalide');
      return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
    });
    content.push({ type: 'text', text: 'Analyse ces photos de montre.' });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 800, system: PROMPT, messages: [{ role: 'user', content }] }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || 'Erreur API' }, 502);
    const text = (data.content || []).map((b: { text?: string }) => b.text || '').join('');
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return json(parsed);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
