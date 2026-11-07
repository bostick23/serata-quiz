#!/usr/bin/env bash
# One-time setup of the Google Cloud project for Serata Quiz on Cloud Run.
# Use the Firebase project itself (a Firebase project is a Google Cloud project),
# so the service reaches Firestore with its own identity and no key file.
#
#   PROJECT_ID=<firebase-project-id> REGION=europe-west1 scripts/setup-cloud-run.sh
#
# Optional:
#   AUTH_SECRET  reuse the current secret (users stay logged in); generated if absent
#   SMTP_PASS    SMTP password for verification / reset emails
# Safe to run again: every step is idempotent.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-europe-west1}"
REPOSITORY="${REPOSITORY:-serata-quiz}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-serata-quiz-run}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Set PROJECT_ID to the Firebase project id" >&2
  exit 1
fi
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Enabling APIs (the project must be on the Blaze plan / have billing enabled)"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com

echo "==> Artifact Registry repository '$REPOSITORY' in $REGION"
if ! gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPOSITORY" \
    --repository-format=docker --location="$REGION" --description="Serata Quiz container images"
fi
# Keep only the 2 most recent images: the free storage allowance is small.
policy="$(mktemp)"
cat >"$policy" <<'JSON'
[
  { "name": "keep-latest-2", "action": { "type": "Keep" }, "mostRecentVersions": { "keepCount": 2 } },
  { "name": "delete-older", "action": { "type": "Delete" }, "condition": { "tagState": "any" } }
]
JSON
gcloud artifacts repositories set-cleanup-policies "$REPOSITORY" \
  --location="$REGION" --policy="$policy" --no-dry-run >/dev/null \
  || echo "WARN: cleanup policy not applied: delete old images manually to stay within the free storage" >&2
rm -f "$policy"

echo "==> Runtime service account $RUNTIME_SA"
if ! gcloud iam service-accounts describe "$RUNTIME_SA" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$RUNTIME_SA_NAME" --display-name="Serata Quiz (Cloud Run)"
fi
# Firestore read/write only: the service needs nothing else from the project.
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" --role="roles/datastore.user" --condition=None >/dev/null

echo "==> Secrets"
put_secret() { # name value
  local name="$1" value="$2"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  else
    printf '%s' "$value" | gcloud secrets create "$name" --replication-policy=automatic --data-file=- >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${RUNTIME_SA}" --role="roles/secretmanager.secretAccessor" >/dev/null
  echo "    $name: ok"
}
if [[ -n "${AUTH_SECRET:-}" ]] || ! gcloud secrets describe serata-auth-secret >/dev/null 2>&1; then
  put_secret serata-auth-secret "${AUTH_SECRET:-$(openssl rand -base64 32)}"
fi
if [[ -n "${SMTP_PASS:-}" ]]; then
  put_secret serata-smtp-pass "$SMTP_PASS"
fi

echo
echo "Setup complete. Next: PROJECT_ID=$PROJECT_ID REGION=$REGION scripts/deploy-cloud-run.sh"
