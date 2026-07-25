import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Tipos legibles de incidencias
export const INCIDENT_TYPES = {
  NOT_DONE: 'Limpieza No Realizada',
  INCOMPLETE: 'Limpieza Incompleta',
  MISSING_SUPPLIES: 'Falta Material o Basura Acumulada',
  OTHER: 'Otro Motivo'
};

// Crear una incidencia de limpieza
export async function createIncident({ weekId, weekRange, assignedMemberName, reporterUser, type, description }) {
  if (!reporterUser || !weekId) {
    throw new Error('Información incompleta para reportar la incidencia.');
  }

  const incidentData = {
    weekId,
    weekRange: weekRange || weekId,
    assignedMemberName: assignedMemberName || 'Sin asignar',
    reporterId: reporterUser.uid || reporterUser.id,
    reporterName: reporterUser.displayName || reporterUser.email,
    type: type || 'NOT_DONE',
    description: description?.trim() || '',
    status: 'OPEN', // OPEN, RESOLVED, DISMISSED
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'cleaning_incidents'), incidentData);
  return docRef.id;
}

// Resolver incidencia (Admin)
export async function resolveIncident(incidentId, adminNotes = '') {
  const ref = doc(db, 'cleaning_incidents', incidentId);
  await updateDoc(ref, {
    status: 'RESOLVED',
    resolvedAt: new Date(),
    adminNotes: adminNotes.trim()
  });
}

// Descartar incidencia (Admin)
export async function dismissIncident(incidentId) {
  const ref = doc(db, 'cleaning_incidents', incidentId);
  await updateDoc(ref, {
    status: 'DISMISSED',
    dismissedAt: new Date()
  });
}

// Listener de incidencias abiertas (para badges de notificación)
export function subscribeOpenIncidents(callback) {
  const q = collection(db, 'cleaning_incidents');
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.status === 'OPEN') {
        list.push({ id: docSnap.id, ...data });
      }
    });
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(list);
  });
}

// Listener de todas las incidencias (Admin)
export function subscribeAllIncidents(callback) {
  const q = collection(db, 'cleaning_incidents');
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(list);
  });
}
