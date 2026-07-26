import crypto from 'crypto';

const parsePrivateKey = (key) => {
  if (!key) return undefined;
  let cleanKey = key.trim();
  if ((cleanKey.startsWith('"') && cleanKey.endsWith('"')) || (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
    cleanKey = cleanKey.slice(1, -1);
  }
  return cleanKey.replace(/\\n/g, '\n');
};

const base64UrlEncode = (str) => {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

async function getGoogleAccessToken(clientEmail, privateKey) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedJwt = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  const signature = signer.sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedJwt}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Google OAuth error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { targetUid } = req.body || {};

  if (!targetUid) {
    return res.status(400).json({ error: 'Falta targetUid' });
  }

  try {
    let projectId = process.env.FIREBASE_PROJECT_ID;
    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      projectId = sa.project_id || projectId;
      clientEmail = sa.client_email || clientEmail;
      privateKey = parsePrivateKey(sa.private_key || privateKey);
    }

    if (!projectId || !clientEmail || !privateKey) {
      return res.status(500).json({ error: 'Configuración de Firebase incompleta en servidor' });
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);

    // 1. Eliminar documento del usuario en Firestore
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${targetUid}`;
    await fetch(firestoreUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // 2. Eliminar usuario de Firebase Authentication
    const authUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`;
    const authRes = await fetch(authUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ localId: targetUid })
    });

    if (!authRes.ok) {
      const authErr = await authRes.text();
      console.warn("Auth deletion warning:", authErr);
    }

    return res.status(200).json({ success: true, message: 'Usuario dado de baja permanentemente' });

  } catch (error) {
    console.error('Error al dar de baja usuario:', error);
    return res.status(500).json({ error: 'Error del servidor al eliminar usuario', message: error.message });
  }
}
