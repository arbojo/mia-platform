import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import { groq } from '@ai-sdk/groq'

export { openai, google, groq }

export const OPENAI_MODEL = 'gpt-4o-mini'
export const GOOGLE_MODEL = 'gemini-2.0-flash'
export const GROQ_MODEL = 'llama-3.3-70b-versatile'

export function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}

export function isGoogleAvailable(): boolean {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
}

export function isGroqAvailable(): boolean {
  return !!process.env.GROQ_API_KEY
}
