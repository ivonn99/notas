export function maskPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 4) return digits
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}

/** Normaliza a dígitos; para MX convierte 10 dígitos a prefijo 52. */
export function normalizePhoneMx(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `52${digits}`
  return digits
}

/** Candidatos de JID para maximizar compatibilidad en WA. */
export function buildCandidateJids(normalizedDigits) {
  if (!normalizedDigits) return []
  const out = new Set()
  out.add(`${normalizedDigits}@s.whatsapp.net`)
  // Compatibilidad MX: algunas cuentas históricas resuelven mejor con 521 + 10 dígitos.
  if (normalizedDigits.startsWith('52') && normalizedDigits.length === 12) {
    out.add(`521${normalizedDigits.slice(2)}@s.whatsapp.net`)
  }
  return [...out]
}
