import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { resolveFirebaseCredential } from "./credentials";

let _db: Firestore | null = null;

function getDb(): Firestore {
  if (_db) return _db;

  if (getApps().length === 0) {
    const source = resolveFirebaseCredential(process.env);
    initializeApp({
      credential: source.kind === "service-account" ? cert(source.serviceAccount) : applicationDefault(),
    });
  }

  _db = getFirestore();
  return _db;
}

export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    const real = getDb();
    const value = (real as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(real);
    }
    return value;
  },
});
