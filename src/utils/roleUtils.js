import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Utilitario y constante centralizada de Roles para la Asociación WAR
export const ROLES = {
  NO_SOCIO: 0,
  SEMISOCIO: 1,
  SOCIO: 2,
  ADMIN: 9
};

// Etiquetas por defecto de visualización para cada rol
export const DEFAULT_ROLE_LABELS = {
  [ROLES.NO_SOCIO]: 'No socio',
  [ROLES.SEMISOCIO]: 'Semisocio',
  [ROLES.SOCIO]: 'Socio',
  [ROLES.ADMIN]: 'Admin'
};

export const ROLE_LABELS = { ...DEFAULT_ROLE_LABELS };

/**
 * Normaliza cualquier valor de rol (sea numérico o cadena legada) al código de rol estándar.
 */
export function normalizeRole(role) {
  if (typeof role === 'number') return role;
  const r = String(role || '').toLowerCase().trim();
  if (r === 'admin' || r === '9' || r === 'administrador') return ROLES.ADMIN;
  if (r === 'socio' || r === '2') return ROLES.SOCIO;
  if (r === 'semisocio' || r === 'simpatizante' || r === '1') return ROLES.SEMISOCIO;
  return ROLES.NO_SOCIO;
}

/**
 * Retorna la etiqueta legible del rol (ej: "No socio", "Semisocio", "Socio", "Admin")
 * Acepta un mapa opcional de etiquetas personalizadas configuradas en Firestore.
 */
export function getRoleLabel(role, customLabels = null) {
  const code = normalizeRole(role);
  if (customLabels && customLabels[code]) {
    return customLabels[code];
  }
  return DEFAULT_ROLE_LABELS[code] || 'No socio';
}

/**
 * Escucha en tiempo real la configuración de nombres de roles desde Firestore
 */
export function subscribeRoleLabels(callback) {
  const ref = doc(db, 'config', 'role_labels');
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      callback({
        [ROLES.NO_SOCIO]: data.label_0 || DEFAULT_ROLE_LABELS[ROLES.NO_SOCIO],
        [ROLES.SEMISOCIO]: data.label_1 || DEFAULT_ROLE_LABELS[ROLES.SEMISOCIO],
        [ROLES.SOCIO]: data.label_2 || DEFAULT_ROLE_LABELS[ROLES.SOCIO],
        [ROLES.ADMIN]: data.label_9 || DEFAULT_ROLE_LABELS[ROLES.ADMIN],
      });
    } else {
      callback(DEFAULT_ROLE_LABELS);
    }
  }, (err) => {
    console.error("Error al escuchar role_labels:", err);
    callback(DEFAULT_ROLE_LABELS);
  });
}

/**
 * Guarda los nombres personalizados de roles en Firestore (Admin)
 */
export async function updateRoleLabels(newLabels) {
  const ref = doc(db, 'config', 'role_labels');
  await setDoc(ref, {
    label_0: newLabels[ROLES.NO_SOCIO],
    label_1: newLabels[ROLES.SEMISOCIO],
    label_2: newLabels[ROLES.SOCIO],
    label_9: newLabels[ROLES.ADMIN]
  }, { merge: true });
}

/**
 * Verifica si un rol tiene permiso para realizar reservas (Socio o Admin)
 */
export function canBook(role) {
  const code = normalizeRole(role);
  return code === ROLES.SOCIO || code === ROLES.ADMIN;
}

/**
 * Verifica si un usuario es Admin
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

/**
 * Verifica si un usuario es al menos Socio (Socio o Admin)
 */
export function isSocio(role) {
  const code = normalizeRole(role);
  return code === ROLES.SOCIO || code === ROLES.ADMIN;
}

/**
 * Verifica si un usuario es al menos Semisocio (Semisocio, Socio o Admin)
 */
export function isSemiSocio(role) {
  const code = normalizeRole(role);
  return code === ROLES.SEMISOCIO || code === ROLES.SOCIO || code === ROLES.ADMIN;
}
