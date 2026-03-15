const fs = require('fs');
const path = require('path');

var chunksCache = null;

function getChunks() {
  if (chunksCache) return chunksCache;
  var tryPaths = [
    path.join(__dirname, 'chunks.json'),
    path.join(process.cwd(), 'api', 'chunks.json'),
    '/var/task/api/chunks.json',
  ];
  for (var i = 0; i < tryPaths.length; i++) {
    try {
      if (fs.existsSync(tryPaths[i])) {
        chunksCache = JSON.parse(fs.readFileSync(tryPaths[i], 'utf-8'));
        return chunksCache;
      }
    } catch (e) { /* next */ }
  }
  var files1 = [], files2 = [];
  try { files1 = fs.readdirSync(path.join(__dirname)); } catch(e) {}
  try { files2 = fs.readdirSync('/var/task/api/'); } catch(e) {}
  throw new Error('chunks.json introuvable. __dirname: [' + files1.join(',') + '] /var/task/api/: [' + files2.join(',') + ']');
}

var STOP = {'les':1,'des':1,'une':1,'que':1,'qui':1,'dans':1,'pour':1,'par':1,'sur':1,'est':1,'sont':1,'avec':1,'plus':1,'pas':1,'tout':1,'mais':1,'comme':1,'cette':1,'ces':1,'aux':1,'son':1,'ses':1,'nous':1,'vous':1,'leur':1,'entre':1,'sans':1,'sous':1,'elle':1,'ils':1,'elles':1,'etre':1,'avoir':1,'fait':1,'dire':1,'aussi':1,'bien':1,'peut':1,'tous':1,'ici':1,'donc':1,'the':1,'and':1,'that':1,'this':1,'with':1,'from':1,'for':1,'not':1,'are':1,'was':1,'has':1,'but':1,'its':1,'his':1,'her':1,'our':1,'they':1,'been':1,'have':1,'will':1,'more':1};

function tok(text) {
  var t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ');
  var w = t.split(/\s+/), r = [];
  for (var i = 0; i < w.length; i++) if (w[i].length > 2 && !STOP[w[i]]) r.push(w[i]);
  return r;
}

function search(query) {
  var chunks = getChunks();
  var qt = tok(query);
  if (qt.length === 0) return chunks.slice(0, 6);
  var N = chunks.length, tw = 0;
  if (!chunks[0]._t) {
    for (var i = 0; i < N; i++) { chunks[i]._t = tok(chunks[i].text); chunks[i]._d = chunks[i]._t.length; tw += chunks[i]._d; }
  } else { for (var i = 0; i < N; i++) tw += chunks[i]._d; }
  var avg = tw / N || 1, df = {};
  for (var q = 0; q < qt.length; q++) { df[qt[q]] = 0; for (var i = 0; i < N; i++) if (chunks[i]._t.indexOf(qt[q]) >= 0) df[qt[q]]++; }
  var sc = [];
  for (var i = 0; i < N; i++) {
    var s = 0;
    for (var q = 0; q < qt.length; q++) {
      var tf = 0; for (var t = 0; t < chunks[i]._t.length; t++) if (chunks[i]._t[t] === qt[q]) tf++;
      if (tf > 0) s += Math.log((N - df[qt[q]] + 0.5) / (df[qt[q]] + 0.5) + 1) * (tf * 2.5) / (tf + 1.5 * (1 - 0.75 + 0.75 * chunks[i]._d / avg));
    }
    if (s > 0) sc.push({ s: chunks[i].source, t: chunks[i].text, v: s });
  }
  sc.sort(function(a, b) { return b.v - a.v; });
  return sc.slice(0, 6);
}

var BP = "Tu es un assistant philosophique specialise dans l'oeuvre de Geoffroy de Clisson, La Philosophie de la Signification. Tu reponds dans la langue de la question (francais, anglais, espagnol, allemand). Avec rigueur et clarte.\n\nARCHITECTURE : 1.Epistemologique (trilogisme: receptivite sensible, imagination productive, raison formalisante) 2.Logique (auto-refutation du reductionnisme) 3.Ontologique (dualisme radical = conclusion).\nFormule: Le trilogisme est la preuve. L'argument logique est le verrou. Le dualisme radical est la conclusion.\nDistinctions: dualisme radical!=cartesien, imagination productive!=reproductrice, trilogisme=terme propose pas de Geoffroy de Clisson, Godel!=Lucas-Penrose.\nVoisinages: Kant, Chalmers, Cassirer, Levinas, Ricoeur, Nagel, Searle, Nietzsche, Popper, Putnam, Chomsky.\nRegles: Ne jamais inventer de citations. Citer livre/section. Specialiste passionne mais honnete.\n\nPASSAGES PERTINENTS:\n";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  var KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  try {
    var msgs = req.body.messages;
    var q = '';
    for (var i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === 'user') { q = msgs[i].content; break; } }

    var results = search(q);
    var sp = BP;
    for (var i = 0; i < results.length; i++) sp += "\n[" + results[i].s + "]\n" + results[i].t + "\n";

    var r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system: sp, messages: msgs }),
    });
    var d = await r.json();
    if (d.error) return res.status(400).json({ error: d.error.message });
    var txt = "";
    for (var i = 0; i < d.content.length; i++) if (d.content[i].type === "text") txt += d.content[i].text;
    return res.status(200).json({ text: txt });
  } catch (err) {
    return res.status(500).json({ error: "Erreur: " + err.message });
  }
};
