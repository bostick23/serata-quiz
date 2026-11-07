import type { ServiceAccount } from "firebase-admin/app";

export type FirebaseCredentialSource =
  | { kind: "service-account"; serviceAccount: ServiceAccount }
  | { kind: "application-default" };

/**
 * FIREBASE_SERVICE_ACCOUNT (JSON key) when set — local development or hosts
 * outside Google Cloud. Otherwise Application Default Credentials: on Cloud Run
 * that is the service's own identity, so no private key has to be stored.
 */
export function resolveFirebaseCredential(env: Record<string, string | undefined>): FirebaseCredentialSource {
  const raw = env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return { kind: "application-default" };
  try {
    return { kind: "service-account", serviceAccount: JSON.parse(raw) as ServiceAccount };
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON");
  }
}
