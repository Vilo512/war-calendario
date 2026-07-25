import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Crear una solicitud de permuta
export async function createSwapRequest({ requesterUser, requesterWeekId, requesterWeekRange, targetUser, targetWeekId, targetWeekRange }) {
  if (!requesterUser || !targetUser || !requesterWeekId || !targetWeekId) {
    throw new Error('Información incompleta para la solicitud de permuta.');
  }

  const swapData = {
    requesterId: requesterUser.uid || requesterUser.id,
    requesterName: requesterUser.displayName || requesterUser.email,
    requesterWeekId,
    requesterWeekRange,

    targetId: targetUser.id || targetUser.uid,
    targetName: targetUser.name || targetUser.displayName || targetUser.email,
    targetWeekId,
    targetWeekRange,

    status: 'PENDING', // PENDING, ACCEPTED, REJECTED, CANCELLED
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'cleaning_swaps'), swapData);
  return docRef.id;
}

// Aceptar una permuta (transacción atómica en Firestore)
export async function acceptSwapRequest(swap) {
  if (!swap || !swap.id) throw new Error('Objeto de permuta no válido');

  await runTransaction(db, async (transaction) => {
    const swapRef = doc(db, 'cleaning_swaps', swap.id);
    const requesterWeekRef = doc(db, 'cleaning_schedule', swap.requesterWeekId);
    const targetWeekRef = doc(db, 'cleaning_schedule', swap.targetWeekId);

    // 1. Actualizar estado de la permuta
    transaction.update(swapRef, {
      status: 'ACCEPTED',
      acceptedAt: new Date()
    });

    // 2. Sobrescribir asignado de la semana del solicitante con el destinatario
    transaction.set(requesterWeekRef, {
      assigneeId: swap.targetId,
      assigneeName: swap.targetName,
      isSwap: true,
      originalAssigneeName: swap.requesterName,
      swapId: swap.id
    }, { merge: true });

    // 3. Sobrescribir asignado de la semana del destinatario con el solicitante
    transaction.set(targetWeekRef, {
      assigneeId: swap.requesterId,
      assigneeName: swap.requesterName,
      isSwap: true,
      originalAssigneeName: swap.targetName,
      swapId: swap.id
    }, { merge: true });
  });
}

// Rechazar permuta
export async function rejectSwapRequest(swapId) {
  const swapRef = doc(db, 'cleaning_swaps', swapId);
  await updateDoc(swapRef, {
    status: 'REJECTED',
    rejectedAt: new Date()
  });
}

// Cancelar permuta
export async function cancelSwapRequest(swapId) {
  const swapRef = doc(db, 'cleaning_swaps', swapId);
  await updateDoc(swapRef, {
    status: 'CANCELLED',
    cancelledAt: new Date()
  });
}

// Restablecer/Revertir permuta (Admin)
export async function resetWeekOverride(weekId) {
  const weekRef = doc(db, 'cleaning_schedule', weekId);
  await updateDoc(weekRef, {
    assigneeId: null,
    assigneeName: null,
    isSwap: false,
    originalAssigneeName: null,
    swapId: null
  });
}

// Listener en tiempo real de permutas para un usuario
export function subscribeUserSwaps(userId, callback) {
  if (!userId) return () => {};
  
  const q = collection(db, 'cleaning_swaps');
  return onSnapshot(q, (snapshot) => {
    const swaps = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.requesterId === userId || data.targetId === userId) {
        swaps.push({ id: docSnap.id, ...data });
      }
    });
    swaps.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(swaps);
  });
}

// Listener de todas las permutas (Admin)
export function subscribeAllSwaps(callback) {
  const q = collection(db, 'cleaning_swaps');
  return onSnapshot(q, (snapshot) => {
    const swaps = [];
    snapshot.forEach(docSnap => {
      swaps.push({ id: docSnap.id, ...docSnap.data() });
    });
    swaps.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(swaps);
  });
}

// Listener de la colección de semanas (override de asignados)
export function subscribeAllWeeks(callback) {
  const q = collection(db, 'cleaning_schedule');
  return onSnapshot(q, (snapshot) => {
    const weeksMap = {};
    snapshot.forEach(docSnap => {
      weeksMap[docSnap.id] = docSnap.data();
    });
    callback(weeksMap);
  });
}
