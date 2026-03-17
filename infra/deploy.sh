#!/bin/bash
# Group 1 Club — Deploy to AWS
# Usage:
#   First time:  bash infra/deploy.sh setup
#   Deploy:      bash infra/deploy.sh deploy
#   Status:      bash infra/deploy.sh status
#   Destroy:     bash infra/deploy.sh destroy (asks for confirmation)

set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-2}"
ENV="${G1CLUB_ENV:-staging}"
STACK_NAME="g1club-${ENV}"
ECR_REPO="g1club-${ENV}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")

red()   { echo -e "\033[31m$1\033[0m"; }
green() { echo -e "\033[32m$1\033[0m"; }
blue()  { echo -e "\033[34m$1\033[0m"; }

# ─── Preflight checks ───
check_prereqs() {
  for cmd in aws docker; do
    if ! command -v $cmd &>/dev/null; then
      red "Missing: $cmd — install it first"
      exit 1
    fi
  done

  if [ -z "$ACCOUNT_ID" ]; then
    red "AWS credentials not configured. Run: aws configure"
    exit 1
  fi

  green "AWS Account: $ACCOUNT_ID | Region: $REGION | Env: $ENV"
}

# ─── Create/Update CloudFormation stack ───
cmd_setup() {
  check_prereqs
  blue "Setting up CloudFormation stack: $STACK_NAME"

  # Prompt for secrets if not set
  if [ -z "${DB_PASSWORD:-}" ]; then
    read -sp "Database password (min 12 chars): " DB_PASSWORD
    echo
  fi
  if [ -z "${NEXTAUTH_SECRET:-}" ]; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    green "Generated NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:0:10}..."
  fi
  if [ -z "${CRON_SECRET:-}" ]; then
    CRON_SECRET=$(openssl rand -base64 16)
    green "Generated CRON_SECRET: ${CRON_SECRET:0:10}..."
  fi

  aws cloudformation deploy \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --template-file infra/cloudformation.yaml \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
      Environment="$ENV" \
      DBMasterPassword="$DB_PASSWORD" \
      NextAuthSecret="$NEXTAUTH_SECRET" \
      CronSecret="$CRON_SECRET" \
      BetfairApiKey="${BETFAIR_API_KEY:-}" \
    --tags \
      Project=group1club \
      Environment="$ENV"

  green "Stack deployed! Getting outputs..."
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs' \
    --output table

  echo ""
  blue "Next steps:"
  echo "  1. Push Docker image:  bash infra/deploy.sh deploy"
  echo "  2. Run DB migration:   bash infra/deploy.sh migrate"
  echo "  3. Set up SES:         Check AWS Console > SES > Verify domain + add DKIM records"
  echo ""
  echo "Save these secrets somewhere safe (shown once only):"
  echo "  NEXTAUTH_SECRET=${NEXTAUTH_SECRET:0:8}... (full value in AWS SSM/Secrets Manager)"
  echo "  CRON_SECRET=${CRON_SECRET:0:8}... (full value in AWS SSM/Secrets Manager)"
}

# ─── Build + push Docker image + trigger deploy ───
cmd_deploy() {
  check_prereqs

  ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"

  blue "Building Docker image..."
  docker build -t g1club:latest .

  blue "Logging into ECR..."
  aws ecr get-login-password --region "$REGION" | \
    docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

  blue "Pushing to ECR..."
  docker tag g1club:latest "${ECR_URI}:latest"
  docker push "${ECR_URI}:latest"

  blue "Triggering App Runner deployment..."
  SERVICE_ARN=$(aws apprunner list-services \
    --region "$REGION" \
    --query "ServiceSummaryList[?ServiceName=='${STACK_NAME}'].ServiceArn" \
    --output text)

  if [ -n "$SERVICE_ARN" ]; then
    aws apprunner start-deployment --region "$REGION" --service-arn "$SERVICE_ARN"
    green "Deployment triggered! Monitor at:"
    echo "  https://${REGION}.console.aws.amazon.com/apprunner/home?region=${REGION}"
  else
    red "App Runner service not found. Run 'bash infra/deploy.sh setup' first."
    exit 1
  fi
}

# ─── Run Prisma migration against RDS ───
cmd_migrate() {
  check_prereqs

  DB_URL=$(aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='DatabaseURL'].OutputValue" \
    --output text)

  if [ -z "$DB_URL" ] || [ "$DB_URL" = "None" ]; then
    red "Could not get database URL from stack outputs"
    exit 1
  fi

  blue "Running Prisma migration..."
  echo "Note: You need to update prisma/schema.prisma provider to 'postgresql' first"

  DATABASE_URL="$DB_URL" npx prisma migrate deploy
  DATABASE_URL="$DB_URL" npx prisma db seed

  green "Migration + seed complete!"
}

# ─── Show stack status ───
cmd_status() {
  check_prereqs

  blue "Stack: $STACK_NAME"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].{Status:StackStatus,Created:CreationTime}' \
    --output table 2>/dev/null || red "Stack not found"

  echo ""
  blue "App Runner:"
  aws apprunner list-services \
    --region "$REGION" \
    --query "ServiceSummaryList[?ServiceName=='${STACK_NAME}'].{Status:Status,URL:ServiceUrl}" \
    --output table 2>/dev/null || echo "  No services"

  echo ""
  blue "RDS:"
  aws rds describe-db-instances \
    --region "$REGION" \
    --db-instance-identifier "${STACK_NAME}" \
    --query "DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address}" \
    --output table 2>/dev/null || echo "  No database"
}

# ─── Tear down (with confirmation) ───
cmd_destroy() {
  check_prereqs
  red "WARNING: This will delete the ${STACK_NAME} stack (database snapshot will be kept)"
  read -p "Type 'delete ${STACK_NAME}' to confirm: " confirm
  if [ "$confirm" != "delete ${STACK_NAME}" ]; then
    echo "Cancelled."
    exit 0
  fi

  # Disable deletion protection on RDS first
  aws rds modify-db-instance \
    --region "$REGION" \
    --db-instance-identifier "${STACK_NAME}" \
    --no-deletion-protection 2>/dev/null || true

  aws cloudformation delete-stack \
    --region "$REGION" \
    --stack-name "$STACK_NAME"

  green "Stack deletion initiated. A final DB snapshot will be saved."
}

# ─── Route ───
case "${1:-help}" in
  setup)   cmd_setup ;;
  deploy)  cmd_deploy ;;
  migrate) cmd_migrate ;;
  status)  cmd_status ;;
  destroy) cmd_destroy ;;
  *)
    echo "Group 1 Club Deploy"
    echo ""
    echo "Usage: bash infra/deploy.sh <command>"
    echo ""
    echo "Commands:"
    echo "  setup    Create AWS infrastructure (first time)"
    echo "  deploy   Build + push Docker image + trigger deploy"
    echo "  migrate  Run Prisma migrations against RDS"
    echo "  status   Show current infrastructure status"
    echo "  destroy  Tear down everything (with confirmation)"
    echo ""
    echo "Environment variables:"
    echo "  AWS_REGION    (default: ap-southeast-2)"
    echo "  G1CLUB_ENV    (default: staging)"
    echo "  DB_PASSWORD   Database password"
    ;;
esac
