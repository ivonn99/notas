/**
 * Permisos de navegación (mismo criterio que MainLayout y rutas protegidas).
 * @param {{ rol?: string, isSuperuser?: boolean } | null | undefined} user
 */
export function getNavFlags(user) {
  if (!user) {
    return {
      isAdmin: false,
      canCredito: false,
      canSeguimiento: false,
    }
  }
  const isAdmin = Boolean(user.isSuperuser || user.rol === 'ADMIN')
  const canCredito =
    Boolean(user.isSuperuser) || ['ADMIN', 'CREDITO'].includes(user.rol)
  const canSeguimiento =
    Boolean(user.isSuperuser) ||
    ['ADMIN', 'CREDITO', 'VENDEDOR'].includes(user.rol)
  return { isAdmin, canCredito, canSeguimiento }
}
