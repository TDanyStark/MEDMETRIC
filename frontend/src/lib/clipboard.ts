import { toast } from 'sonner'

/**
 * Unica implementacion de copiado al portapapeles de la app.
 * Ningun componente debe llamar `navigator.clipboard.writeText` directamente.
 *
 * Maneja tanto el rechazo de la API como el contexto inseguro (HTTP), donde
 * `navigator.clipboard` es `undefined`: en ambos casos muestra el toast de
 * error y devuelve `false`, sin dejar escapar un rechazo sin manejar.
 */
export async function copyToClipboard(
  text: string,
  successMessage = 'Copiado al portapapeles',
  errorMessage = 'No se pudo copiar'
): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard API no disponible en este contexto')
    }

    await navigator.clipboard.writeText(text)
    toast.success(successMessage)

    return true
  } catch {
    toast.error(errorMessage)

    return false
  }
}
