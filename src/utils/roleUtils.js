// Utilitario y constante centralizada de Roles para la Asociación WAR
// Evita acoplamiento a cadenas de texto para poder renombrar estatus libremente en el futuro.

export const ROLES = {
  NO_SOCIO: 0,
  SEMISOCIO: 1,
  SOCIO: 2,
  ADMIN: 9
};

// Etiquetas configurables de visualización para cada rol
export const ROLE_LABELS = {
  [ROLES.NO_SOCIO]: 'No socio',
  [ROLES.SEMISOCIO]: 'Semisocio',
  [ROLES.SOCIO]: 'Socio',
  [ROLES.ADMIN]: 'Administrador'
};

/**
 * Normaliza cualquier valor de rol (sea numérico o cadena legada) al código de rol estándar.
 */
export function normalizeRole(role) {
  if (typeof role === 'number') return role;
  const r = String(role || '').toLowerCase().trim();
  if (r === 'admin' || r === '9') return ROLES.ADMIN;
  if (r === 'socio' || r === '2') return ROLES.SOCIO;
  if (r === 'semisocio' || r === 'simpatizante' || r === '1') return ROLES.SEMISOCIO;
  return ROLES.NO_SOCIO;
}

/**
 * Retorna la etiqueta legible del rol (ej: "No socio", "Semisocio", "Socio", "Administrador")
 */
export function getRoleLabel(role) {
  const code = normalizeRole(role);
  return ROLE_LABELS[code] || 'No socio';
}

/**
 * Verifica si un rol tiene permiso para realizar reservas (Socio o Admin)
 */
export function canBook(role) {
  const code = normalizeRole(role);
  return code === ROLES.SOCIO || code === ROLES.ADMIN;
}

/**
 * Verifica si un usuario es Administrador
 */
export function isAdminRole(role) {
  return normalizeRole(role) === ROLES.ADMIN;
}

/**
 * Verifica si un usuario debe ver las tareas de limpieza (Socio o Admin)
 */
export function isCleaningMember(role) {
  const code = normalizeRole(role);
  return code === ROLES.SOCIO || code === ROLES.ADMIN;
}
