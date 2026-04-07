/**
 * Texto legible al terminar una importación (usa contadores de `importaciones` o del job en memoria).
 */
export function buildImportacionResumenMessage(importacionId, pollResult) {
  const id = importacionId != null ? String(importacionId) : '?'
  const root = pollResult && typeof pollResult === 'object' ? pollResult : {}
  const imp = root.importacion && typeof root.importacion === 'object' ? root.importacion : {}

  const estado = String(imp.estado ?? root.status ?? '').toUpperCase()
  const nuevos = Number(root.registros_nuevos ?? imp.registros_nuevos ?? 0) || 0
  const actualizados = Number(root.registros_actualizados ?? imp.registros_actualizados ?? 0) || 0
  const resueltosAuto = Number(root.registros_resueltos ?? imp.registros_resueltos ?? 0) || 0

  const rawObs = String(imp.observaciones ?? '')
  const errM = rawObs.match(/errores\s*=\s*(\d+)/i)
  const erroresFilas = errM ? Number.parseInt(errM[1], 10) || 0 : 0
  const descM = rawObs.match(/resueltos_descarte\s*=\s*(\d+)/i)
  const descarteDesdeObs = descM ? Number.parseInt(descM[1], 10) : null

  const aplicadas = nuevos + actualizados
  /** Coincide con `registros_resueltos` al finalizar; observaciones llevan el detalle explícito. */
  const resueltasPorDescarte =
    descarteDesdeObs != null && Number.isFinite(descarteDesdeObs)
      ? descarteDesdeObs
      : resueltosAuto

  if (estado === 'FALLIDA') {
    const fallo =
      rawObs.replace(/^FALLIDA:\s*/i, '').trim() ||
      String(root.error || '').trim() ||
      'Revisa el historial de importaciones.'
    return `Importación #${id} falló. ${fallo}`
  }

  const cabecera =
    estado === 'PARCIAL'
      ? `Importación #${id} finalizada con incidencias (PARCIAL).`
      : `Importación #${id} finalizada correctamente.`

  const lineas = [cabecera]

  lineas.push(
    `Del archivo se importaron ${aplicadas} nota${aplicadas === 1 ? '' : 's'} (${nuevos} nueva${nuevos === 1 ? '' : 's'}, ${actualizados} actualizada${actualizados === 1 ? '' : 's'}).`,
  )

  lineas.push(
    estado === 'PARCIAL'
      ? `Descarte (cierre automático): no se ejecutó (importación PARCIAL con errores); no se cerró ninguna nota por descarte.`
      : resueltasPorDescarte > 0
        ? `Descarte (cierre automático): se marcaron ${resueltasPorDescarte} nota${resueltasPorDescarte === 1 ? '' : 's'} como RESUELTA — sin RESUELTA en la empresa elegida y su folio ya no venía en el archivo.`
        : `Descarte (cierre automático): 0 notas. Solo se cierran por descarte las que siguen sin RESUELTA y cuyo folio no viene en el archivo; aquí no hubo ninguna en ese caso.`,
  )

  if (estado === 'PARCIAL' && erroresFilas > 0) {
    lineas.push(
      `Hubo ${erroresFilas} fila${erroresFilas === 1 ? '' : 's'} con error; revisa el detalle en el historial.`,
    )
  }

  lineas.push('Puedes revisar el historial para el detalle completo.')

  return lineas.join('\n\n')
}
