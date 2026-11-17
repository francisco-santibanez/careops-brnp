import React from 'react';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import ShiftDashboard from '@/components/ShiftDashboard';
import type { TaskWithLogs } from '@/db/schema';

// Server Component (Dynamic to ensure fresh database query on shift actions)
export const dynamic = 'force-dynamic';

export default async function Page() {
  const db = await getDb();

  // Fetch the latest active shift (or most recent shift)
  let [shift] = await (db as any)
    .select()
    .from(schema.shifts)
    .where(eq(schema.shifts.status, 'ACTIVE'))
    .limit(1);

  if (!shift) {
    // If no active shift, get the latest closed shift
    [shift] = await (db as any)
      .select()
      .from(schema.shifts)
      .orderBy(desc(schema.shifts.id))
      .limit(1);
  }

  // Fallback safety if database is completely empty
  if (!shift) {
    return (
      <div className="container py-5 text-center">
        <h2 className="text-secondary">No shift record found.</h2>
        <p className="text-muted">Please run <code>npm run db:seed</code> to initialize data.</p>
      </div>
    );
  }

  // Fetch all tasks for this shift ordered chronologically (guarded with || [])
  const shiftTasks =
    (await (db as any)
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.shiftId, shift.id))
      .orderBy(asc(schema.tasks.id))) || [];

  // Fetch audit logs for all tasks in this shift (guarded with || [])
  const allLogs =
    (await (db as any)
      .select()
      .from(schema.taskLogs)
      .orderBy(desc(schema.taskLogs.createdAt))) || [];

  // Attach logs to each task
  const tasksWithLogs: TaskWithLogs[] = (shiftTasks || []).map((t: any) => ({
    ...t,
    logs: (allLogs || []).filter((l: any) => l.taskId === t.id),
  }));

  return <ShiftDashboard shift={shift} initialTasks={tasksWithLogs || []} />;
}
