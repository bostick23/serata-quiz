#!/usr/bin/env bash
# Builds the image with Cloud Build and deploys it to Cloud Run.
# Run scripts/setup-cloud-run.sh once before the first deploy.
#
#   PROJECT_ID=<firebase-project-id> REGION=europe-west1 scripts/deploy-cloud-run.sh
#
# Optional environment:
#   APP_URL          public URL if you map a custom domain (default: the Cloud Run URL)
#   SMTP_HOST, SMTP_USER, SMTP_PORT (587), SMTP_SECURE (false), SMTP_FROM
#                    email settings; the password comes from the serata-smtp-pass secret
#   NEXT_PUBLIC_ADSENSE_CLIENT_ID, NEXT_PUBLIC_ADSENSE_SLOT_ID
#                    AdSense ids (inlined in the browser bundle at build time)
#
# Do not deploy during a quiz night: Cloud Run keeps existing connections on the
# old revision while new ones reach the new revision, splitting the live game.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-serata-quiz}"
REPOSITORY="${REPOSITORY:-serata-quiz}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-serata-quiz-run}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Set PROJECT_ID to the Firebase project id" >&2
  exit 1
fi
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d-%H%M%S)}"
# Uncommitted changes: never reuse the tag of the clean commit.
if ! git diff --quiet HEAD 2>/dev/null; then TAG="${TAG}-dirty-$(date +%H%M%S)"; fi
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE}:${TAG}"

echo "==> Building $IMAGE"
gcloud builds submit --project="$PROJECT_ID" --config=cloudbuild.yaml \
  --substitutions="_IMAGE=${IMAGE},_ADSENSE_CLIENT_ID=${NEXT_PUBLIC_ADSENSE_CLIENT_ID:-},_ADSENSE_SLOT_ID=${NEXT_PUBLIC_ADSENSE_SLOT_ID:-}" \
  .

# The public URL feeds NextAuth and the QR code. On the very first deploy it is
# known only afterwards, so it is set with a follow-up update.
EXISTING_URL="$(gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --format='value(status.url)' 2>/dev/null || true)"
PUBLIC_URL="${APP_URL:-$EXISTING_URL}"

# "|" as list separator (gcloud topic escaping): values may contain commas or spaces.
ENV_VARS="AUTH_TRUST_HOST=true"
SECRETS="AUTH_SECRET=serata-auth-secret:latest"
if [[ -n "$PUBLIC_URL" ]]; then ENV_VARS+="|NEXTAUTH_URL=${PUBLIC_URL}"; fi
if [[ -n "${SMTP_HOST:-}" ]]; then
  ENV_VARS+="|SMTP_HOST=${SMTP_HOST}|SMTP_PORT=${SMTP_PORT:-587}|SMTP_SECURE=${SMTP_SECURE:-false}"
  ENV_VARS+="|SMTP_USER=${SMTP_USER:?SMTP_USER is required with SMTP_HOST}"
  if [[ -n "${SMTP_FROM:-}" ]]; then ENV_VARS+="|SMTP_FROM=${SMTP_FROM}"; fi
  SECRETS+=",SMTP_PASS=serata-smtp-pass:latest"
fi

echo "==> Deploying $SERVICE to Cloud Run ($REGION)"
# - max-instances 1: game state lives in the memory of a single instance
# - concurrency 1000: every connected phone is one open request
# - timeout 3600: WebSockets last up to 60 min, then clients reconnect automatically
# - min-instances 0 + cpu-throttling: billed only while someone is connected
gcloud run deploy "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$IMAGE" \
  --service-account="$RUNTIME_SA" \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --cpu-boost \
  --cpu-throttling \
  --min-instances=0 \
  --max-instances=1 \
  --concurrency=1000 \
  --timeout=3600 \
  --session-affinity \
  --update-env-vars="^|^${ENV_VARS}" \
  --update-secrets="${SECRETS}"

URL="$(gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
if [[ -z "$PUBLIC_URL" ]]; then
  echo "==> First deploy: setting NEXTAUTH_URL=$URL"
  gcloud run services update "$SERVICE" --project="$PROJECT_ID" --region="$REGION" \
    --update-env-vars="NEXTAUTH_URL=${URL}" >/dev/null
  PUBLIC_URL="$URL"
fi

echo
echo "Deployed: ${PUBLIC_URL}"
echo "Health:   ${URL}/api/health"
