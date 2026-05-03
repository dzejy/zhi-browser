import { WebContents } from 'electron'
import { buildAutofillScript } from './detector'

export async function performAutofill(
  wc: WebContents,
  username: string,
  password: string
): Promise<boolean> {
  try {
    const result = await wc.executeJavaScript(buildAutofillScript(username, password), true)
    return Boolean(result)
  } catch {
    return false
  }
}
