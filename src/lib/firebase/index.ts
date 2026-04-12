import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _db: Firestore | null = null;

function getDb(): Firestore {
  if (_db) return _db;

  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT env var is missing");
    }
    const serviceAccount = JSON.parse(raw) as ServiceAccount;
    initializeApp({ credential: cert(serviceAccount) });
  }

  _db = getFirestore();
  return _db;
}

export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop, _receiver) {
    const real = getDb();
    const value = (real as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(real);
    }
    return value;
  },
});
