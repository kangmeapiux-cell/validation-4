#!/usr/bin/env bash
# deploy-frontend.sh — Build React app, sync to S3, invalidate CloudFront cache
# Usage: ./scripts/deploy-frontend.sh [stage]
# Example: ./scripts/deploy-frontend.sh prod

set -euo pipefail

STAGE="${1:-prod}"
STACK_NAME="validation-4"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

echo "==> [deploy-frontend] Stage: ${STAGE}"
echo "==> [deploy-frontend] Stack: ${STACK_NAME}"
echo "==> [deploy-frontend] Region: ${REGION}"

# ─── 1. Fetch CloudFormation outputs ─────────────────────────────────────────
echo "==> Fetching CloudFormation stack outputs..."

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" \
  --output text)

if [ -z "${API_URL}" ]; then
  echo "ERROR: Could not retrieve ApiBaseUrl from stack ${STACK_NAME}" >&2
  echo "       Make sure the backend is deployed first: sam build && sam deploy" >&2
  exit 1
fi

BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

if [ -z "${BUCKET_NAME}" ]; then
  echo "ERROR: Could not retrieve FrontendBucketName from stack ${STACK_NAME}" >&2
  exit 1
fi

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

if [ -z "${DISTRIBUTION_ID}" ]; then
  echo "ERROR: Could not retrieve CloudFrontDistributionId from stack ${STACK_NAME}" >&2
  exit 1
fi

CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" \
  --output text)

echo "    API URL:           ${API_URL}"
echo "    S3 Bucket:         ${BUCKET_NAME}"
echo "    CloudFront ID:     ${DISTRIBUTION_ID}"
echo "    CloudFront Domain: ${DISTRIBUTION_ID}"

# ─── 2. Build frontend ────────────────────────────────────────────────────────
echo "==> Building React frontend..."
cd "$(dirname "$0")/../frontend"

# Write .env.production with the real API URL
cat > .env.production <<EOF
VITE_API_URL=${API_URL}
EOF

npm install
VITE_API_URL="${API_URL}" npm run build

echo "    Build complete: frontend/dist/"

# ─── 3. Sync to S3 ───────────────────────────────────────────────────────────
echo "==> Syncing build artifacts to s3://${BUCKET_NAME}..."
aws s3 sync dist/ "s3://${BUCKET_NAME}/" \
  --region "${REGION}" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

# Upload index.html with no-cache so SPA routing always gets fresh shell
aws s3 cp dist/index.html "s3://${BUCKET_NAME}/index.html" \
  --region "${REGION}" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html"

echo "    S3 sync complete."

# ─── 4. Invalidate CloudFront cache ──────────────────────────────────────────
echo "==> Creating CloudFront invalidation for distribution ${DISTRIBUTION_ID}..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "    Invalidation created: ${INVALIDATION_ID}"
echo "    Waiting for invalidation to complete (this may take 1-2 minutes)..."

aws cloudfront wait invalidation-completed \
  --distribution-id "${DISTRIBUTION_ID}" \
  --id "${INVALIDATION_ID}"

echo "    CloudFront cache invalidated."

# ─── 5. Done ─────────────────────────────────────────────────────────────────
echo ""
echo "✅  Frontend deployed successfully!"
echo "    URL: https://${CLOUDFRONT_DOMAIN}"
echo ""
