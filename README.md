# Avatar Philosophique — La Philosophie de la Signification

Un chatbot intelligent spécialisé dans l'œuvre de Geoffroy de Clisson,
alimenté par l'API Claude d'Anthropic.

## Déploiement sur Vercel (5 minutes)

### Prérequis
- Un compte GitHub (gratuit) : https://github.com
- Un compte Vercel (gratuit) : https://vercel.com
- Une clé API Anthropic : https://console.anthropic.com

### Étapes

**1. Obtenir une clé API Anthropic**
- Allez sur https://console.anthropic.com
- Créez un compte (5$ de crédit offerts)
- Dans Settings → API Keys, créez une nouvelle clé
- Copiez-la (elle commence par `sk-ant-...`)

**2. Mettre le projet sur GitHub**
- Connectez-vous à GitHub
- Cliquez sur "New repository" (bouton + en haut à droite)
- Nommez-le `clisson-avatar` (ou autre)
- Laissez en public ou privé, puis "Create repository"
- Uploadez tous les fichiers de ce dossier (glisser-déposer ou via l'interface)

**3. Déployer sur Vercel**
- Allez sur https://vercel.com et connectez-vous avec GitHub
- Cliquez "Add New → Project"
- Importez votre repo `clisson-avatar`
- **IMPORTANT** : Avant de déployer, cliquez "Environment Variables"
  - Name : `ANTHROPIC_API_KEY`
  - Value : votre clé `sk-ant-...`
- Cliquez "Deploy"

**4. C'est prêt !**
- Vercel vous donne une URL du type `https://clisson-avatar.vercel.app`
- Partagez cette URL avec qui vous voulez

## Structure du projet

```
clisson-avatar/
├── index.html       ← Interface de chat (frontend)
├── api/
│   └── chat.js      ← Fonction serverless (backend, appelle Claude)
├── vercel.json      ← Configuration Vercel
├── package.json     ← Métadonnées du projet
├── .env.example     ← Modèle de variables d'environnement
└── README.md        ← Ce fichier
```

## Coût estimé

Le modèle utilisé est **Claude Haiku 4.5** (le plus économique) :
- ~0.001$ par question/réponse
- 100 conversations ≈ 0.10$
- Les 5$ de crédit initial suffisent pour ~5000 échanges

## Personnalisation

### Changer le modèle
Dans `api/chat.js`, ligne `model:`, remplacez par :
- `claude-haiku-4-5-20251001` — le plus économique (défaut)
- `claude-sonnet-4-20250514` — meilleure qualité, ~10x plus cher
- `claude-opus-4-6` — qualité maximale, ~30x plus cher

### Modifier le system prompt
Le prompt est dans `api/chat.js`, variable `SYSTEM_PROMPT`.
C'est le "cerveau" de l'avatar — il définit ce que l'IA sait et comment elle répond.

### Modifier l'interface
Tout le design est dans `index.html` — HTML/CSS/JS standard.
