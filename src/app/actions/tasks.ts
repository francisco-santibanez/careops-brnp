'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/db';
import * as schema from '@/db/schema';

export type TaskActionResult = {
  success: boolean;
  message?: string;
  taskId?: number;
  isCompleted?: boolean;
  error?: string;
};

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Gracefully handle calls outside active Next.js request context (e.g. testing)
  }
}

/**
 * Toggle task completion status and log to audit trail (PostgreSQL)
 * Implements Heuristic #1 (Visibility of System Status) & Heuristic #3 (User Control & Freedom)
 */
export async function toggleTask(
  taskId: number,
  targetState: boolean,
  note?: string
): Promise<TaskActionResult> {
  try {
    const db = await getDb();

    // Verify task exists
    const [existingTask] = await (db as any)
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId));

    if (!existingTask) {
      return { success: false, error: `Task #${taskId} not found.` };
    }

    const now = new Date();
    const isCompleted = targetState;
    const completedAt = isCompleted ? now : null;

    // Update task
    await (db as any)
      .update(schema.tasks)
      .set({
        isCompleted,
        completedAt,
      })
      .where(eq(schema.tasks.id, taskId));

    // Append to task_logs audit table
    const action = isCompleted ? 'COMPLETED' : 'REVERTED';
    const auditNote =
      note ||
      (isCompleted
        ? 'Caregiver marked task as completed'
        : 'Caregiver marked task as pending');

    await (db as any).insert(schema.taskLogs).values({
      taskId,
      action,
      note: auditNote,
      createdAt: now,
    });

    safeRevalidatePath('/');
    return {
      success: true,
      taskId,
      isCompleted,
      message: `Task ${isCompleted ? 'marked completed' : 'reopened'}.`,
    };
  } catch (err: any) {
    console.error('Error in toggleTask:', err);
    return {
      success: false,
      error: err.message || 'Database error occurred while updating task.',
    };
  }
}

/**
 * 5-Second Undo Action
 * Implements Heuristic #3 (User Control & Freedom)
 * Reverts task state and writes explicit 'REVERTED' log to PostgreSQL audit trail.
 */
export async function undoTask(
  taskId: number,
  revertToState: boolean
): Promise<TaskActionResult> {
  try {
    const db = await getDb();

    const [existingTask] = await (db as any)
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId));

    if (!existingTask) {
      return { success: false, error: `Task #${taskId} not found for undo.` };
    }

    const now = new Date();
    const isCompleted = revertToState;
    const completedAt = isCompleted ? now : null;

    await (db as any)
      .update(schema.tasks)
      .set({
        isCompleted,
        completedAt,
      })
      .where(eq(schema.tasks.id, taskId));

    await (db as any).insert(schema.taskLogs).values({
      taskId,
      action: 'REVERTED',
      note: 'User tapped Undo within 5-second grace window to revert accidental check-off.',
      createdAt: now,
    });

    safeRevalidatePath('/');
    return {
      success: true,
      taskId,
      isCompleted,
      message: 'Task status reverted successfully via Undo.',
    };
  } catch (err: any) {
    console.error('Error in undoTask:', err);
    return {
      success: false,
      error: err.message || 'Failed to revert task via undo.',
    };
  }
}

/**
 * Bulk complete routine, non-critical tasks
 * Implements Heuristic #7 (Flexibility and Efficiency of Use)
 */
export async function bulkCompleteRoutineTasks(
  shiftId: number
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const db = await getDb();

    // Query routine pending tasks (defensively guarded with || [])
    const pendingRoutineTasks =
      (await (db as any)
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.shiftId, shiftId),
            eq(schema.tasks.isCritical, false),
            eq(schema.tasks.isCompleted, false)
          )
        )) || [];

    if (!Array.isArray(pendingRoutineTasks) || pendingRoutineTasks.length === 0) {
      return { success: true, count: 0 };
    }

    const now = new Date();

    for (const task of pendingRoutineTasks) {
      await (db as any)
        .update(schema.tasks)
        .set({
          isCompleted: true,
          completedAt: now,
        })
        .where(eq(schema.tasks.id, task.id));

      await (db as any).insert(schema.taskLogs).values({
        taskId: task.id,
        action: 'COMPLETED',
        note: 'Routine task completed via bulk-completion shortcut.',
        createdAt: now,
      });
    }

    safeRevalidatePath('/');
    return { success: true, count: pendingRoutineTasks.length };
  } catch (err: any) {
    console.error('Error in bulkCompleteRoutineTasks:', err);
    return {
      success: false,
      error: err.message || 'Failed to bulk-complete routine tasks.',
    };
  }
}
