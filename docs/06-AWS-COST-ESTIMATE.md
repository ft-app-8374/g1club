# Group 1 Club — AWS Cost Estimate

## Usage Profile

- **Active season**: 3 months (Aug-Nov)
- **Off-season**: 9 months (minimal traffic — honour roll, login, historical views)
- **Users**: 50-100
- **Peak traffic**: Race days (Saturdays), especially Melbourne Cup week
- **API calls**: ~100-200 TAB API calls per race day, near-zero otherwise

## Recommended Stack: App Runner + RDS

### Monthly Cost During Carnival Season (3 months)

| Service | Spec | $/month |
|---------|------|---------|
| **App Runner** | 0.25 vCPU / 0.5 GB RAM, auto-pause | $7-15 |
| **RDS PostgreSQL** | db.t4g.micro, 20GB storage, single-AZ | $13-16 |
| **CloudFront** | <10 GB transfer, <1M requests | $1-2 |
| **Route 53** | 1 hosted zone, ~10K queries/mo | $0.50 |
| **SES** | ~200-500 emails/mo | $0.10 |
| **EventBridge** | ~500 cron invocations/mo | $0.00 |
| **S3** | <1 GB (assets + backups) | $0.03 |
| **Certificate Manager** | SSL cert for group1club.com | $0.00 |
| **CloudWatch** | Basic monitoring + alarms | $0-3 |
| **Total (active)** | | **$22-37/mo** |

### Monthly Cost Off-Season (9 months)

| Service | Spec | $/month |
|---------|------|---------|
| **App Runner** | Auto-pauses with no traffic, $0.007/GB-hr when idle | $2-5 |
| **RDS PostgreSQL** | Can stop instance (7-day limit) or keep running | $0-16 |
| **CloudFront** | Minimal traffic | $0.50 |
| **Route 53** | Same | $0.50 |
| **Everything else** | Near zero | $0.50 |
| **Total (idle)** | | **$4-22/mo** |

**Off-season RDS options:**
- **Keep running**: ~$16/mo (simplest)
- **Stop/start manually**: Free while stopped, max 7 days then auto-restarts
- **Snapshot + delete**: $0 (restore from snapshot when carnival approaches). ~10 min to restore.
- **Use RDS Serverless v2**: Auto-scales to 0 ACU when idle (~$0). Minimum ~$43/mo when active though — worse deal.

### Annual Estimate

| Scenario | Annual Cost |
|----------|------------|
| Keep everything running year-round | ~$300-400 |
| Stop RDS off-season (snapshot/restore) | ~$160-220 |
| **Most likely (keep RDS, minimal off-season)** | **~$250-350** |

## Alternative: Lightsail (Cheapest Possible)

| Service | Spec | $/month |
|---------|------|---------|
| **Lightsail instance** | 1 GB RAM ($5 plan) | $5 |
| **Lightsail static IP** | Included | $0 |
| **Lightsail managed DB** | N/A — use SQLite on instance | $0 |
| **Route 53** | DNS | $0.50 |
| **SES** | Email | $0.10 |
| **Total** | | **~$6/mo = ~$72/year** |

**Lightsail trade-offs:**
- (+) Cheapest option by far
- (+) Simple — one box, SSH in, done
- (-) Manual deployments (no git-push-to-deploy)
- (-) SQLite means no concurrent write safety at cutoff
- (-) No auto-scaling — if box dies, everything dies
- (-) Manual SSL via certbot
- (-) No CDN (slower for users far from server region)
- (-) Backups are manual (or Lightsail snapshots at $0.05/GB)

## Recommended: Hybrid Approach

Given AWS credits exist:

| Service | Purpose | Cost |
|---------|---------|------|
| **App Runner** | Next.js app | $7-15/mo |
| **RDS db.t4g.micro** | PostgreSQL | $13-16/mo |
| **CloudFront** | CDN + SSL | $1-2/mo |
| **Route 53** | DNS | $0.50/mo |
| **SES** | Email | $0.10/mo |
| **S3** | Backups | $0.03/mo |
| **EventBridge** | Cron | Free |

**Annual: ~$250-350** (or ~$160-220 with off-season RDS shutdown)

This is the right balance of reliability, simplicity, and cost for a seasonal app with 50-100 users. The AWS credits likely cover the first 1-2 years entirely.

## Cost Comparison Summary

| Option | Annual | Deploys | Backups | Scaling | SSL |
|--------|--------|---------|---------|---------|-----|
| Lightsail + SQLite | ~$72 | Manual SSH | Manual | None | Manual |
| **App Runner + RDS** | **~$300** | **Git push** | **Auto** | **Auto** | **Auto** |
| ECS Fargate + RDS | ~$400 | Docker push | Auto | Auto | Auto |
| Vercel + Supabase | ~$0-300 | Git push | Auto | Auto | Auto |
