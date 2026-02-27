import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia()) // Pinia FIRST — router guard needs it
app.use(router)
app.mount('#app')
