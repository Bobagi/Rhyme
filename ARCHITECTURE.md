# Architecture

Rhyme is a **dependency-free, no-build static web app** (vanilla JS + ES modules)
organized as a small **layered / clean architecture**. The goal is that each module
has one reason to change (SRP) and that the domain logic stays pure and testable,
independent of the browser, the DOM and the network.

## Layers & directory map

```
src/
├── main.js                         Composition root — wires the view into #app
├── config/
│   └── speechLanguages.js          Static config: UI-filter → speech locale
├── i18n/
│   └── i18n.js                     UI translation catalogs (pt/en/es) + language
│                                   detection / persistence / translate()
├── services/                       Domain + data layer (no DOM)
│   ├── rhymeEngine.js              Pure rhyme algorithm: keys, tiers, classify
│   ├── trainingScorer.js           Pure freestyle scoring (state in → state out)
│   ├── wordListRepository.js       Data access: fetch + cache the word lists
│   └── browserSpeechRecognitionService.js   Adapter over the Web Speech API
├── audio/
│   └── metronome.js                Web Audio metronome (Metronome class)
├── hooks/
│   └── useRealTimeSpeechRecognition.js   Application/orchestration layer +
│                                   observable state store (the "controller")
└── components/
    └── SpeechRecognitionTester.js  View: builds the DOM, binds events, renders
```

## Data flow

```
        user speaks / clicks
                │
                ▼
   ┌─────────────────────────┐     subscribe(snapshot)     ┌──────────────────┐
   │  View (component)        │ ◀───────────────────────── │  Controller       │
   │  - renders snapshots     │                            │  (the hook)       │
   │  - i18n + metronome      │ ──── start/stop/filter ───▶ │  - owns state     │
   └─────────────────────────┘     newChallenge/reset      │  - orchestrates   │
                                                            └────────┬─────────┘
                                            calls (no DOM, no UI strings)
                       ┌───────────────────────────┬─────────────────┴───────────┐
                       ▼                           ▼                              ▼
              rhymeEngine (algorithm)     trainingScorer (scoring)     speechService (adapter)
                       │                                                          │
                       ▼                                                          ▼
              wordListRepository (fetch + cache)                      Web Speech API (browser)
```

The **view never touches the browser speech API or the rhyme algorithm directly**;
it talks only to the controller's small interface. The **controller emits data
only** (status codes, scores, device names) — every user-facing string lives in the
view's i18n layer.

## SOLID

- **S — Single Responsibility.** Each module owns exactly one concern: the rhyme
  *algorithm* (`rhymeEngine`), *scoring* (`trainingScorer`), *data access*
  (`wordListRepository`), the *beat* (`metronome`), *translations* (`i18n`), the
  *speech adapter* (`browserSpeechRecognitionService`), *orchestration/state*
  (the hook) and the *view* (the component). Scoring, the metronome and word-list
  loading were extracted out of the hook/engine specifically to honor this.
- **O — Open/Closed.** Adding a language = add a catalog + a source entry; adding a
  rhyme tier = add a map + one fallback step — existing code is untouched.
- **L — Liskov.** Any object implementing the speech-service callback interface can
  replace `browserSpeechRecognitionService` (e.g. a mock for tests) without the
  controller knowing.
- **I — Interface Segregation.** The controller exposes a minimal surface
  (`subscribe`, `startListening`, `stopListening`, `setRhymeLanguageFilter`,
  `newChallenge`, `resetTraining`, `dispose`); modules export only what callers need.
- **D — Dependency Inversion.** The view depends on the controller abstraction, and
  the controller depends on service abstractions (engine, scorer, speech adapter,
  repository) — not on the concrete browser APIs, which are isolated behind the
  adapter and the repository.

## Patterns

- **Adapter** — `browserSpeechRecognitionService` wraps `webkitSpeechRecognition`.
- **Repository** — `wordListRepository` hides fetch + localStorage caching.
- **Observer / pub-sub** — the controller is an observable store (`subscribe`).
- **Pure functions** — `rhymeEngine`, `trainingScorer`, `i18n.translate`,
  `metronome.clampBpm` are side-effect-free and unit-testable in Node without a DOM.
- **Composition root** — `main.js` is the only place modules are wired together.

## Why no framework / build step

The app is intentionally vanilla JS served as static files: instant load, zero
dependencies to audit, trivial deploy. The layering above provides the structure a
framework would, while keeping the surface small and the domain framework-agnostic.
