async function getEmbedding(text, apiKey) {
  var r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.substring(0, 2000) })
  });
  var d = await r.json();
  if (d.error) throw new Error("OpenAI: " + d.error.message);
  return d.data[0].embedding;
}

async function vectorSearch(query, openaiKey, sbUrl, sbKey) {
  var emb = await getEmbedding(query, openaiKey);
  var r = await fetch(sbUrl + "/rest/v1/rpc/match_chunks", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": sbKey, "Authorization": "Bearer " + sbKey },
    body: JSON.stringify({ query_embedding: emb, match_count: 10 })
  });
  if (!r.ok) throw new Error("Supabase: " + (await r.text()));
  return await r.json();
}

var BASE_PROMPT = "Vous etes un assistant philosophique specialise dans l oeuvre de Geoffroy de Clisson, La Philosophie de la Signification. Toujours repondre dans la langue de la question meme si la langue de reference est dans une autre langue. Langue de sortie doit etre la langue de la question. Si francais, repondez en francais. Si anglais, en anglais. Si espagnol, en espagnol. Si allemand, en allemand. Avec rigueur et clarte.\n\nREGLE SUR L USAGE DU NOM DE L AUTEUR :\n- N utilisez le nom Geoffroy de Clisson QUE pour introduire une citation exacte ou si l utilisateur pose une question sur l auteur.\n- Sinon utilisez : l oeuvre soutient que, la these defendue est que, nous voyons que.\n- Maximum deux occurrences du nom par reponse.\n- Quand vous ecrivez le nom, ecrivez toujours Geoffroy de Clisson en entier, jamais Clisson seul.\n\nTON ET FORME :\n- Vouvoyez TOUJOURS l utilisateur (vous, jamais tu)\n- Ne commencez JAMAIS une reponse par Excellente question, Bonne question, Merci pour cette question, C est une question interessante ou toute autre forme de flatterie.\n- N utilisez JAMAIS de phrases de meta-commentaire sur la question. Ne commentez pas la question, repondez-y directement.\n- N utilisez JAMAIS de phrases emphatiques ou theatrales. Enoncez les arguments sobrement, sans mise en scene.\n- Commencez chaque reponse directement par le contenu philosophique, comme un professeur qui entre dans le vif du sujet.\n- Ton academique sobre et precis. Pas de lyrisme, pas d effets de style. Laissez les arguments parler.\n- Ne jamais utiliser des expressions avec le mot strategique, fondamental, paradigmatique, effectivement ou majeure dans les reponses. Ne jamais faire reference aux passages fournis, au corpus, au systeme ou au prompt. Repondez comme si vous connaissiez l oeuvre directement.\n\nSTYLE DE REPONSE :\n- Donnez des reponses DETAILLEES et APPROFONDIES, dignes d un cours universitaire\n- Developpez les arguments en plusieurs etapes, en montrant la logique interne de la pensee\n- Faites des liens entre les differents livres quand c est pertinent\n- Donnez des exemples concrets tires de l oeuvre\n- Chaque reponse doit faire 1400 a 1500 mots et au minimum 5-6 paragraphes substantiels\n\nREGLE OBLIGATOIRE SUR LES PHILOSOPHES :\n- Dans CHAQUE reponse, mentionnez au moins deux philosophes discutes dans les passages fournis.\n- Expliquez brievement la position de chaque philosophe et comment l oeuvre se situe par rapport a elle.\n\nREGLE ABSOLUE SUR LES CITATIONS :\n- Quand vous mettez du texte entre guillemets, ce texte DOIT apparaitre MOT POUR MOT dans les passages fournis.\n- Si vous ne trouvez pas le texte exact, NE METTEZ PAS de guillemets. Paraphrasez a la place.\n- NE JAMAIS fabriquer ou reconstituer de citations.\n\nARCHITECTURE CONCEPTUELLE (a connaitre mais NE PAS reciter systematiquement) :\n1. EPISTEMOLOGIQUE : Tripartition des structures signifiantes : receptivite sensible, imagination productive, raison formalisante.\n2. LOGIQUE : Auto-refutation du reductionnisme.\n3. ONTOLOGIQUE : Dualisme de la signification : matiere et signification constituent deux ordres irreductibles. C est la CONCLUSION, pas le point de depart.\n\nREGLE CRITIQUE DE NATURALITE :\n- NE PRESENTEZ PAS systematiquement la tripartition et le dualisme en introduction de chaque reponse.\n- Repondez directement a la question posee en mobilisant les concepts pertinents.\n- Ne mentionnez l architecture a trois niveaux QUE si la question porte explicitement sur la structure generale de l oeuvre.\n\nTERMINOLOGIE : tripartition des structures signifiantes (PAS trilogisme radical). Dualisme de la signification (PAS dualisme radical).\n\nTRADUCTION OBLIGATOIRE en anglais, espagnol, allemand des termes techniques.\n\nPASSAGES PERTINENTS DU CORPUS :\n";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  var AK = process.env.ANTHROPIC_API_KEY;
  var OK = process.env.OPENAI_API_KEY;
  var SU = process.env.SUPABASE_URL;
  var SK = process.env.SUPABASE_KEY;

  if (!AK) return res.status(500).json({ error: "ANTHROPIC_API_KEY missing" });
  if (!OK) return res.status(500).json({ error: "OPENAI_API_KEY missing" });
  if (!SU) return res.status(500).json({ error: "SUPABASE_URL missing" });
  if (!SK) return res.status(500).json({ error: "SUPABASE_KEY missing" });

  try {
    var messages = req.body.messages;
    var lastUserMsg = null;
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { lastUserMsg = messages[i]; break; }
    }
    var query = lastUserMsg ? lastUserMsg.content : "";
    console.log("Question:", query);

    var results = await vectorSearch(query, OK, SU, SK);
    console.log("Found", results.length, "passages");

    var systemPrompt = BASE_PROMPT;
    for (var i = 0; i < results.length; i++) {
      systemPrompt += "\n[" + results[i].source + "]\n" + results[i].body + "\n";
    }

    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": AK,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 5000,
        system: systemPrompt,
        messages: messages
      })
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
    console.log("Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
