import { describe, expect, it } from 'vitest'

import {
  parseEmpresaImportacion,
  roundMoney,
  saldoFromMontoAbono,
  validateNormalized,
} from '../../shared/importValidation.js'

describe('importValidation (shared)', () => {
  it('saldoFromMontoAbono cumple saldo = monto - abono', () => {
    const monto = roundMoney(980.5)
    const abono = roundMoney(300)
    const saldo = saldoFromMontoAbono(monto, abono)
    expect(saldo).toBe(680.5)
    expect(saldo).toBe(roundMoney(monto - abono))
  })

  it('parseEmpresaImportacion acepta empresas válidas', () => {
    expect(parseEmpresaImportacion('distribuidora')).toBe('DISTRIBUIDORA')
    expect(parseEmpresaImportacion(' RODRIGO ')).toBe('RODRIGO')
    expect(parseEmpresaImportacion('otra')).toBeNull()
  })

  it('validateNormalized exige campos obligatorios', () => {
    const errors = validateNormalized({})
    expect(errors).toContain('serie_folio obligatorio')
    expect(errors).toContain('empresa obligatoria')
    expect(errors).toContain('monto inválido')
  })

  it('validateNormalized rechaza requiere_atencion en RESUELTA', () => {
    const errors = validateNormalized({
      serieFolio: 'NC-1',
      empresa: 'DISTRIBUIDORA',
      estado: 'RESUELTA',
      requiereAtencion: true,
      monto: 100,
      abono: 0,
      fechaNota: '2026-03-01',
    })
    expect(errors.some((e) => e.includes('requiere_atencion'))).toBe(true)
  })

  it('validateNormalized fila válida devuelve array vacío', () => {
    const errors = validateNormalized(
      {
        serieFolio: 'NC-1',
        empresa: 'DISTRIBUIDORA',
        estado: 'PENDIENTE',
        requiereAtencion: false,
        monto: 100,
        abono: 20,
        fechaNota: '2026-03-01',
      },
      null,
      'DISTRIBUIDORA',
    )
    expect(errors).toEqual([])
  })
})
