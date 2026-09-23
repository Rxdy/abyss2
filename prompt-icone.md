# Prompt — icône Abyss2

Une seule image à générer (1024×1024). Toutes les tailles sont ensuite
dérivées en local (section 3), pas besoin de les demander à l'IA.

## 1. Le prompt (à copier tel quel)

```
App icon, flat vector, 1024x1024, square. A classic cute piggy bank in side
view: chubby round body in azure blue (#4F8EF7), small triangle ear,
short stubby legs, curly tail, a small round eye, a coin slot on its back.
One mint (#4ADE80) coin falling into the slot from above, with two more
coins piled at the pig's feet. Solid near-black navy background (#0D0D1A).
Friendly, bold, geometric, minimal, centered, lots of empty space, whole
symbol inside the central 65% of the canvas.
No text, no letters, no numbers, no currency symbols, no gradients, no
shadows, no 3D, no photorealism. Readable at 48x48 px.
```

Le cochon reste bleu (pas rose) pour rester dans la charte de l'app ; seule la
pièce est menthe, pour qu'elle ressorte.

## 2. Variantes (remplacer la phrase du symbole)

| Piste | Symbole à mettre à la place |
|-------|-----------------------------|
| Cochon de face | `a piggy bank seen from the front, round face with snout, two ears, coin slot on top of the head, one mint coin dropping in` |
| Cochon + pile | `a side-view piggy bank standing on a stack of three flat coin discs, one mint coin dropping into its back slot` |
| Pièces seules | `a stack of four coin discs seen slightly from the side, the top one in mint, the others in blue` |

## 3. Tailles générées depuis l'image

Image retenue : `branding/abyss2-icon.png` (tirelire). Fichiers dérivés dans
`frontend/public/` :

```bash
cd frontend/public
SRC=../../branding/abyss2-icon.png
convert $SRC -resize 192x192 pwa-192.png
convert $SRC -resize 512x512 pwa-512.png
convert $SRC -resize 180x180 apple-touch-icon.png
convert $SRC -resize 32x32   favicon-32.png
# maskable : symbole réduit à 85 % sur le fond uni (zone de sécurité Android)
convert $SRC -resize 85% -background '#0b0b17' -gravity center \
  -extent 960x960 -resize 512x512 pwa-maskable-512.png
```

`favicon.svg` et `src/components/atoms/AppLogo.vue` sont des redessins vectoriels
de la même tirelire (mêmes couleurs : `#488efe`, `#4dde93`, fond `#0b0b17`).
