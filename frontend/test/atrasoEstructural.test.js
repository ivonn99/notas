import { describe, expect, it } from 'vitest'

import {
  ATRASO_ESTRUCTURAL_UMBRAL_DEFAULT,
  buildAtrasoEstructuralPorCliente,
  evalAtrasoEstructural,
  isSaldoCarteraReciente,
  parseUmbralAtrasoPct,
} from '../src/utils/atrasoEstructural.js'

describe('parseUmbralAtrasoPct', () => {
  it('acepta porcentajes válidos', () => {
    expect(parseUmbralAtrasoPct('60')).toBe(60)
  })

  it('usa default fuera de rango', () => {
    expect(parseUmbralAtrasoPct('0')).toBe(ATRASO_ESTRUCTURAL_UMBRAL_DEFAULT)
    expect(parseUmbralAtrasoPct('150')).toBe(ATRASO_ESTRUCTURAL_UMBRAL_DEFAULT)
    expect(parseUmbralAtrasoPct('x')).toBe(ATRASO_ESTRUCTURAL_UMBRAL_DEFAULT)
  })
})

describe('isSaldoCarteraReciente', () => {
  it('incluye 0–30 días', () => {
    expect(isSaldoCarteraReciente(0)).toBe(true)
    expect(isSaldoCarteraReciente(30)).toBe(true)
    expect(isSaldoCarteraReciente(31)).toBe(false)
    expect(isSaldoCarteraReciente(-1)).toBe(false)
  })
})

describe('evalAtrasoEstructural', () => {
  it('marca atraso cuando saldo >30 supera umbral', () => {
    const r = evalAtrasoEstructural(100, 200, 50)
    expect(r.atraso_estructural).toBe(true)
    expect(r.pct_mas_30).toBeCloseTo(66.7, 1)
  })

  it('sin saldo no hay atraso', () => {
    const r = evalAtrasoEstructural(0, 0, 50)
    expect(r.atraso_estructural).toBe(false)
    expect(r.saldo_total).toBe(0)
  })
})

describe('buildAtrasoEstructuralPorCliente', () => {
  it('agrupa por cliente y ordena por atraso', () => {
    const items = buildAtrasoEstructuralPorCliente(
      [
        { cliente: 'A', saldo: 100, dias: 10 },
        { cliente: 'A', saldo: 300, dias: 90 },
        { cliente: 'B', saldo: 50, dias: 5 },
      ],
      50,
    )
    expect(items).toHaveLength(2)
    expect(items[0].cliente).toBe('A')
    expect(items[0].atraso_estructural).toBe(true)
    expect(items[0].saldo_0_30).toBe(100)
    expect(items[0].saldo_mas_30).toBe(300)
  })
})
