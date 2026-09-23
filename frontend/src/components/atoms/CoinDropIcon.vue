<script setup>
/**
 * Reprend le logo Abyss2 (voir AppLogo.vue) et anime sa pièce : elle tombe et
 * disparaît dans la fente de la tirelire. Joue une seule fois au montage —
 * pas de prop pour relancer, le parent monte une instance neuve par déclenchement
 * (voir CoinDropOverlay.vue), ce qui suffit et évite de gérer un redémarrage de
 * l'animation CSS.
 */
defineProps({
  size: { type: [Number, String], default: 64 },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="120 120 720 720"
    aria-hidden="true"
    focusable="false"
    class="coin-drop"
  >
    <mask id="coin-drop-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="960">
      <rect width="960" height="960" fill="#fff"/>
      <circle cx="328" cy="473" r="19" fill="#000"/>
      <rect x="425" y="368" width="130" height="26" rx="13" fill="#000"/>
      <ellipse cx="222" cy="530" rx="6" ry="13" fill="#000"/>
      <ellipse cx="245" cy="533" rx="6" ry="13" fill="#000"/>
      <!-- fente où la pièce disparaît -->
      <circle cx="497" cy="295" r="62" fill="#000"/>
    </mask>
    <!-- cochon -->
    <g fill="#488efe" mask="url(#coin-drop-cut)">
      <ellipse cx="475" cy="520" rx="220" ry="182"/>
      <rect x="203" y="474" width="90" height="116" rx="36"/>
      <path d="M287 318C332 318 378 336 394 360L302 412C290 384 284 350 287 318Z"/>
      <path d="M332 660H414L406 727Q405 735 397 735H346Q338 735 336 727Z"/>
      <path d="M520 660H604L596 727Q595 735 587 735H534Q526 735 524 727Z"/>
    </g>
    <path d="M688 498Q724 522 756 496Q778 476 752 460Q722 446 712 470Q708 490 732 490" fill="none" stroke="#488efe" stroke-width="15" stroke-linecap="round"/>
    <!-- pièce qui tombe dans la fente -->
    <g fill="#4dde93" class="coin-drop__coin">
      <circle cx="497" cy="295" r="50"/>
      <rect x="458" y="198" width="10" height="46" rx="5"/>
      <rect x="484" y="160" width="10" height="58" rx="5"/>
    </g>
  </svg>
</template>

<style scoped>
.coin-drop__coin {
  transform-origin: 497px 295px;
  animation: coin-drop-fall 900ms cubic-bezier(0.55, 0, 1, 0.45) forwards;
}

@keyframes coin-drop-fall {
  0%   { transform: translateY(-220px); opacity: 1; }
  65%  { transform: translateY(0);      opacity: 1; }
  100% { transform: translateY(14px) scale(0.5); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .coin-drop__coin { animation: none; opacity: 0; }
}
</style>
