# Task correlative integrity rollout

This batch adds the DB invariant `tasks_project_correlative_unique` over
`(project_id, correlative_id)`.

Rollout steps before applying `db:push` in production:

1. Audit duplicates:

```sql
SELECT project_id, correlative_id, COUNT(*) AS duplicates
FROM tasks
GROUP BY project_id, correlative_id
HAVING COUNT(*) > 1;
```

2. Clean duplicated rows or reassign conflicting correlatives.
3. Apply schema changes.
4. Deploy the API retry/transaction changes from this batch.
5. Monitor `23505` violations for `tasks_project_correlative_unique` during the
   first production window.

Why this order matters: if duplicate data already exists, the unique index cannot
be created successfully.
