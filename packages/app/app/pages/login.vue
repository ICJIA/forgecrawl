<script setup lang="ts">
const { login, sessionExpired } = useAuth()

const form = reactive({
  email: '',
  password: '',
})

const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  loading.value = true

  try {
    await login(form.email, form.password)
    await navigateTo('/')
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-950 px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <img
          src="/forgecrawl-banner.png"
          alt="ForgeCrawl"
          class="mx-auto mb-6 rounded-lg max-w-[280px] opacity-90"
        >
        <p class="text-gray-400 mt-2">Sign in to your account</p>
      </div>

      <UAlert
        v-if="sessionExpired"
        color="warning"
        variant="subtle"
        title="Your session has expired. Please sign in again."
        class="mb-4"
      />

      <UCard>
        <form @submit.prevent="onSubmit" class="space-y-4">
          <UFormField label="Email">
            <UInput
              v-model="form.email"
              type="email"
              placeholder="admin@example.com"
              required
              autofocus
            />
          </UFormField>

          <UFormField label="Password">
            <UInput
              v-model="form.password"
              type="password"
              placeholder="Your password"
              required
            />
          </UFormField>

          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            :title="error"
          />

          <UButton
            type="submit"
            block
            :loading="loading"
          >
            Sign In
          </UButton>
        </form>
      </UCard>
    </div>
  </div>
</template>
