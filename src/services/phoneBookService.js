import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { encryptText, decryptText } from './cryptoService';

/**
 * Normalizes a phone number to international format without + or spaces
 * Default to Spain prefix (+34) if 9 digits starting with 6, 7 or 8/9
 */
export function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  // Eliminar espacios, guiones, paréntesis y puntos
  let cleaned = String(rawPhone).trim().replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (/^[6789]\d{8}$/.test(cleaned)) {
    // 9 dígitos estándar de España sin prefijo
    cleaned = '34' + cleaned;
  }

  return cleaned;
}

/**
 * Saves an encrypted phone number for a user in the protected admin_phone_book collection
 */
export async function saveUserPhone(userId, plainPhone, adminUid = null) {
  if (!userId) throw new Error('userId es requerido');

  const normalized = normalizePhoneNumber(plainPhone);
  if (!normalized) {
    // Si se pasa vacío, eliminar el registro
    await deleteDoc(doc(db, 'admin_phone_book', userId));
    return null;
  }

  const encrypted = await encryptText(normalized);
  if (!encrypted) throw new Error('Error al cifrar el número de teléfono');

  const phoneDocRef = doc(db, 'admin_phone_book', userId);
  await setDoc(phoneDocRef, {
    userId,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid || 'admin'
  });

  return normalized;
}

/**
 * Retrieves and decrypts the phone number for a single user (Admin only)
 */
export async function getUserPhone(userId) {
  if (!userId) return null;

  try {
    const docSnap = await getDoc(doc(db, 'admin_phone_book', userId));
    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    if (!data.ciphertext || !data.iv) return null;

    const decrypted = await decryptText({
      ciphertext: data.ciphertext,
      iv: data.iv
    });

    return decrypted;
  } catch (error) {
    console.error(`Error al recuperar teléfono del usuario ${userId}:`, error);
    return null;
  }
}

/**
 * Retrieves and decrypts all phone numbers in the directory (Admin only)
 * Returns a map of userId -> decryptedPhone
 */
export async function getAllUserPhones() {
  try {
    const snapshot = await getDocs(collection(db, 'admin_phone_book'));
    const phoneMap = {};

    const decryptPromises = snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const uId = docSnap.id;
      if (data.ciphertext && data.iv) {
        const phone = await decryptText({
          ciphertext: data.ciphertext,
          iv: data.iv
        });
        if (phone) {
          phoneMap[uId] = phone;
        }
      }
    });

    await Promise.all(decryptPromises);
    return phoneMap;
  } catch (error) {
    console.error('Error al recuperar directorio de teléfonos:', error);
    return {};
  }
}

/**
 * Deletes a user phone from the directory
 */
export async function deleteUserPhone(userId) {
  if (!userId) return;
  await deleteDoc(doc(db, 'admin_phone_book', userId));
}
