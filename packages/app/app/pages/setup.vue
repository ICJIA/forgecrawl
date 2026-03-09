<script setup lang="ts">
const { setup } = useAuth()

const form = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  displayName: '',
})

const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  loading.value = true

  try {
    await setup(form)
    await navigateTo('/')
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Setup failed'
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
        <p class="text-gray-400 mt-2">Create your admin account to get started</p>
      </div>

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

          <UFormField label="Display Name">
            <UInput
              v-model="form.displayName"
              placeholder="Admin"
            />
          </UFormField>

          <UFormField label="Password">
            <UInput
              v-model="form.password"
              type="password"
              placeholder="Minimum 8 characters"
              required
            />
          </UFormField>

          <UFormField label="Confirm Password">
            <UInput
              v-model="form.confirmPassword"
              type="password"
              placeholder="Confirm your password"
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
            Create Admin Account
          </UButton>
        </form>
      </UCard>
    </div>
  </div>
</template>
