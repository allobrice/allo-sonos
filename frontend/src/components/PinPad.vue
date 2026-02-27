<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ submit: [pin: string] }>()

const digits = ref<string[]>([])
const error = ref('')
const PIN_LENGTH = 4

function pressDigit(d: string) {
  if (digits.value.length >= PIN_LENGTH) return
  error.value = ''
  digits.value.push(d)
  if (digits.value.length === PIN_LENGTH) {
    emit('submit', digits.value.join(''))
  }
}

function pressDelete() {
  digits.value.pop()
  error.value = ''
}

function setError(msg: string) {
  error.value = msg
  digits.value = []
}

defineExpose({ setError })
</script>

<template>
  <div class="pin-pad">
    <!-- Dots display -->
    <div class="dots-row" aria-label="PIN entry progress">
      <span
        v-for="i in PIN_LENGTH"
        :key="i"
        class="dot"
        :class="{ filled: i <= digits.length }"
        aria-hidden="true"
      />
    </div>

    <!-- Error message — min-height prevents layout shift -->
    <p class="error-msg" role="alert">{{ error }}</p>

    <!-- Numeric keypad: digicode layout (1-9 in 3x3, then empty/0/delete) -->
    <div class="keypad" role="group" aria-label="PIN keypad">
      <button
        v-for="digit in ['1', '2', '3', '4', '5', '6', '7', '8', '9']"
        :key="digit"
        class="key-btn"
        :aria-label="digit"
        @click="pressDigit(digit)"
      >
        {{ digit }}
      </button>

      <!-- Bottom row: empty cell, 0, delete -->
      <span class="key-empty" aria-hidden="true" />
      <button class="key-btn" aria-label="0" @click="pressDigit('0')">0</button>
      <button class="key-btn key-delete" aria-label="Delete" @click="pressDelete">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M22 3H7C6.31 3 5.77 3.35 5.41 3.88L0 12L5.41 20.11C5.77 20.64 6.31 21 7 21H22C23.1 21 24 20.1 24 19V5C24 3.9 23.1 3 22 3ZM19 15.59L17.59 17L14 13.41L10.41 17L9 15.59L12.59 12L9 8.41L10.41 7L14 10.59L17.59 7L19 8.41L15.41 12L19 15.59Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pin-pad {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  width: 100%;
  max-width: 280px;
}

/* Dots row */
.dots-row {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
}

.dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-border);
  transition: background 0.15s ease, transform 0.15s ease;
}

.dot.filled {
  background: var(--color-accent-green);
  transform: scale(1.1);
}

/* Error message — always renders to prevent layout shift */
.error-msg {
  color: var(--color-accent-pink);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
  min-height: 1.25rem;
}

/* Keypad grid */
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
  width: 100%;
}

.key-btn {
  min-width: 72px;
  min-height: 56px;
  border-radius: var(--radius-md);
  font-size: 1.5rem;
  font-weight: 500;
  font-family: inherit;
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s ease;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.key-btn:active {
  background: var(--color-border);
}

.key-delete {
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.key-empty {
  min-width: 72px;
  min-height: 56px;
}
</style>
