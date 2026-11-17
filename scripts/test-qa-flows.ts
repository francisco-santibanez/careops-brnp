import { getDb } from '../src/db';
import * as schema from '../src/db/schema';
import { eq, desc } from 'drizzle-orm';
import { toggleTask, undoTask, bulkCompleteRoutineTasks } from '../src/app/actions/tasks';
import { validateShiftClose, reportIncident, reopenShift } from '../src/app/actions/shifts';

async function runQAFlows() {
  console.log('🧪 Starting CareOps BRNP Stack QA & Heuristics Validation...\n');

  const db = await getDb();

  // Reset shift to active with seed state
  await (db as any).delete(schema.taskLogs);
  await (db as any).delete(schema.tasks);
  await (db as any).delete(schema.shifts);

  const [shift] = await (db as any)
    .insert(schema.shifts)
    .values({
      caregiverName: 'Sarah Jenkins, RN',
      patientAlias: 'Resident Robert M. (Room 204)',
      startTime: new Date(),
      status: 'ACTIVE',
    })
    .returning();

  const [critTask, routineTask] = await (db as any)
    .insert(schema.tasks)
    .values([
      {
        shiftId: shift.id,
        title: 'Midday Insulin Glargine Administration',
        description: '10 units subcutaneous. High-alert medication.',
        scheduledSlot: '01:00 PM – Afternoon',
        isCritical: true,
        isCompleted: false,
      },
      {
        shiftId: shift.id,
        title: 'Assisted Hallway Ambulation',
        description: '15-minute assisted walk with gait belt.',
        scheduledSlot: '02:00 PM – Afternoon',
        isCritical: false,
        isCompleted: false,
      },
    ])
    .returning();

  console.log('----------------------------------------------------');
  console.log('TEST 1: Critical Safety Guardrail (Heuristic #5: Error Prevention)');
  console.log('----------------------------------------------------');
  const guardrailAttempt = await validateShiftClose(shift.id);
  console.log('Guardrail attempt result:', guardrailAttempt);

  if (guardrailAttempt.success === false && guardrailAttempt.incompleteCriticalTasks?.length === 1) {
    console.log('✅ PASS: Shift closure blocked due to pending critical task.\n');
  } else {
    throw new Error('❌ FAIL: Safety guardrail did not block closure.');
  }

  console.log('----------------------------------------------------');
  console.log('TEST 2: Task Completion Mutation & Audit Trail');
  console.log('----------------------------------------------------');
  const toggleResult = await toggleTask(critTask.id, true, 'Insulin delivered per protocol');
  console.log('Toggle result:', toggleResult);

  const [updatedCrit] = await (db as any)
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, critTask.id));

  const [toggleLog] = await (db as any)
    .select()
    .from(schema.taskLogs)
    .where(eq(schema.taskLogs.taskId, critTask.id))
    .orderBy(desc(schema.taskLogs.id))
    .limit(1);

  if (updatedCrit.isCompleted === true && toggleLog.action === 'COMPLETED') {
    console.log(`✅ PASS: Task updated to completed. Audit log: [${toggleLog.action}] "${toggleLog.note}"\n`);
  } else {
    throw new Error('❌ FAIL: Task toggle or audit log mismatch.');
  }

  console.log('----------------------------------------------------');
  console.log('TEST 3: State Reversion (Undo) (Heuristic #3: User Control & Freedom)');
  console.log('----------------------------------------------------');
  const undoResult = await undoTask(critTask.id, false);
  console.log('Undo result:', undoResult);

  const [revertedCrit] = await (db as any)
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, critTask.id));

  const [revertedLog] = await (db as any)
    .select()
    .from(schema.taskLogs)
    .where(eq(schema.taskLogs.taskId, critTask.id))
    .orderBy(desc(schema.taskLogs.id))
    .limit(1);

  if (revertedCrit.isCompleted === false && revertedLog.action === 'REVERTED') {
    console.log(`✅ PASS: Task reverted to pending. Audit log: [${revertedLog.action}] "${revertedLog.note}"\n`);
  } else {
    throw new Error('❌ FAIL: Undo reversion failed.');
  }

  console.log('----------------------------------------------------');
  console.log('TEST 4: Incident Reporting (Heuristic #6: Recognition Rather Than Recall)');
  console.log('----------------------------------------------------');
  const incidentResult = await reportIncident(routineTask.id, 'Low supplies', 'Need additional sterile saline swabs');
  console.log('Incident result:', incidentResult);

  const [incidentLog] = await (db as any)
    .select()
    .from(schema.taskLogs)
    .where(eq(schema.taskLogs.taskId, routineTask.id))
    .orderBy(desc(schema.taskLogs.id))
    .limit(1);

  if (incidentResult.success && incidentLog.action === 'INCIDENT' && incidentLog.note?.includes('Low supplies')) {
    console.log(`✅ PASS: Incident logged. Audit log: [${incidentLog.action}] "${incidentLog.note}"\n`);
  } else {
    throw new Error('❌ FAIL: Incident logging failed.');
  }

  console.log('----------------------------------------------------');
  console.log('TEST 5: Bulk-Completion for Routine Tasks (Heuristic #7: Efficiency)');
  console.log('----------------------------------------------------');
  const bulkResult = await bulkCompleteRoutineTasks(shift.id);
  console.log('Bulk complete result:', bulkResult);

  const [completedRoutine] = await (db as any)
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, routineTask.id));

  if (bulkResult.success && completedRoutine.isCompleted === true) {
    console.log(`✅ PASS: Routine task bulk-completed (${bulkResult.count} tasks).\n`);
  } else {
    throw new Error('❌ FAIL: Bulk completion failed.');
  }

  console.log('----------------------------------------------------');
  console.log('TEST 6: Successful Shift Closure After Critical Completion');
  console.log('----------------------------------------------------');
  // Complete the critical task
  await toggleTask(critTask.id, true, 'Insulin delivered');
  const closeSuccess = await validateShiftClose(shift.id);
  console.log('Closure result:', closeSuccess);

  const [closedShift] = await (db as any)
    .select()
    .from(schema.shifts)
    .where(eq(schema.shifts.id, shift.id));

  if (closeSuccess.success && closedShift.status === 'CLOSED' && closedShift.endTime !== null) {
    console.log(`✅ PASS: Shift successfully closed. Status: ${closedShift.status}, EndTime: ${closedShift.endTime}\n`);
  } else {
    throw new Error('❌ FAIL: Shift closure failed.');
  }

  console.log('====================================================');
  console.log('🎉 ALL 6 CORE QA SCENARIOS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runQAFlows().catch((err) => {
  console.error('❌ Test execution error:', err);
  process.exit(1);
});
