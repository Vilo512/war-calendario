import { collection, addDoc, setDoc, query, where, getDocs, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getWeekId, formatWeekRange, getNextWeekMonday, calculateAssigneeForDate } from '../utils/cleaningUtils';

const FIRST_HISTORICAL_WEEK_ID = '2026-08-17';

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
 * Permite a un Administrador validar o desmarcar una semana específica (pasada o actual) desde el histórico.
 */
export async function setWeekCleaningStatusByAdmin({
  weekId,
  weekRange,
  memberId,
  memberName,
  isManual = false,
  adminUser,
  completed = true
}) {
  if (!weekId) return;
  const adminLabel = `Finalizado por Admin: ${adminUser?.displayName || adminUser?.email || 'Admin'}`;

  await setDoc(doc(db, 'cleaning_schedule', weekId), {
    assigneeId: memberId || 'manual',
    assigneeName: memberName || 'Socio',
    isManual: Boolean(isManual),
    completed: Boolean(completed),
    completedBy: completed ? adminLabel : null,
    completedByRole: completed ? 'admin' : null,
    completedAt: completed ? new Date() : null,
    weekRange: weekRange || weekId
  }, { merge: true });

  if (completed) {
    await recordCleaningHistory({
      weekId,
      weekRange,
      memberId: memberId || 'manual',
      memberName: memberName || 'Socio',
      isManual: Boolean(isManual),
      completedByUid: adminUser?.uid || 'admin',
      completedByName: adminLabel
    });
  } else {
    await removeCleaningHistoryForWeek(weekId);
  }
}

/**
 * Suscribe al histórico completo de limpiezas (tanto semanas realizadas como no realizadas)
 * desde el inicio del cuadrante (2026-08-17) hasta la semana actual.
 */
export function subscribeCleaningHistory(callback) {
  const historyRef = collection(db, 'cleaning_history');
  const scheduleRef = collection(db, 'cleaning_schedule');

  let historyDocs = [];
  let scheduleMap = {};
  let historyLoaded = false;
  let scheduleLoaded = false;

  const buildCombinedHistory = () => {
    if (!historyLoaded || !scheduleLoaded) return;

    const currentWeekId = getWeekId(new Date());
    const config = scheduleMap['config'] || { members: [] };
    const members = config.members || [];
    const startDate = config.startDate?.toDate
      ? config.startDate.toDate()
      : (config.startDate ? new Date(config.startDate) : new Date());

    // Indexar cleaning_history por weekId (quedándonos con el más reciente si hubiera duplicados)
    const historyByWeek = {};
    historyDocs.forEach((h) => {
      if (!h.weekId) return;
      const existing = historyByWeek[h.weekId];
      if (!existing) {
        historyByWeek[h.weekId] = h;
      } else {
        const tNew = h.completedAt?.toMillis ? h.completedAt.toMillis() : (h.completedAt ? new Date(h.completedAt).getTime() : 0);
        const tOld = existing.completedAt?.toMillis ? existing.completedAt.toMillis() : (existing.completedAt ? new Date(existing.completedAt).getTime() : 0);
        if (tNew >= tOld) historyByWeek[h.weekId] = h;
      }
    });

    // Generar todas las semanas desde FIRST_HISTORICAL_WEEK_ID hasta currentWeekId
    const allWeekIds = new Set();
    const [sy, sm, sd] = FIRST_HISTORICAL_WEEK_ID.split('-').map(Number);
    let cursorDate = new Date(sy, sm - 1, sd, 12, 0, 0);
    let safety = 0;

    while (safety < 260) {
      const wId = getWeekId(cursorDate);
      if (wId > currentWeekId) break;
      allWeekIds.add(wId);
      cursorDate = getNextWeekMonday(cursorDate);
      safety++;
    }

    // Añadir cualquier otra semana existente en schedule o history <= currentWeekId
    Object.keys(scheduleMap).forEach((k) => {
      if (k !== 'config' && /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= currentWeekId) {
        allWeekIds.add(k);
      }
    });
    Object.keys(historyByWeek).forEach((k) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && k <= currentWeekId) {
        allWeekIds.add(k);
      }
    });

    const combinedList = Array.from(allWeekIds).map((wId) => {
      const [y, m, d] = wId.split('-').map(Number);
      const weekDate = new Date(y, m - 1, d, 12, 0, 0);
      const defaultRange = formatWeekRange(weekDate);

      const schedDoc = scheduleMap[wId] || null;
      const histDoc = historyByWeek[wId] || null;

      const isCompleted = Boolean((schedDoc && schedDoc.completed) || histDoc);

      let fallbackAssignee = null;
      if (!schedDoc?.assigneeName && !histDoc?.memberName && !schedDoc?.completedBy && members.length > 0) {
        const calc = calculateAssigneeForDate(members, startDate, weekDate);
        if (calc) fallbackAssignee = calc.assignee;
      }

      const memberName =
        schedDoc?.assigneeName ||
        histDoc?.memberName ||
        schedDoc?.completedBy ||
        fallbackAssignee?.name ||
        'Sin asignar';

      const memberId =
        schedDoc?.assigneeId ||
        histDoc?.memberId ||
        fallbackAssignee?.id ||
        'N/A';

      const isManual = Boolean(
        schedDoc?.isManual ??
        histDoc?.isManual ??
        fallbackAssignee?.isManual ??
        false
      );

      const weekRange =
        schedDoc?.weekRange ||
        histDoc?.weekRange ||
        defaultRange;

      const completedAt =
        schedDoc?.completedAt ||
        histDoc?.completedAt ||
        null;

      const completedByName =
        schedDoc?.completedBy ||
        histDoc?.completedByName ||
        (isCompleted ? memberName : null);

      const status = isCompleted
        ? 'COMPLETED'
        : (wId === currentWeekId ? 'IN_PROGRESS' : 'NOT_COMPLETED');

      return {
        id: histDoc?.id || `week_${wId}`,
        weekId: wId,
        weekRange,
        memberId,
        memberName,
        isManual,
        completed: isCompleted,
        status,
        completedAt,
        completedByName,
        isSwap: Boolean(schedDoc?.isSwap),
        originalAssigneeName: schedDoc?.originalAssigneeName || null
      };
    });

    // Ordenar por semana descendente (más reciente primero)
    combinedList.sort((a, b) => b.weekId.localeCompare(a.weekId));
    callback(combinedList);
  };

  const unsubHistory = onSnapshot(historyRef, (snapshot) => {
    historyDocs = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    historyLoaded = true;
    buildCombinedHistory();
  }, (error) => {
    console.error("Error al escuchar cleaning_history:", error);
    historyLoaded = true;
    buildCombinedHistory();
  });

  const unsubSchedule = onSnapshot(scheduleRef, (snapshot) => {
    const nextMap = {};
    snapshot.forEach(docSnap => {
      nextMap[docSnap.id] = docSnap.data();
    });
    scheduleMap = nextMap;
    scheduleLoaded = true;
    buildCombinedHistory();
  }, (error) => {
    console.error("Error al escuchar cleaning_schedule:", error);
    scheduleLoaded = true;
    buildCombinedHistory();
  });

  return () => {
    unsubHistory();
    unsubSchedule();
  };
}
