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

// Publicar un nuevo anuncio oficial (Admin)
export async function createAnnouncement({ title, content, priority = 'NORMAL', user }) {
  if (!title || !title.trim()) {
    throw new Error('El anuncio debe tener un título.');
  }

  const announcementData = {
    title: title.trim(),
    content: content?.trim() || '',
    priority: priority, // 'NORMAL', 'URGENT'
    createdBy: user ? (user.displayName || user.email) : 'Administrador',
    createdAt: serverTimestamp(),
    active: true
  };

  const docRef = await addDoc(collection(db, 'announcements'), announcementData);
  return docRef.id;
}

// Eliminar un anuncio (Admin)
export async function deleteAnnouncement(announcementId) {
  await deleteDoc(doc(db, 'announcements', announcementId));
}

// Listener de todos los anuncios activos (para la vista principal y panel de admin)
export function subscribeAnnouncements(callback) {
  const q = collection(db, 'announcements');
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Ordenar descendente por fecha de creación
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(list);
  });
}
