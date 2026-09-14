# Prompts — génération des icônes Abyss2

Abyss2 est une app de **suivi de dépenses personnelles à saisie manuelle** :
l'utilisateur crée ses propres comptes et enregistre lui-même ses opérations.
**Aucune connexion à une banque, aucun agrégateur, aucune synchronisation.**

Cette nuance doit se voir dans l'iconographie : on illustre **un carnet de
comptes tenu à la main**, pas un service bancaire connecté.

---

## 1. Prompt principal — icône PWA (à copier tel quel)

```
Design a modern app icon for "Abyss2", a personal expense-tracking app where
users manually create their own accounts and enter each transaction by hand —
it never connects to a bank and never syncs external data.

Concept: a single, instantly readable symbol combining the idea of a hand-kept
ledger with depth — a stylized ledger/notebook line or stacked coin discs
resolving into concentric circles, suggesting an "abyss" of layered records.
Choose ONE clear metaphor, do not combine several objects.

Style: flat vector, geometric, minimal, bold shapes, no gradients beyond a
single subtle radial glow, no outlines thinner than 1/24 of the canvas,
generous negative space, perfectly centered composition, symmetrical balance.

Colors: deep near-black navy background (#0D0D1A), primary symbol in vivid
azure blue (#4F8EF7), optional accent in soft mint (#4ADE80) for a single
highlight element. No other colors.

Format: 1024x1024 px, square, fully opaque background that bleeds to all four
edges, the symbol confined to the central 70% of the canvas.

Hard constraints: no text, no letters, no numbers, no currency symbols
(no $ € £ ¥), no credit or debit cards, no bank building, no piggy bank,
no dollar bills, no hands, no photorealism, no 3D bevel, no drop shadows,
no mockup frame, no rounded-rectangle app frame drawn inside the image.
Must stay legible when scaled down to 48x48 px.
```

## 2. Variante maskable (Android — zone de sécurité)

Même prompt, en remplaçant le paragraphe *Format* par :

```
Format: 1024x1024 px, square, fully opaque background that bleeds to all four
edges. This is an Android MASKABLE icon: the entire symbol must fit inside the
central circle of 80% diameter (safe zone), because the outer 20% will be
cropped by the launcher into a circle, squircle or rounded square. Nothing
meaningful may touch the edges.
```

## 3. Variante monochrome (badge de notification, favicon simplifié)

```
Same symbol as the Abyss2 app icon, but as a single-color glyph: pure white
shape on a fully transparent background, no background plate, no glow, no
gradient. Solid filled areas only, minimum stroke width 1/16 of the canvas,
1024x1024 px. Must remain readable at 24x24 px.
```

## 4. Pistes de symboles (à essayer une par génération)

Pour ne pas mélanger les métaphores, générer une image par piste puis comparer :

| Piste | Formulation à insérer à la place de *Concept* |
|-------|----------------------------------------------|
| Abîme + registre | `concentric circles receding into depth, the innermost ring broken into short horizontal ledger lines` |
| Pile de pièces | `three stacked coin discs seen slightly from the side, the top disc catching a subtle glow` |
| Carnet | `an open notebook reduced to two geometric pages with three ledger rules, seen from above` |
| Enveloppe budget | `a minimal envelope silhouette with a single downward arrow forming its flap` |
| Courbe de dépenses | `a descending step-line chart made of three thick segments, enclosed in a circle` |

## 5. Icônes d'interface (catégories de dépenses)

Pour les futures catégories, générer un **jeu cohérent** plutôt que des icônes
isolées :

```
Create a set of 9 flat line icons on a transparent background, in a single
consistent style: 2px uniform stroke on a 24x24 px grid, rounded caps and
joins, no fill, monochrome (#4F8EF7), geometric and minimal.

Icons needed, in this order: groceries (shopping basket), transport (tram or
bus front), housing (simple house), health (cross in a circle), leisure
(gamepad), clothing (t-shirt), savings (upward arrow into a jar), subscriptions
(repeating arrows loop), miscellaneous (three dots in a circle).

All nine must share the same optical weight, the same corner radius and the
same padding inside their 24x24 box. Deliver them side by side on one row,
evenly spaced, on a transparent background. No text, no labels, no frames.
```

## 6. Après génération — intégration

Les fichiers attendus par le projet (`frontend/public/`) :

| Fichier | Taille | Usage |
|---------|--------|-------|
| `favicon.svg` | vectoriel | onglet navigateur |
| `pwa-192.png` | 192×192 | manifest, écran d'accueil |
| `pwa-512.png` | 512×512 | manifest, splash screen |
| `pwa-maskable-512.png` | 512×512 | Android (zone de sécurité 80%) |
| `apple-touch-icon.png` | 180×180 | iOS |

Redimensionner depuis le 1024×1024 généré :

```bash
cd frontend/public
convert source-1024.png -resize 192x192 pwa-192.png
convert source-1024.png -resize 512x512 pwa-512.png
convert source-1024.png -resize 180x180 apple-touch-icon.png
convert source-maskable-1024.png -resize 512x512 pwa-maskable-512.png
```

Puis vérifier que `frontend/vite.config.js` (section `VitePWA.manifest.icons`)
liste bien ces fichiers, et contrôler le rendu dans Chrome DevTools →
Application → Manifest.

## 7. Contrôle qualité

- [ ] Lisible à 48×48 px et à 24×24 px (dézoomer, ne pas juger à 1024)
- [ ] Rien d'important hors du cercle de sécurité sur la version maskable
- [ ] Fond opaque sur les PNG du manifest (pas de transparence)
- [ ] Aucun texte ni symbole monétaire (l'app est multi-devises)
- [ ] Aucune référence bancaire (carte, banque, logo) — la saisie est manuelle
- [ ] Contraste correct sur fond clair **et** sur fond sombre du launcher
