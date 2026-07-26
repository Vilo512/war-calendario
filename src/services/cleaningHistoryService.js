import { collection, addDoc, query, where, getDocs, deleteDoc, doc, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Elimina las entradas del histórico asociadas a una semana dada (al desmarcar la compleción).
 */
export async function removeCleaningHistoryForWeek(weekId) {
  if (!weekId) return;
  try {
    const historyRef = collection(db, 'cleaning_history');
    const q = query(historyRef, where('weekId', '==', weekId));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'cleaning_history', docSnap.id)));
    await Promise.all(deletePromises);
  } catch (err) {
    console.error("Error eliminando entradas del histórico de la semana:", err);
  }
}

/**
 * Registra una limpieza completada en la colección 'cleaning_history'.
 * Elimina registros previos de esa misma semana para evitar duplicados si se vuelve a marcar.
 */
export async function recordCleaningHistory({
  weekId,
  weekRange,
  memberId,
  memberName,
  isManual = false,
  completedByUid,
  completedByName
}) {
  try {
    if (weekId) {
      await removeCleaningHistoryForWeek(weekId);
    }

    const historyRef = collection(db, 'cleaning_history');
    await addDoc(historyRef, {
      weekId: weekId || 'N/A',
      weekRange: weekRange || 'Semana',
      memberId: memberId || 'N/A',
      memberName: memberName || 'Desconocido',
      isManual: Boolean(isManual),
      completedAt: serverTimestamp(),
      completedByUid: completedByUid || 'system',
      completedByName: completedByName || 'Administrador'
    });
  } catch (err) {
    console.error("Error registrando histórico de limpieza:", err);
  }
}

/**
 * Suscribe a los últimos registros del histórico de limpieza en tiempo real.
 */
export function subscribeCleaningHistory(callback) {
  const historyRef = collection(db, 'cleaning_history');
  const q = query(historyRef, orderBy('completedAt', 'desc'), limit(100));

  return onSnapshot(q, (snapshot) => {
    const historyList = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(historyList);
  }, (error) => {
    console.error("Error al escuchar histórico de limpieza:", error);
    callback([]);
  });
}
