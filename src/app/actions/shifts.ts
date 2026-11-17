'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/db';
import * as schema from '@/db/schema';

export type ShiftValidationResult = {
  success: boolean;
  message?: string;
  error?: string;
  incompleteCriticalTasks?: {
    id: number;
    title: string;
    scheduledSlot: string;
  }[];
};

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Gracefully handle calls outside active Next.js request context (e.g. testing)
  }
}

/**
 * Validate and close active shift
 * Implements Heuristic #5 (Error Prevention)
 * Hard server-side guardrail: Blocks closure if any task marked is_critical = true is incomplete.
 */
export async function validateShiftClose(
  shiftId: number
): Promise<ShiftValidationResult> {
  try {
    const db = await getDb();

    // Fetch shift
    const [shift] = await (db as any)
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.id, shiftId));

    if (!shift) {
      return { success: false, error: `Shift #${shiftId} not found.` };
    }

    if (shift.status === 'CLOSED') {
      return { success: false, error: 'Shift is already marked as CLOSED.' };
    }

    // Check for incomplete critical tasks (defensively guarded with || [])
    const incompleteCriticalTasks =
      (await (db as any)
        .select({
          id: schema.tasks.id,
          title: schema.tasks.title,
          scheduledSlot: schema.tasks.scheduledSlot,
        })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.shiftId, shiftId),
            eq(schema.tasks.isCritical, true),
            eq(schema.tasks.isCompleted, false)
          )
        )) || [];

    if (Array.isArray(incompleteCriticalTasks) && incompleteCriticalTasks.length > 0) {
      return {
        success: false,
        error: `Safety Guardrail Triggered: Shift cannot be closed. There are ${incompleteCriticalTasks.length} incomplete critical care task(s) requiring completion or clinical escalation before shift handover.`,
        incompleteCriticalTasks,
      };
    }

    // All critical tasks completed -> Safe to close shift
    const now = new Date();
    await (db as any)
      .update(schema.shifts)
      .set({
        status: 'CLOSED',
        endTime: now,
      })
      .where(eq(schema.shifts.id, shiftId));

    safeRevalidatePath('/');
    return {
      success: true,
      message: `Shift #${shiftId} successfully closed. All critical tasks verified and clinical handover logged.`,
    };
  } catch (err: any) {
    console.error('Error in validateShiftClose:', err);
    return {
      success: false,
      error: err.message || 'Database error occurred while closing shift.',
    };
  }
}

/**
 * Report an incident with quick-select chips
 * Implements Heuristic #6 (Recognition Rather Than Recall)
 */
export async function reportIncident(
  taskId: number,
  chipReason: string,
  details?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const db = await getDb();

    const [task] = await (db as any)
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId));

    if (!task) {
      return { success: false, error: `Task #${taskId} not found.` };
    }

    const note =
      details && details.trim()
        ? `[${chipReason}] ${details.trim()}`
        : `[${chipReason}] Recorded by caregiver`;

    await (db as any).insert(schema.taskLogs).values({
      taskId,
      action: 'INCIDENT',
      note,
      createdAt: new Date(),
    });

    safeRevalidatePath('/');
    return {
      success: true,
      message: `Incident note recorded for "${task.title}".`,
    };
  } catch (err: any) {
    console.error('Error in reportIncident:', err);
    return {
      success: false,
      error: err.message || 'Database error while logging incident.',
    };
  }
}

/**
 * Re-open or reset active shift for demonstration and testing
 */
export async function reopenShift(
  shiftId: number
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const db = await getDb();

    await (db as any)
      .update(schema.shifts)
      .set({
        status: 'ACTIVE',
        endTime: null,
      })
      .where(eq(schema.shifts.id, shiftId));

    safeRevalidatePath('/');
    return {
      success: true,
      message: `Shift #${shiftId} reopened to ACTIVE status.`,
    };
  } catch (err: any) {
    console.error('Error in reopenShift:', err);
    return {
      success: false,
      error: err.message || 'Database error while reopening shift.',
    };
  }
}
