<script setup>
/*
 * Devise d'affichage (Préférences) — enregistrée sur le compte, donc la même sur tous les appareils.
 * Change tout de suite l'affichage des montants partout ; revient en arrière si l'API refuse.
 * Les montants eux-mêmes ne sont pas convertis : seule leur présentation change.
 */
import { ref } from 'vue'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.store.js'
import BaseSelect  from '@/components/atoms/BaseSelect.vue'
import BaseText    from '@/components/atoms/BaseText.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'
import { CURRENCIES, formatAmount, getCurrency } from '@/utils/format.js'

const auth  = useAuthStore()
const api   = useApi()
const error = ref('')

async function choose(currency) {
  const previous = getCurrency()
  if (currency === previous) return
  error.value = ''

  auth.updateUser({ currency })
  try {
    await api.put('/api/user/preferences', { currency })
  } catch (err) {
    auth.updateUser({ currency: previous })
    error.value = err.message
  }
}
</script>

<template>
  <section class="currency-settings" aria-labelledby="currency-settings-title">
    <BaseText id="currency-settings-title" as="h2" size="sm" weight="semibold" color="primary">Devise</BaseText>

    <AlertBanner v-if="error">{{ error }}</AlertBanner>

    <BaseSelect
      id="currency"
      label="Devise d'affichage"
      :model-value="getCurrency()"
      @update:model-value="choose"
    >
      <option v-for="currency in CURRENCIES" :key="currency.code" :value="currency.code">
        {{ currency.label }} ({{ currency.code }})
      </option>
    </BaseSelect>

    <BaseText size="xs" color="muted">
      Aperçu : {{ formatAmount(123456) }} — seul l'affichage change, les montants ne sont pas convertis.
    </BaseText>
  </section>
</template>

<style scoped>
.currency-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
