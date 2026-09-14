<script setup>
defineProps({
  /** 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' */
  size:   { type: String, default: 'base' },
  /** 'primary' | 'secondary' | 'muted' | 'success' | 'warning' | 'danger' | 'brand' | 'inherit' */
  color:  { type: String, default: 'inherit' },
  weight: { type: String, default: 'normal' },
  /** HTML tag */
  as:     { type: String, default: 'span' },
  mono:   { type: Boolean, default: false },
  truncate:{ type: Boolean, default: false },
})
</script>

<template>
  <component
    :is="as"
    :class="[
      'text',
      `text--${size}`,
      `text--${color}`,
      `text--${weight}`,
      { 'text--mono': mono, 'text--truncate': truncate }
    ]"
  >
    <slot />
  </component>
</template>

<style scoped>
.text { display: inline; }

h1.text, h2.text, h3.text, h4.text, h5.text, h6.text,
p.text, div.text, section.text, article.text {
  display: block;
}

/* Sizes */
.text--xs   { font-size: var(--text-xs); }
.text--sm   { font-size: var(--text-sm); }
.text--base { font-size: var(--text-base); }
.text--lg   { font-size: var(--text-lg); }
.text--xl   { font-size: var(--text-xl); }
.text--2xl  { font-size: var(--text-2xl); }
.text--3xl  { font-size: var(--text-3xl); }

/* Colors */
.text--inherit   { color: inherit; }
.text--primary   { color: var(--color-text-primary); }
.text--secondary { color: var(--color-text-secondary); }
.text--muted     { color: var(--color-text-muted); }
.text--success   { color: var(--color-success); }
.text--warning   { color: var(--color-warning); }
.text--danger    { color: var(--color-danger); }
.text--brand     { color: var(--color-primary); }

/* Weights */
.text--normal   { font-weight: var(--font-normal); }
.text--medium   { font-weight: var(--font-medium); }
.text--semibold { font-weight: var(--font-semibold); }
.text--bold     { font-weight: var(--font-bold); }

/* Misc */
.text--mono     { font-family: var(--font-mono); }
.text--truncate { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
