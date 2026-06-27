import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseEmpresaImportacion,
  validateNormalized,
} from '../../shared/importValidation.js'

test('parseEmpresaImportacion acepta empresas válidas', () => {
  assert.equal(parseEmpresaImportacion('distribuidora'), 'DISTRIBUIDORA')
  assert.equal(parseEmpresaImportacion(' RODRIGO '), 'RODRIGO')
  assert.equal(parseEmpresaImportacion('otra'), null)
})

test('validateNormalized exige campos obligatorios', () => {
  const errors = validateNormalized({})
  assert.ok(errors.includes('serie_folio obligatorio'))
  assert.ok(errors.includes('empresa obligatoria'))
  assert.ok(errors.includes('monto inválido'))
})

test('validateNormalized rechaza requiere_atencion en RESUELTA', () => {
  const errors = validateNormalized({
    serieFolio: 'NC-1',
    empresa: 'DISTRIBUIDORA',
    estado: 'RESUELTA',
    requiereAtencion: true,
    monto: 100,
    abono: 0,
    fechaNota: '2026-03-01',
  })
  assert.ok(
    errors.some((e) => e.includes('requiere_atencion')),
    errors.join('; '),
  )
})

test('validateNormalized exige coincidencia con empresaScope', () => {
  const errors = validateNormalized(
    {
      serieFolio: 'NC-1',
      empresa: 'RODRIGO',
      monto: 100,
      abono: 0,
      fechaNota: '2026-03-01',
    },
    null,
    'DISTRIBUIDORA',
  )
  assert.ok(errors.some((e) => e.includes('debe coincidir')))
})

test('validateNormalized fila válida devuelve array vacío', () => {
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
  assert.deepEqual(errors, [])
})
