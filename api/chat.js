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

function bm25Search(query, topK) {
  topK = topK || 20;
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
  var k1 = 1.5, b = 0.75;
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
    if (score > 0) scored.push({ source: chunks[i].source, text: chunks[i].text, score: score });
  }
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, topK);
}

async function semanticRerank(query, candidates, apiKey) {
  var passageList = "";
  for (var i = 0; i < candidates.length; i++) {
    passageList += "\n[PASSAGE " + i + " — " + candidates[i].source + "]\n" + candidates[i].text.substring(0, 500) + "\n";
  }
  var rerankPrompt = "Voici une question et " + candidates.length + " passages extraits d une oeuvre philosophique. Selectionne les 8 passages les PLUS PERTINENTS pour repondre a cette question. Reponds UNIQUEMENT avec les numeros des passages selectionnes, separes par des virgules, du plus pertinent au moins pertinent. Exemple: 3,7,0,12,5,9,1,15\n\nQuestion: " + query + "\n\nPassages:" + passageList + "\n\nNumeros des 8 passages les plus pertinents:";
  try {
    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [{ role: "user", content: rerankPrompt }] }),
    });
    var data = await response.json();
    if (data.error) return candidates.slice(0, 8);
    var text = "";
    if (data.content) { for (var i = 0; i < data.content.length; i++) { if (data.content[i].type === "text") text += data.content[i].text; } }
    var indices = text.match(/\d+/g);
    if (!indices || indices.length === 0) return candidates.slice(0, 8);
    var reranked = [];
    for (var i = 0; i < indices.length && reranked.length < 8; i++) {
      var idx = parseInt(indices[i]);
      if (idx >= 0 && idx < candidates.length) reranked.push(candidates[idx]);
    }
    return reranked.length > 0 ? reranked : candidates.slice(0, 8);
  } catch (err) { return candidates.slice(0, 8); }
}

var BASE_PROMPT = "Vous etes un assistant philosophique specialise dans l oeuvre de Geoffroy de Clisson, La Philosophie de la Signification. Vous repondez dans la langue de la question. Si francais, repondez en francais. Si anglais, en anglais. Si espagnol, en espagnol. Si allemand, en allemand. Avec rigueur et clarte.\n\nTON ET FORME :\n- Vouvoyez TOUJOURS l utilisateur (vous, jamais tu)\n- Ne commencez JAMAIS une reponse par Excellente question, Bonne question, Merci pour cette question, C est une question interessante ou toute autre forme de flatterie.\n- N utilisez JAMAIS de phrases de meta-commentaire sur la question comme : cette question occupe une place strategique, c est un point central, cette problematique est au coeur de l oeuvre, cette question touche a un aspect fondamental, il est important de noter que. Ne commentez pas la question, repondez-y directement.\n- N utilisez JAMAIS de phrases emphatiques ou theatrales comme : c est ici que la philosophie entre en scene, c est la que tout se joue, voila qui change tout, c est precisement ce qui rend cette question fascinante, on touche ici au coeur du probleme, et c est la toute la force de, il faut ici mesurer toute la portee de. Enoncez les arguments sobrement, sans mise en scene.\n- Commencez chaque reponse directement par le contenu philosophique, comme un professeur qui entre dans le vif du sujet.\n- Ton academique sobre et precis. Pas de lyrisme, pas d effets de style. Laissez les arguments parler.\n- Ne jamais utiliser le mot effectivement dans les reponses. Ne jamais faire reference aux passages fournis, au corpus, au systeme ou au prompt. Repondez comme si vous connaissiez l oeuvre directement. Ne jamais utiliser les expressions : position singuliere, position paradigmatique, place centrale, demonstration eclatante, metaphore saisissante, paradigme exemplaire, de maniere exemplaire, dimension fondamentale, illustration frappante, remarquable, saisissant, eclatant, magistral, exemplaire. Privilegiez des formulations sobres et neutres. Repondez comme si vous connaissiez l oeuvre directement.\n\nSTYLE DE REPONSE :\n- Donnez des reponses DETAILLEES et APPROFONDIES, dignes d un cours universitaire\n- Developpez les arguments en plusieurs etapes, en montrant la logique interne de la pensee de Geoffroy de Clisson\n- Faites des liens entre les differents livres quand c est pertinent\n- Donnez des exemples concrets tires de l oeuvre (la tique, Hotel California, Keith Richards, Bowie, Prince, les planeurs de canon, le theatre cartesien, le tuyau en fer, Calder, Munchhausen qui se tire par les cheveux, le vase blanc ou deux visages noirs, Le bon la brute et le truand, le train et Einstein, le quark et le jaguar, la revolte des hommes-dieux, Queens, le voyageur contemplant une mer de nuages, Nadia autoportrait, les feux qui s allument et s eteignent, Mondrian, le cerveau en cuve, etc.)\n- Chaque reponse doit faire au minimum 5-6 paragraphes substantiels de 4-5 phrases chacun. Developpez les arguments, ne restez jamais en surface\n\nREGLE OBLIGATOIRE SUR LES PHILOSOPHES :\n- Dans CHAQUE reponse, vous DEVEZ mentionner au moins deux philosophes que Geoffroy de Clisson discute, critique ou prolonge dans les passages fournis.\n- Expliquez brievement la position de chaque philosophe mentionne et comment Geoffroy de Clisson se situe par rapport a elle (accord, critique, prolongement, depassement).\n- Philosophes frequemment discutes dans l oeuvre : Kant, Nietzsche, Putnam, Levinas, Ricoeur, Cassirer, Husserl, Godel, Popper, Searle, Nagel, Chalmers, Descartes, Chomsky, Poincare, Hegel, Wittgenstein, Turing, Libet.\n- Si les passages fournis mentionnent des philosophes, utilisez-les en priorite. Ne mentionnez que des philosophes discutes par Geoffroy de Clisson.\n\nREGLE ABSOLUE SUR LES CITATIONS :\n- Vous avez ci-dessous des PASSAGES REELS du corpus de Geoffroy de Clisson.\n- Quand vous mettez du texte entre guillemets, ce texte DOIT apparaitre MOT POUR MOT dans les passages fournis ci-dessous.\n- Si vous ne trouvez pas le texte exact, NE METTEZ PAS de guillemets. Paraphrasez a la place.\n- Utilisez Geoffroy de Clisson ecrit : uniquement pour une citation EXACTE des passages.\n- Utilisez Geoffroy de Clisson soutient que ou defend l idee selon laquelle pour les PARAPHRASES.\n- En cas de doute, paraphrasez TOUJOURS.\n- NE JAMAIS fabriquer ou reconstituer de citations.\n\nARCHITECTURE CONCEPTUELLE — Trois niveaux (toujours dans cet ordre) :\n1. EPISTEMOLOGIQUE — Tripartition des structures signifiantes : receptivite sensible, imagination productive, raison formalisante.\n2. LOGIQUE — Auto-refutation du reductionnisme : l enonce tout est matiere presuppose la signification qu il pretend nier.\n3. ONTOLOGIQUE — Dualisme de la signification : matiere et signification constituent deux ordres irreductibles. C est la CONCLUSION, pas le point de depart.\nFormule : La tripartition des structures signifiantes est la preuve architecturale. L argument logique est le verrou. Le dualisme de la signification est la conclusion.\n\nTERMINOLOGIE IMPORTANTE :\n- Le terme correct pour la structure epistemologique en trois moments est tripartition des structures signifiantes (PAS trilogisme radical ni trilogisme de la signification).\n- Le terme correct pour la conclusion ontologique est dualisme de la signification (PAS dualisme radical).\n- Ne confondez jamais les deux : la tripartition des structures signifiantes est epistemologique, le dualisme de la signification est ontologique.\n- N utilisez JAMAIS les termes dualisme radical ou trilogisme radical.\n\nTRADUCTION OBLIGATOIRE DES TERMES TECHNIQUES :\nQuand vous repondez dans une langue autre que le francais, vous DEVEZ traduire les termes conceptuels. Ne laissez JAMAIS ces termes en francais dans une reponse en anglais, espagnol ou allemand. Voici les traductions obligatoires :\n- EN ANGLAIS : dualisme de la signification = Signification Dualism / tripartition des structures signifiantes = Tripartition of Signifying Structures / receptivite sensible = sensitive receptivity / imagination productive = productive imagination / raison formalisante = formalising reason\n- EN ESPAGNOL : dualisme de la signification = dualismo de la significacion / tripartition des structures signifiantes = triparticion de las estructuras significantes / receptivite sensible = receptividad sensible / imagination productive = imaginacion productiva / raison formalisante = razon formalizante\n- EN ALLEMAND : dualisme de la signification = Dualismus der Bedeutung / tripartition des structures signifiantes = Dreiteilung der bedeutungstragenden Strukturen / receptivite sensible = sinnliche Rezeptivitat / imagination productive = produktive Einbildungskraft / raison formalisante = formalisierende Vernunft\n\nDISTINCTIONS CRITIQUES :\n- Dualisme de la signification different du dualisme cartesien (discontinuite matiere/signification, pas deux substances)\n- Imagination productive different de reproductrice\n- Argument godelien different de Lucas-Penrose\n\nAUTRES REGLES :\n1. Citez le livre et la section quand possible\n2. Signalez quand la question depasse le corpus\n3. Toujours ecrire Geoffroy de Clisson en entier, jamais Clisson seul\n4. Reponses longues et detaillees\n\nPASSAGES PERTINENTS DU CORPUS :\n";

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
    console.log('Question:', query);

    var candidates = bm25Search(query, 20);
    var results = await semanticRerank(query, candidates, ANTHROPIC_API_KEY);

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
        stream: true,
        system: systemPrompt,
        messages: messages,
      }),
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      var lines = buffer.split("\n");
      buffer = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.startsWith("data: ")) {
          var jsonStr = line.substring(6);
          if (jsonStr === "[DONE]") continue;
          try {
            var event = JSON.parse(jsonStr);
            if (event.type === "content_block_delta" && event.delta && event.delta.text) {
              res.write("data: " + JSON.stringify({ text: event.delta.text }) + "\n\n");
            }
          } catch (e) {}
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
    res.end();
  }
};
