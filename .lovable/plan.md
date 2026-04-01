

## Plan: Clean Up Stuck Jobs and Reset

### Problem
There are 8 jobs stuck in `pending`/`processing` status in the `ffiec_report_jobs` table. These stale records may cause the system to try resuming old jobs instead of starting fresh ones.

### Steps

1. **Database migration** — Update all `pending`/`processing` jobs to `failed` with an error message like "Cleared by admin reset" and set `completed_at` to now. This is a one-time cleanup.

2. **Refresh the page** — This stops any client-side polling loops. After the migration runs, clicking "Current Market Intelligence" will create a brand-new job.

### Technical Detail
Single SQL migration:
```sql
UPDATE ffiec_report_jobs
SET status = 'failed',
    error_message = 'Cleared: stale job reset',
    completed_at = now()
WHERE status IN ('pending', 'processing');
```

### Result
All old jobs are marked failed. The next time you select a bank and click the Market Intelligence button, a completely fresh job will be created.

