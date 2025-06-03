import { ref } from 'vue'

export const errorMessage = ref('')
export const errorOccured = ref(false)

function handleError(message: string) {
    errorMessage.value = message
    errorOccured.value = true

    setTimeout(() => {
      errorOccured.value = false
      errorMessage.value = ''
    }, 5000)
}

export function useErrorHandler() {
    return {
      handleError,
      errorMessage,
      errorOccured,
    }
}