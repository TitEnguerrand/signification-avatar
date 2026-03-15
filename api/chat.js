import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let chunksCache = null;
function getChunks() {
  if (!chunksCache) {
    chunksCache = require('./chunks.json');
  }
  return chunksCache;
}

// Simple BM25-like search
function tokenize(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !STOP_WORDS.has(w));
}

const STOP_WORDS = new Set([
  'les','des','une','que','qui','dans','pour','par','sur','est','sont',
  'avec','plus','pas','tout','mais','comme','cette','ces','aux','son',
  'ses','nous','vous','leur','entre','sans','sous','elle','ils','elles',
  'etre','avoir','fait','dire','aussi','bien','peut','tous','ici','donc',
  'the','and','that','this','with','from','for','not','are','was','has',
  'but','its','his','her','our','they','been','have','will','more',
]);

function search(query, topK = 8) {
  const chunks = getChunks();
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return chunks.slice(0, topK);

  const N = chunks.length;
  let totalWords = 0;

  // Pre-tokenize chunks on first call (lazy)
  if (!chunks[0]._tokens) {
    for (const chunk of chunks) {
      chunk._tokens = tokenize(chunk.text);
      chunk._dl = chunk._tokens.length;
      totalWords += chunk._dl;
    }
  }

  const avgDl = totalWords / N;

  // Document frequency for query terms
  const df = {};
  for (const term of queryTerms) {
    df[term] = 0;
    for (const chunk of chunks) {
      if (chunk._tokens.includes(term)) df[term]++;
    }
  }

  // Score chunks
  const k1 = 1.5;
  const b = 0.75;

  const scored = chunks.map(chunk => {
    let score = 0;
    for (const term of queryTerms) {
      const tf = chunk._tokens.filter(t => t === term).length;
      if (tf === 0) continue;
      const idf = Math.log((N - df[term] + 0.5) / (df[term] + 0.5) + 1);
      score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * chunk._dl / avgDl));
    }
    return { source: chunk.source, text: chunk.text, score };
  });

  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

const BASE_PROMPT = `Tu es un assistant philosophique spécialisé dans l'œuvre de Geoffroy de Clisson, "La Philosophie de la Signification". Tu réponds dans la langue de la question. Si français, réponds en français. Si anglais, en anglais. Si espagnol, en espagnol. Si allemand, en allemand. Avec rigueur et clarté.

ARCHITECTURE CONCEPTUELLE — Trois niveaux (toujours dans cet ordre) :
1. ÉPISTÉMOLOGIQUE — Trilogisme radical : réceptivité sensible → imagination productive → raison formalisante. Aucun moment ne peut être éliminé. Application homologue : Connaissance, Esthétique, Éthique, Identité.
2. LOGIQUE — Auto-réfutation du réductionnisme : l'énoncé "tout est matière" présuppose la signification qu'il prétend nier.
3. ONTOLOGIQUE — Dualisme radical : matière et signification = deux ordres irréductibles. C'est la CONCLUSION, pas le point de départ.
Formule : "Le trilogisme radical est la preuve architecturale. L'argument logique est le verrou. Le dualisme radical est la conclusion."

DISTINCTIONS CRITIQUES :
- Dualisme radical ≠ dualisme cartésien (discontinuité, pas deux substances)
- Imagination productive ≠ reproductrice
- "Trilogisme radical" = terme proposé, pas de Geoffroy de Clisson lui-même
- Argument gödelien ≠ Lucas-Penrose
- L'éthique part de l'autre, pas de la règle formelle
- L'identité est narrative et dynamique, pas essentialiste

VOISINAGES (rapprochements contrastifs, pas équivalences) :
Kant (source architecturale), Chalmers (convergence profonde), Cassirer (prégnance symbolique), Levinas (visage), Ricœur (identité narrative), Nagel, Searle, Nietzsche (interlocuteur constant), Popper (Monde 3), Husserl, Gödel, Putnam, Chomsky, Poincaré.

COGITATE (Nature, 2025) : GNWT vs IIT, 256 sujets. Les deux théories "sérieusement en difficulté." Contenu conscient distribué (V1/V2, ventro-temporal, frontal inférieur) = compatible avec les trois moments.

RÈGLES :
1. Ne JAMAIS inventer de citations — utilise uniquement les passages fournis ci-dessous
2. Cite le livre et la section quand possible
3. Ordre : épistémologique → logique → ontologique
4. Signale quand la question dépasse le corpus
5. Ton de spécialiste passionné mais honnête

PASSAGES PERTINENTS DU CORPUS :
`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  try {
    const { messages } = req.body;

    // Get the last user message for search
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const query = lastUserMsg ? lastUserMsg.content : '';

    // Search relevant passages
    const results = search(query, 8);

    // Build dynamic system prompt with relevant passages
    let systemPrompt = BASE_PROMPT;
    for (const r of results) {
      systemPrompt += `\n[${r.source}]\n${r.text}\n`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("\n");
    return res.status(200).json({ text: text || "" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
