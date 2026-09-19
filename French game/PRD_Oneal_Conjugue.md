# 📋 Product Requirements Document
## Oneal Conjugue ! — French Conjugation Game

**Version:** 1.0  
**Last Updated:** September 2026  
**Author:** Oneal (Abisola Onileimo)  
**Status:** Active Development

---

## 1. Product Overview

**Oneal Conjugue !** is a mobile-first French verb conjugation learning game designed to prepare players for the **TCF (Test de Connaissance du Français)** exam. The game covers all major French tenses across six CEFR proficiency levels (A1 → C2) through an interactive multiple-choice format with deliberate traps, real explanations, and a mascot character.

**Live URL:** `https://oneal-conjugue.netlify.app/french_tenses_game.html`  
**Platform:** Web (Progressive Web App — installable on Android & iOS)  
**Primary Device:** Mobile (Infinix Smart 10 / Android)

---

## 2. Problem Statement

Learning French verb conjugation is notoriously difficult because:

- Most study tools show rules but don't test trap situations (wrong accents, wrong tense forms, spelling pitfalls)
- Explanations in apps are generic and dictionary-like — not memorable
- There is no clear path from beginner to TCF-level competency
- Existing apps require constant internet and paid subscriptions

**Oneal Conjugue !** solves this by:
- Embedding deliberate **traps** (wrong accents, false friends, wrong tense) as wrong options
- Providing **why** each wrong answer is wrong — specifically and clearly
- Covering **all 15 French tenses** in a structured level progression
- Working **offline** once loaded (PWA / service worker)

---

## 3. Target User

| Attribute | Detail |
|---|---|
| **Primary user** | Oneal (personal use) |
| **Secondary users** | Friends/peers who share the game link |
| **Language level** | Some French knowledge — understands basics |
| **Goal** | Pass the TCF exam at C2 level |
| **Device** | Android phone (Infinix Smart 10) |
| **Usage context** | On-the-go, commute, offline when needed |
| **Future language** | Mandarin Chinese (future version) |

---

## 4. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Cover all exam-relevant tenses | ✅ All 15 tenses implemented |
| Make traps memorable | Wrong options include accent/spelling/tense traps |
| Clear explanations | Every wrong answer has a specific "why wrong" message |
| Accessible on phone | Installable PWA on Android (Add to Home Screen) |
| Auto-update on phone | Netlify deployment — live URL always current |
| Engaging enough to replay | Stars system (1–3 ⭐), combo streaks, mascot reactions |

---

## 5. Feature Inventory

### 5.1 — Core Game Loop

| Feature | Status |
|---|---|
| Multiple-choice conjugation questions | ✅ Live |
| 4 answer options per question | ✅ Live |
| Deliberate traps (wrong accents, wrong tense, wrong spelling) | ✅ Live |
| Sentence fills in after answer selected | ✅ Live |
| Auto-elision (je + vowel → j') | ✅ Live |
| Explanation panel on wrong answer | ✅ Live |
| Explanation stays until player taps OK | ✅ Live |
| Specific "why wrong" per option | ✅ Live |
| Conjugation table shown in explanation | ✅ Live |
| Stars awarded per chapter (1–3 ⭐) | ✅ Live |
| Combo streak tracker (🔥) | ✅ Live |
| Progress dots per question | ✅ Live |
| Best score memory (local storage) | ✅ Live |

### 5.2 — Level & Chapter Structure

| Level | Tenses Covered | Status |
|---|---|---|
| **A1** | Présent Indicatif (-er, -ir, -re, être, avoir, aller, faire, vouloir) | ✅ Live |
| **A2** | Passé Composé, Imparfait, Futur Simple, Passé Récent (venir de) | ✅ Live |
| **B1** | Conditionnel Présent, Subjonctif Présent, Impératif | ✅ Live |
| **B2** | Plus-que-parfait, Subjonctif Présent (advanced) | ✅ Live |
| **C1** | Futur Antérieur, Voix Passive, Subjonctif Passé | ✅ Live |
| **C2** | Passé Simple, Subjonctif Imparfait, Conditionnel Passé | ✅ Live |

**Total: 15 tenses** — all required for TCF C2 preparation.

### 5.3 — Mascot & Visual Design

| Feature | Status |
|---|---|
| Mascot "Léo 🇫🇷" — animated SVG character | ✅ Live |
| Happy / sad mascot reactions per answer | ✅ Live |
| Purple & gold theme | ✅ Live |
| 3D card design with glassmorphism | ✅ Live |
| App icon (beret mascot, "CONJUGUE !" text, French tricolor ring) | ✅ Live |
| Mobile-optimised layout (safe area, tap targets, iOS scroll) | ✅ Live |

### 5.4 — PWA / Mobile App

| Feature | Status |
|---|---|
| Installable on Android (Add to Home Screen) | ✅ Live |
| Installable on iOS (Safari Share → Add to Home Screen) | ✅ Live |
| Service worker (offline caching) | ✅ Live |
| manifest.json (app name, icon, standalone display) | ✅ Live |
| Auto-update via Netlify redeploy | ✅ Live |
| Android APK (debug, sideloadable) | ✅ Built — on Desktop |
| App name: "Oneal Conjugue !" | ✅ Live |

### 5.5 — Planned Features (Backlog)

| Feature | Priority | Notes |
|---|---|---|
| 🔊 French TTS pronunciation after every answer | **High** | Web Speech API, `fr-FR`, replay button, mute toggle |
| 🇬🇧 English translation shown after answering | **High** | New `t:` field per question, ~130 translations |
| 🏆 Multi-user leaderboard | **Medium** | Requires Firebase backend, username-only |
| 🌏 Chinese (Mandarin) language support | **Low** | Generic name change + new content |
| Score sharing (screenshot / social) | **Low** | — |
| Timed challenge mode | **Low** | Race against clock per chapter |
| Custom username shown in-game | **Low** | Personalisation |

---

## 6. User Stories

| As a player, I want to… | So that… |
|---|---|
| See clear questions with a blank to fill in | I understand what verb form is being tested |
| Have 4 options with deliberate traps | I learn which mistakes to avoid |
| Know immediately WHY my wrong answer was wrong | I don't make the same mistake again |
| See the conjugation table in the explanation | I can memorise the full verb pattern |
| Hear the correct sentence spoken in French | I improve my pronunciation and listening |
| See the English translation after answering | I learn new vocabulary at the same time |
| See my star rating per chapter | I know how well I've mastered each tense |
| Replay a chapter to improve my score | I can study until I get 3 stars |
| Install the game on my phone home screen | I can access it like a real app anytime |
| Play offline | I can study without WiFi on the go |
| Get updates automatically | I always have the latest content when I open the app |

---

## 7. Technical Architecture

| Component | Technology |
|---|---|
| **Frontend** | Single HTML file — Vanilla JS + Tailwind CSS (CDN) |
| **Game data** | JavaScript `const LEVELS = [...]` array embedded in HTML |
| **Persistence** | Browser `localStorage` (scores, stars, progress) |
| **PWA** | `manifest.json` + `sw.js` service worker |
| **Hosting** | Netlify (free, auto-deploy via REST API) |
| **Deployment** | PowerShell + curl → Netlify API (automated) |
| **Android APK** | Capacitor + Android SDK command-line tools + Gradle |
| **CDN** | `https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js` |
| **TTS (planned)** | Web Speech API — `SpeechSynthesis`, `fr-FR` locale |
| **Leaderboard (planned)** | Firebase Realtime Database |

---

## 8. Question Data Format

Each question follows this schema:

```javascript
{
  s:    'Je ___ (avoir) faim.',       // Sentence with blank (+ verb hint)
  a:    'ai',                          // Correct answer
  t:    'I am hungry.',                // 🇬🇧 English translation (planned)
  v:    'avoir',                       // Infinitive
  sub:  'je',                          // Subject pronoun
  o: [                                 // Answer options [text, null=correct | 'why wrong']
    ['ai',      null],
    ['a',       'Forme de IL/ELLE, pas JE'],
    ['ait',     'Subjonctif présent — pas pour ce contexte'],
    ['aie',     'Subjonctif présent — pas l\'indicatif')],
  ],
  expl: '<strong>avoir</strong> → j\'ai...',  // HTML explanation
  conj: { je:'ai', tu:'as', il:'a', nous:'avons', vous:'avez', ils:'ont' }
}
```

---

## 9. Constraints & Rules

| Rule | Detail |
|---|---|
| No external JS frameworks | Only Tailwind via CDN allowed |
| No backend for game logic | All logic runs in the browser |
| No Python scripts | All changes via file edits only |
| Apostrophes in JS strings | Must use double-quoted strings to avoid parse errors |
| Auto-elision | `je` + vowel-starting verb → displayed as `j'` after answer |
| Explanation must not auto-close | Player must tap OK to proceed |
| Wrong options must have specific reasons | No generic "wrong answer" messages |

---

## 10. Out of Scope (v1.0)

- Social login or user accounts
- Paid features or subscriptions
- Audio recording by the player
- Grammar explanations outside of conjugation
- Languages other than French (v1.0)
- Publishing to Google Play Store or Apple App Store
