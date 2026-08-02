# Time Date

Chaque minute a son anecdote. L'heure affichée devient une année à quatre
chiffres (`16h04` → **1604**), et l'app va chercher un événement réel qui
s'est produit cette année-là -- ou, pour les années après aujourd'hui, une
prévision réelle ou une date issue de la fiction (films, séries, romans,
jeux vidéo).

- `00h00` → l'an 0 (repère du calendrier)
- `19h45` → l'an 1945 → un événement de cette année (différent chaque jour
  s'il y en a plusieurs)
- `20h49` → l'an 2049 → *Blade Runner 2049* se déroule cette année-là
- `23h59` → l'an 2359, la valeur la plus haute possible

Toucher l'anecdote affiche un court résumé rédigé par l'app à partir de
l'anecdote (via l'API Claude, quand une clé est configurée -- sinon
l'extrait brut de Wikipédia en repli), avec un lien vers l'article complet
en bas si on veut aller plus loin.

## Architecture

Une seule application **Next.js** (App Router) -- pas de service séparé à
lancer, `npm install` puis `npm run dev` suffit :

```
src/
  app/
    page.tsx              -> rend <TimeDateApp /> (client-only)
    api/event/route.ts     -> GET ?hour&minute&date -> anecdote du jour
    api/summary/route.ts   -> GET ?title -> résumé + lien Wikipédia
    manifest.ts             -> manifeste PWA (installable iPhone/Android)
  components/
    TimeDateApp.tsx        -> horloge live + orchestration des appels API
    EventCard.tsx           -> affichage/dépliage de l'anecdote
  lib/
    dateMath.ts             -> heure -> année, rotation quotidienne déterministe
    wikitext.ts              -> parsing du wikitexte Wikipédia (testable hors-ligne)
    wikipedia.ts              -> appels à l'API Wikipédia + cache en mémoire
    fictionalDates.ts          -> dates fictives, avec année explicitement citée dans l'œuvre
    eventPool.ts                -> combine historique/prévision/fiction + choisit l'anecdote du jour
```

### D'où viennent les données

- **Années passées/actuelles** : section « Événements » de la page
  Wikipédia française de l'année (ex. `fr.wikipedia.org/wiki/1945`),
  récupérée via l'API MediaWiki et parsée depuis le wikitexte brut.
- **Années futures** : d'abord une éventuelle section « Événements prévus »
  réelle de Wikipédia (missions spatiales planifiées, éclipses, échéances
  de traités...) ; complétée par le jeu de **dates fictives** (`lib/fictionalDates.ts`)
  quand l'année correspond à une œuvre dont le récit cite explicitement
  cette année (Blade Runner 2049, Cyberpunk 2077...). Liste volontairement
  courte au départ -- facile à étendre, chaque entrée doit citer une année
  réellement mentionnée dans l'œuvre, jamais inventée.
- Si rien n'est trouvé pour une année (ni Wikipédia, ni fiction), l'app
  l'affiche honnêtement plutôt que d'inventer un "fait".

### Rotation quotidienne

Pour une année avec plusieurs événements possibles (1945, 1789...), l'app
en choisit un différent chaque jour de façon **déterministe** (hash de
`année + date locale`) : même anecdote toute la journée, ça change le
lendemain, sans avoir besoin de stocker un historique.

## Lancer en local

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

### Tests

```bash
npm test
```

52 tests couvrant la logique pure (mapping heure→année, rotation
quotidienne, parsing du wikitexte sur des exemples réalistes, combinaison
des sources historique/prévision/fiction) -- tout sauf les vrais appels
réseau à Wikipédia, qui ne peuvent pas être exécutés depuis l'environnement
de développement utilisé pour écrire ce projet (réseau restreint). Pense à
vérifier une fois en local que les vraies anecdotes Wikipédia s'affichent
bien (par ex. régler l'heure de ton ordinateur, ou attendre une heure comme
`19h45`) -- **si le parsing d'une page Wikipédia particulière semble
buggé, dis-le-moi et je corrige `lib/wikitext.ts`.**

## Résumé généré par IA

Le résumé affiché au clic (`lib/aiSummary.ts`, appelé depuis
`api/summary/route.ts`) est rédigé par Claude à partir du titre exact de
l'anecdote (pas de l'article Wikipédia lié, qui parle parfois d'un sujet
connexe plutôt que de l'événement précis) -- c'est ce qui règle le
problème "le lien ne parle pas de la date affichée".

Pour l'activer en production sur Vercel :

1. Créer une clé sur [console.anthropic.com](https://console.anthropic.com)
2. Vercel → Project → Settings → Environment Variables → ajouter
   `ANTHROPIC_API_KEY` avec cette valeur → redéployer

Sans clé configurée, l'app continue de fonctionner normalement et retombe
sur l'extrait brut de Wikipédia (avec une petite mention discrète en
dessous du résumé pour le signaler).

## Installer comme app sur iPhone / Android (PWA)

Pas besoin d'App Store pour commencer :

- **iPhone (Safari)** : ouvrir le site → bouton Partager → "Sur l'écran
  d'accueil"
- **Android (Chrome)** : ouvrir le site → menu ⋮ → "Installer l'application"
  (ou bandeau d'installation automatique)

L'app s'ouvre alors en plein écran, avec sa propre icône, comme une vraie
app installée.

## Roadmap

- [x] Site web (Next.js), installable comme PWA sur iPhone et Android
- [ ] Vraie app native pour Apple Watch (watchOS/SwiftUI) -- projet à part,
      hors du périmètre de ce dépôt, mais l'API (`/api/event`) est déjà
      prête à être appelée par un futur client natif
- [ ] Étoffer `lib/fictionalDates.ts` avec plus d'œuvres (film/série/roman/jeu)
- [ ] Widget iOS/Android (affiche l'anecdote de l'heure sans ouvrir l'app)

## Limites connues, honnêtement

- Le cache des pages Wikipédia est en mémoire (perdu au redémarrage du
  serveur) -- suffisant pour un usage personnel, une vraie mise en prod
  voudrait un cache persistant (Redis, fichier...).
- Le jeu de dates fictives est volontairement petit pour rester fiable ;
  chaque ajout doit être une année réellement citée dans l'œuvre.
- Pas de gestion fine des limites de débit de l'API Wikipédia (peu probable
  de les atteindre à l'usage personnel, mais à surveiller si l'app est
  partagée à beaucoup de monde).
- Les appels à Wikipédia n'ont pas pu être testés en conditions réelles
  pendant le développement (voir section Tests ci-dessus) -- le code suit
  la structure connue et stable de l'API MediaWiki, mais un premier test
  en vrai reste à faire.
