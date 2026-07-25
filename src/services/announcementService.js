import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Publicar un nuevo anuncio oficial con duración fijada opcional en días
export async function createAnnouncement({ title, content, priority = 'NORMAL', durationDays = 0, user }) {
  if (!title || !title.trim()) {
    throw new Error('El anuncio debe tener un título.');
  }

  const days = parseInt(durationDays, 10) || 0;
  let expiresAt = null;

  if (days > 0) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + days);
    expiresAt = expDate.toISOString();
  }

  const announcementData = {
    title: title.trim(),
    content: content?.trim() || '',
    priority: priority, // 'NORMAL', 'URGENT'
    durationDays: days,
    expiresAt: expiresAt, // String ISO fecha de expiración o null
    createdBy: user ? (user.displayName || user.email) : 'Admin',
    createdAt: new Date().toISOString(),
    active: true
  };

  const docRef = await addDoc(collection(db, 'announcements'), announcementData);
  return docRef.id;
}

// Eliminar un anuncio de Firestore
export async function deleteAnnouncement(announcementId) {
  if (!announcementId) throw new Error('ID de anuncio no válido');
  const ref = doc(db, 'announcements', announcementId);
  await deleteDoc(ref);
}

// Listener de todos los anuncios activos (filtrando expirados automáticamente)
export function subscribeAnnouncements(callback) {
  const q = collection(db, 'announcements');
  return onSnapshot(q, (snapshot) => {
    const list = [];
    const nowISO = new Date().toISOString();

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      // Si tiene fecha de expiración y ya venció, se omite de la vista
      if (data.expiresAt && data.expiresAt < nowISO) {
        return;
      }
      list.push({ id: docSnap.id, ...data });
    });

    // Ordenar descendente por fecha de creación
    list.sort((a, b) => {
      const dateA = a.createdAt || '';
      const dateB = b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    callback(list);
  }, (error) => {
    console.error("Error al escuchar anuncios:", error);
    callback([]);
  });
}
