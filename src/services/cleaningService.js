import { collection, query, orderBy, limit, getDocs, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config'; // Suponiendo config en src/firebase/config.js

/**
 * Genera el próximo turno de limpieza rotando al siguiente usuario.
 * Utiliza una transacción para asegurar que no haya colisiones de creación al mismo tiempo.
 */
export async function generateNextCleaningTurn() {
  const scheduleRef = collection(db, 'cleaning_schedule');
  const usersRef = collection(db, 'users');
  
  // Como runTransaction no permite querys complejas dentro, primero hacemos los reads.
  // Obtenemos el último turno generado para saber en qué semana y año nos quedamos.
  const lastScheduleQuery = query(scheduleRef, orderBy('year', 'desc'), orderBy('weekNumber', 'desc'), limit(1));
  const scheduleSnapshot = await getDocs(lastScheduleQuery);
  
  let nextYear = new Date().getFullYear();
  // Semana 1 como default si no hay
  let nextWeekNumber = 1;
  let lastAssignedUserId = null;

  if (!scheduleSnapshot.empty) {
    const lastDoc = scheduleSnapshot.docs[0].data();
    nextYear = lastDoc.year;
    nextWeekNumber = lastDoc.weekNumber + 1;
    // Manejo básico de cambio de año (ej. 52 semanas, se puede mejorar con luxon o date-fns)
    if (nextWeekNumber > 52) {
      nextWeekNumber = 1;
      nextYear += 1;
    }
    lastAssignedUserId = lastDoc.assignedUserId;
  }

  // Obtenemos la lista de usuarios para determinar quién es el siguiente.
  // Lo ideal es tenerlos ordenados de forma consistente (ej. por fecha de creación o displayName).
  const usersQuery = query(usersRef, orderBy('createdAt', 'asc'));
  const usersSnapshot = await getDocs(usersQuery);
  const users = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  if (users.length === 0) {
    throw new Error('No users available for cleaning schedule.');
  }

  let nextUserIndex = 0;
  if (lastAssignedUserId) {
    const lastIndex = users.findIndex(u => u.id === lastAssignedUserId);
    if (lastIndex !== -1) {
      nextUserIndex = (lastIndex + 1) % users.length;
    }
  }

  const nextAssignedUser = users[nextUserIndex];
  const newScheduleId = `${nextYear}-W${nextWeekNumber.toString().padStart(2, '0')}`;
  const newScheduleDocRef = doc(db, 'cleaning_schedule', newScheduleId);

  // Transacción para asegurar que nadie más ha creado esta semana de limpieza.
  await runTransaction(db, async (transaction) => {
    const docSnapshot = await transaction.get(newScheduleDocRef);
    if (docSnapshot.exists()) {
      throw new Error(`Schedule for ${newScheduleId} already exists! Conflict avoided.`);
    }

    transaction.set(newScheduleDocRef, {
      id: newScheduleId,
      year: nextYear,
      weekNumber: nextWeekNumber,
      assignedUserId: nextAssignedUser.id,
      status: 'pending',
      completedAt: null
    });
  });

  return newScheduleId;
}
