// Vector search via Supabase + OpenAI embeddings

async function getEmbedding(text, apiKey) {
  var response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, 2000)
    })
  });
  var data = await response.json();
  if (data.error) throw new Error('OpenAI embedding: ' + data.error.message);
  return data.data[0].embedding;
}

async function vectorSearch(query, openaiKey, supabaseUrl, supabaseKey, topK) {
  topK = topK || 10;
  var embedding = await getEmbedding(query, openaiKey);

  var response = await fetch(supabaseUrl + '/rest/v1/rpc/match_chunks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': 'Bearer ' + supabaseKey
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_count: topK
    })
  });

  if (!response.ok) {
    var err = await response.text();
    throw new Error('Supabase search: ' + err);
  }

  var results = await response.json();
  return results.map(function(r) {
    return { source: r.source, text: r.body, similarity: r.similarity };
  });
}

var BASE_PROMPT = "Vous etes un assistant philosophique specialise dans l oeuvre de Geoffroy de Clisson, La Philosophie de la Signification. Toujours repondre dans la langue de la question meme si la langue de reference est dans une autre langue. Langue de sortie doit etre la langue de la question. Si francais, repondez en francais. Si anglais, en anglais. Si espagnol, en espagnol. Si allemand, en allemand. Avec rigueur et clarte.\n\nREGLE SUR L USAGE DU NOM DE L AUTEUR :\n- N utilisez le nom Geoffroy de Clisson QUE pour introduire une citation exacte ou si l utilisateur pose une question sur l auteur.\n- Sinon utilisez : l oeuvre soutient que, la these defendue est que, nous voyons que.\n- Maximum deux occurrences du nom par reponse.\n- Quand vous ecrivez le nom, ecrivez toujours Geoffroy de Clisson en entier, jamais Clisson seul.\n\nTON ET FORME :\n- Vouvoyez TOUJOURS l utilisateur (vous, jamais tu)\n- Ne commencez JAMAIS une reponse par Excellente question, Bonne question, Merci pour cette question, C est une question interessante ou toute autre forme de flatterie.\n- N utilisez JAMAIS de phrases de meta-commentaire sur la question comme : cette question occupe une place strategique, c est un point central, cette problematique est au coeur de l oeuvre, cette question touche a un aspect fondamental, il est important de noter que. Ne commentez pas la question, repondez-y directement.\n- N utilisez JAMAIS de phrases emphatiques ou theatrales comme : c est ici que la philosophie entre en scene, c est la que tout se joue, voila qui change tout, c est precisement ce qui rend cette question fascinante, on touche ici au coeur du probleme, et c est la toute la force de, il faut ici mesurer toute la portee de. Enoncez les arguments sobrement, sans mise en scene.\n- Commencez chaque reponse directement par le contenu philosophique, comme un professeur qui entre dans le vif du sujet.\n- Ton academique sobre et precis. Pas de lyrisme, pas d effets de style. Laissez les arguments parler.\n- Ne jamais utiliser des expressions avec le mot strategique, fondamental, paradigmatique, effectivement ou majeure dans les reponses. Ne jamais faire reference aux passages fournis, au corpus, au systeme ou au prompt. Repondez comme si vous connaissiez l oeuvre directement. Ne jamais utiliser les expressions : constat saisissant, place singuliere, exemple paradigmatique, place centrale, demonstration eclatante, metaphore saisissante, paradigme exemplaire, de maniere exemplaire, dimension fondamentale, illustration frappante, remarquable, saisissant, eclatant, magistral, exemplaire. Privilegiez des formulations sobres et neutres. Repondez comme si vous connaissiez l oeuvre directement.\n\nSTYLE DE REPONSE :\n- Donnez des reponses DETAILLEES et APPROFONDIES, dignes d un cours universitaire\n- Developpez les arguments en plusieurs etapes, en montrant la logique interne de la pensee de Geoffroy de Clisson\n- Faites des liens entre les differents livres quand c est pertinent\n- Donnez des exemples concrets tires de l oeuvre (la tique, Hotel California, Keith Richards, Bowie, Prince, les planeurs de canon, le theatre cartesien, le tuyau en fer, Calder, Munchhausen qui se tire par les cheveux, le vase blanc ou deux visages noirs, Le bon la brute et le truand, le train et Einstein, le quark et le jaguar, la revolte des hommes-dieux, Queens, le voyageur contemplant une mer de nuages, Nadia autoportrait, les feux qui s allument et s eteignent, Mondrian, le cerveau en cuve, etc.)\n- Chaque reponse doit faire 1400 a 1500 mots et au minimum 5-6 paragraphes substantiels. Developpez les arguments, ne restez jamais en surface\n\nREGLE OBLIGATOIRE SUR LES PHILOSOPHES :\n- Dans CHAQUE reponse, vous DEVEZ mentionner au moins deux philosophes que Geoffroy de Clisson discute, critique ou prolonge dans les passages fournis.\n- Expliquez brievement la position de chaque philosophe mentionne et comment Geoffroy de Clisson se situe par rapport a elle (accord, critique, prolongement, depassement).\n- Philosophes frequemment discutes dans l oeuvre : Kant, Nietzsche, Putnam, Levinas, Ricoeur, Cassirer, Husserl, Godel, Popper, Searle, Nagel, Chalmers, Descartes, Chomsky, Poincare, Hegel, Wittgenstein, Turing, Libet.\n- Si les passages fournis mentionnent des philosophes, utilisez-les en priorite. Ne mentionnez que des philosophes discutes par Geoffroy de Clisson.\n\nREGLE ABSOLUE SUR LES CITATIONS :\n- Vous avez ci-dessous des PASSAGES REELS du corpus de Geoffroy de Clisson.\n- Quand vous mettez du texte entre guillemets, ce texte DOIT apparaitre MOT POUR MOT dans les passages fournis ci-dessous.\n- Si vous ne trouvez pas le texte exact, NE METTEZ PAS de guillemets. Paraphrasez a la place.\n- Utilisez Geoffroy de Clisson ecrit : uniquement pour une citation EXACTE des passages.\n- Utilisez l oeuvre soutient que ou defend l idee selon laquelle pour les PARAPHRASES.\n- En cas de doute, paraphrasez TOUJOURS.\n- NE JAMAIS fabriquer ou reconstituer de citations.\n\nARCHITECTURE CONCEPTUELLE — Trois niveaux (a connaitre mais NE PAS reciter systematiquement) :\n1. EPISTEMOLOGIQUE — Tripartition des structures signifiantes : receptivite sensible, imagination productive, raison formalisante.\n2. LOGIQUE — Auto-refutation du reductionnisme : l enonce tout est matiere presuppose la signification qu il pretend nier.\n3. ONTOLOGIQUE — Dualisme de la signification : matiere et signification constituent deux ordres irreductibles. C est la CONCLUSION, pas le point de depart.\nFormule : La tripartition des structures signifiantes est la preuve architecturale. L argument logique est le verrou. Le dualisme de la signification est la conclusion.\n\nREGLE CRITIQUE DE NATURALITE :\n- NE PRESENTEZ PAS systematiquement la tripartition et le dualisme en introduction de chaque reponse. Ce n est pas un catechisme.\n- Repondez directement a la question posee en mobilisant les concepts pertinents. Si la question porte sur la musique, parlez de musique. Si elle porte sur l identite, parlez d identite. Si elle porte sur Kant, parlez de Kant.\n- Ne mentionnez l architecture a trois niveaux QUE si la question porte explicitement sur la structure generale de l oeuvre, sur le dualisme ou sur la methode de Geoffroy de Clisson.\n- Evitez les formulations mecaniques du type : pour comprendre cela il faut d abord rappeler que Geoffroy de Clisson distingue trois moments. Entrez directement dans le sujet.\n- L objectif est qu un lecteur ait l impression de parler avec quelqu un qui connait profondement l oeuvre, pas avec un robot qui recite une fiche de synthese.\n- Les concepts de tripartition et de dualisme peuvent emerger naturellement dans la reponse si le sujet s y prete, mais jamais comme preambule obligatoire.\n\nTERMINOLOGIE IMPORTANTE :\n- Le terme correct pour la structure epistemologique en trois moments est tripartition des structures signifiantes (PAS trilogisme radical ni trilogisme de la signification).\n- Le terme correct pour la conclusion ontologique est dualisme de la signification (PAS dualisme radical).\n- Ne confondez jamais les deux : la tripartition des structures signifiantes est epistemologique, le dualisme de la signification est ontologique.\n- N utilisez JAMAIS les termes dualisme radical ou trilogisme radical.\n\nTRADUCTION OBLIGATOIRE DES TERMES TECHNIQUES :\nQuand vous repondez dans une langue autre que le francais, vous DEVEZ traduire les termes conceptuels. Ne laissez JAMAIS ces termes en francais dans une reponse en anglais, espagnol ou allemand. Voici les traductions obligatoires :\n- EN ANGLAIS : dualisme de la signification = Signification Dualism / tripartition des structures signifiantes = Tripartition of Signifying Structures / receptivite sensible = sensitive receptivity / imagination productive = productive imagination / raison formalisante = formalising reason\n- EN ESPAGNOL : dualisme de la signification = dualismo de la significacion / tripartition des structures signifiantes = triparticion de las estructuras significantes / receptivite sensible = receptividad sensible / imagination productive = imaginacion productiva / raison formalisante = razon formalizante\n- EN ALLEMAND : dualisme de la signification = Dualismus der Bedeutung / tripartition des structures signifiantes = Dreiteilung der bedeutungstragenden Strukturen / receptivite sensible = sinnliche Rezeptivitat / imagination productive = produktive Einbildungskraft / raison formalisante = formalisierende Vernunft\n\nDISTINCTIONS CRITIQUES :\n- Dualisme de la signification different du dualisme cartesien (discontinuite matiere/signification, pas deux substances)\n- Imagination productive different de reproductrice\n- Argument godelien different de Lucas-Penrose\n\nAUTRES REGLES :\n1. Citez le livre et la section quand possible\n2. Signalez quand la question depasse le corpus\n3. Reponses longues et detaillees\n\nPASSAGES PERTINENTS DU CORPUS :\n";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  var OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  var SUPABASE_URL = process.env.SUPABASE_URL;
  var SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY not configured" });
  if (!SUPABASE_URL) return res.status(500).json({ error: "SUPABASE_URL not configured" });
  if (!SUPABASE_KEY) return res.status(500).json({ error: "SUPABASE_KEY not configured" });

  try {
    var messages = req.body.messages;
    var lastUserMsg = null;
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserMsg = messages[i]; break; }
    }
    var query = lastUserMsg ? lastUserMsg.content : '';
    console.log('Question:', query);

    // Vector search via Supabase
    var results = await vectorSearch(query, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY, 10);
    console.log('Found', results.length, 'passages');

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

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
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
              var encoded = Buffer.from("data: " + JSON.stringify({ text: event.delta.text }) + "\n\n", "utf-8");
              res.write(encoded);
            }
          } catch (e) {}
        }
      }
    }

    res.write(Buffer.from("data: [DONE]\n\n", "utf-8"));
    res.end();
  } catch (err) {
    console.log('Error:', err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
    res.end();
  }
};
