<script setup>
/**
 * Logo Abyss2 — la tirelire (source : branding/abyss2-icon.png).
 * Couleurs de marque fixes (identiques à l'icône PWA, quel que soit le thème).
 * Le liseré entre les pièces prend la couleur du fond : --logo-gap
 * (surface par défaut, à surcharger si le logo est posé sur un autre fond).
 */
defineProps({
  size: { type: [Number, String], default: 26 },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="120 120 720 720"
    aria-hidden="true"
    focusable="false"
  >
    <mask id="abyss-logo-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="960">
      <rect width="960" height="960" fill="#fff"/>
      <!-- œil, fente, narines -->
      <circle cx="328" cy="473" r="19" fill="#000"/>
      <rect x="425" y="368" width="130" height="26" rx="13" fill="#000"/>
      <ellipse cx="222" cy="530" rx="6" ry="13" fill="#000"/>
      <ellipse cx="245" cy="533" rx="6" ry="13" fill="#000"/>
      <!-- liseré autour de la pièce qui tombe -->
      <circle cx="497" cy="295" r="62" fill="#000"/>
    </mask>
    <!-- cochon -->
    <g fill="#488efe" mask="url(#abyss-logo-cut)">
      <ellipse cx="475" cy="520" rx="220" ry="182"/>
      <rect x="203" y="474" width="90" height="116" rx="36"/>
      <path d="M287 318C332 318 378 336 394 360L302 412C290 384 284 350 287 318Z"/>
      <path d="M332 660H414L406 727Q405 735 397 735H346Q338 735 336 727Z"/>
      <path d="M520 660H604L596 727Q595 735 587 735H534Q526 735 524 727Z"/>
    </g>
    <path d="M688 498Q724 522 756 496Q778 476 752 460Q722 446 712 470Q708 490 732 490" fill="none" stroke="#488efe" stroke-width="15" stroke-linecap="round"/>
    <!-- pièces -->
    <g fill="#4dde93">
      <circle cx="497" cy="295" r="50"/>
      <rect x="458" y="198" width="10" height="46" rx="5"/>
      <rect x="484" y="160" width="10" height="58" rx="5"/>
    </g>
    <g fill="#4dde93">
      <path d="M558 716V738Q558 760 610 760Q664 760 664 738V716Z"/>
      <ellipse cx="610" cy="716" rx="52" ry="22" stroke="var(--logo-gap, var(--color-bg-surface))" stroke-width="6"/>
      <g transform="rotate(-6 695 690)">
        <path d="M637 688V712Q640 732 696 732Q752 728 754 708V684Z" stroke="var(--logo-gap, var(--color-bg-surface))" stroke-width="6" stroke-linejoin="round"/>
        <ellipse cx="695" cy="686" rx="58" ry="24" stroke="var(--logo-gap, var(--color-bg-surface))" stroke-width="6"/>
      </g>
    </g>
  </svg>
</template>
