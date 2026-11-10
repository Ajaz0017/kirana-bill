// Node module hook: every import of the Neon driver gets the local PGlite version instead.
// Vite may import it by bare name or by its full node_modules path, so match both.
const FAKE = new URL('./fake-neon.mjs', import.meta.url).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@neondatabase/serverless' || specifier.includes('@neondatabase/serverless/')) {
    return { url: FAKE, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
