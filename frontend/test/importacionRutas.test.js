import { describe, expect, it } from 'vitest'

import { buildRutaMapFromRows, normalizeRutaCodigo } from '../src/lib/importacionReporte.js'

describe('importacionReporte rutas', () => {
  it('normalizeRutaCodigo usa SIN_RUTA por defecto', () => {
    expect(normalizeRutaCodigo('')).toBe('SIN_RUTA')
    expect(normalizeRutaCodigo('  r01  ')).toBe('R01')
  })

  it('buildRutaMapFromRows indexa por código en mayúsculas', () => {
    const map = buildRutaMapFromRows([
      { id: 1, codigo: 'r01' },
      { id: 2, codigo: 'NORTE' },
    ])
    expect(map.get('R01')).toBe(1)
    expect(map.get('NORTE')).toBe(2)
  })
})
