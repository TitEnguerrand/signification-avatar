const path = require('path');
const chunks = require('./chunks.json');

function tokenize(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(function(w) { return w.length > 2; })
    .filter(function(w) { return !STOP_WORDS.has(w); });
}

var STOP_WORDS = new Set([
  'les','des','une','que','qui','dans','pour','par','sur','est','sont',
  'avec','plus','pas','tout','mais','comme','cette','ces','aux','son',
  'ses','nous','vous','leur','entre','sans','sous','elle','ils','elles',
  'etre','avoir','fait','dire','aussi','bien','peut','tous','ici','donc',
  'the','and','that','this','with','from','for','not','are','was','has',
  'but','its','his','her','our','they','been','have','will','more',
]);

var tokensReady = false;
var totalWords = 0;

function prepareTokens() {
  if (tokensReady) return;
  for (var i = 0; i < chunks.length; i++) {
    chunks[i]._tokens = tokenize(chunks[i].text);
    chunks[i]._dl = chunks[i]._tokens.length;
    totalWords += chunks[i]._dl;
  }
  tokensReady = true;
}

function search(query, topK) {
  topK = topK || 10;
  prepareTokens();
  var queryTerms = tokenize(query);
  if (queryTerms.length === 0) return chunks.slice(0, topK);

  var N = chunks.length;
  var avgDl = totalWords / N || 1;

  var df = {};
  for (var q = 0; q < queryTerms.length; q++) {
    var term = queryTerms[q];
    df[term] = 0;
    for (var i = 0; i < chunks.length; i++) {
      if (chunks[i]._tokens.indexOf(term) >= 0) df[term]++;
    }
  }

  var k1 = 1.5;
  var b = 0.75;
  var scored = [];

  for (var i = 0; i < chunks.length; i++) {
    var score = 0;
    for (var q = 0; q < queryTerms.length; q++) {
      var term = queryTerms[q];
      var tf = 0;
      for (var t = 0; t < chunks[i]._tokens.length; t++) {
        if (chunks[i]._tokens[t] === term) tf++;
      }
      if (tf === 0) continue;
      var idf = Math.log((N - df[term] + 0.5) / (df[term] + 0.5) + 1);
      score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * chunks[i]._dl / avgDl));
    }
    if (score > 0) {
      scored.push({ source: chunks[i].source, text: chunks[i].text, score: score });
    }
  }

  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, topK);
}

var BASE_PROMPT = "Tu es un assistant philosophique specialise dans l'oeuvre de Geoffroy de Clisson, \"La Philosophie de la Signification\". Tu reponds dans la langue de la question. Si francais, reponds en francais. Si anglais, en anglais. Si espagnol, en espagnol. Si allemand, en allemand. Avec rigueur et clarte.\n\nSTYLE DE REPONSE :\n- Donne des reponses DETAILLEES et APPROFONDIES, dignes d'un cours universitaire\n- Developpe les arguments en plusieurs etapes, en montrant la logique interne de la pensee de Geoffroy de Clisson\n- Fais des liens entre les differents livres quand c'est pertinent\n- Situe les arguments par rapport aux philosophes discutes (Kant, Nietzsche, Putnam, Levinas, etc.)\n- Donne des exemples concrets tires de l'oeuvre (la tique, Hotel California, Mondrian, le cerveau en cuve, etc.)\n- Chaque reponse doit faire au minimum 4-5 paragraphes substantiels\n\nREGLE ABSOLUE SUR LES CITATIONS :\n- Tu as ci-dessous des PASSAGES REELS du corpus de Geoffroy de Clisson.\n- Quand tu mets du texte entre guillemets (\" \"), ce texte DOIT apparaitre MOT POUR MOT dans les passages fournis ci-dessous. Verifie chaque citation.\n- Si tu ne trouves pas le texte exact dans les passages ci-dessous, NE METS PAS de guillemets. Paraphrase a la place.\n- Utilise la formule \"Geoffroy de Clisson ecrit : \" uniquement si la citation qui suit est EXACTEMENT dans les passages.\n- Utilise la formule \"Geoffroy de Clisson soutient que\" ou \"Geoffroy de Clisson defend l'idee selon laquelle\" quand tu PARAPHRASES (sans guillemets).\n- En cas de doute, paraphrase TOUJOURS. Mieux vaut une paraphrase fidele qu'une fausse citation.\n- NE JAMAIS fabriquer ou reconstituer de citations. C'est la regle la plus importante.\n\nARCHITECTURE CONCEPTUELLE — Trois niveaux (toujours dans cet ordre) :\n1. EPISTEMOLOGIQUE — Trilogisme radical : receptivite sensible, imagination productive, raison formalisante. Aucun moment ne peut etre elimine. Application homologue : Connaissance, Esthetique, Ethique, Identite.\n2. LOGIQUE — Auto-refutation du reductionnisme : l'enonce \"tout est matiere\" presuppose la signification qu'il pretend nier.\n3. ONTOLOGIQUE — Dualisme radical : matiere et signification = deux ordres irreductibles. C'est la CONCLUSION, pas le point de depart.\nFormule : \"Le trilogisme radical est la preuve architecturale. L'argument logique est le verrou. Le dualisme radical est la conclusion.\"\n\nDISTINCTIONS CRITIQUES :\n- Dualisme radical different du dualisme cartesien (discontinuite, pas deux substances)\n- Imagination productive different de reproductrice\n- \"Trilogisme radical\" = terme propose, pas de Geoffroy de Clisson lui-meme\n- Argument godelien different de Lucas-Penrose\n- L'ethique part de l'autre, pas de la regle formelle\n- L'identite est narrative et dynamique, pas essentialiste\n\nVOISINAGES (rapprochements contrastifs, pas equivalences) :\nKant (source architecturale), Chalmers (convergence profonde), Cassirer (pregnance symbolique), Levinas (visage), Ricoeur (identite narrative), Nagel, Searle, Nietzsche (interlocuteur constant), Popper (Monde 3), Husserl, Godel, Putnam, Chomsky, Poincare.\n\nCOGITATE (Nature, 2025) : GNWT vs IIT, 256 sujets. Les deux theories \"serieusement en difficulte.\" Contenu conscient distribue (V1/V2, ventro-temporal, frontal inferieur) = compatible avec les trois moments.\n\nAUTRES REGLES :\n1. Cite le livre et la section quand possible\n2. Ordre : epistemologique, logique, ontologique\n3. Signale quand la question depasse le corpus\n4. Ton de specialiste passionne mais honnete\n5. Toujours ecrire \"Geoffroy de Clisson\" en entier, jamais \"Clisson\" seul\n6. Reponses longues et detaillees, jamais superficielles\n\nPASSAGES PERTINENTS DU CORPUS :\n";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  try {
    var messages = req.body.messages;
    var lastUserMsg = null;
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserMsg = messages[i]; break; }
    }
    var query = lastUserMsg ? lastUserMsg.content : '';
    console.log('Question:',query);

    var results = search(query, 10);

    var systemPrompt = BASE_PROMPT;
    for (var i = 0; i < results.length; i++) {
      systemPrompt += "\n[" + results[i].source + "]\n" + results[i].text + "\n";
    }

    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 5000,
        system: systemPrompt,
        messages: messages,
      }),
    });

    var data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    var text = "";
    if (data.content) {
      for (var i = 0; i < data.content.length; i++) {
        if (data.content[i].type === "text") text += data.content[i].text;
      }
    }
    return res.status(200).json({ text: text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
