import { getDb } from './index';
import * as schema from './schema';

async function main() {
  console.log('🌱 Seeding database...');
  const db = await getDb();

  // Clear existing data for fresh seed
  await (db as any).delete(schema.taskLogs);
  await (db as any).delete(schema.tasks);
  await (db as any).delete(schema.shifts);

  const [shift] = await (db as any)
    .insert(schema.shifts)
    .values({
      caregiverName: 'Sarah Jenkins, RN',
      patientAlias: 'Resident Robert M. (Room 204)',
      startTime: new Date(Date.now() - 3.5 * 3600 * 1000),
      status: 'ACTIVE',
    })
    .returning();

  const insertedTasks = await (db as any)
    .insert(schema.tasks)
    .values([
      {
        shiftId: shift.id,
        title: 'Morning Vitals & Blood Glucose Check',
        description:
          'Measure blood pressure, resting heart rate, oxygen saturation (SpO2 ≥ 95%), and record capillary fasting blood glucose.',
        scheduledSlot: '08:00 AM – Morning',
        isCritical: true,
        isCompleted: true,
        completedAt: new Date(Date.now() - 3 * 3600 * 1000),
      },
      {
        shiftId: shift.id,
        title: 'Administer Morning Cardiac Medication',
        description:
          'Metoprolol Tartrate 25mg orally with full glass of water. Verify apical pulse > 60 bpm prior to dose. Protocol: Hold and notify physician if systolic BP < 100.',
        scheduledSlot: '08:30 AM – Morning',
        isCritical: true,
        isCompleted: true,
        completedAt: new Date(Date.now() - 2.5 * 3600 * 1000),
      },
      {
        shiftId: shift.id,
        title: 'Assisted Hallway Ambulation Routine',
        description:
          'Assist resident with gait belt for a 15-minute gentle hallway walk. Verify non-skid slippers. Protocol: Halt ambulation immediately if patient reports dizziness or pain.',
        scheduledSlot: '10:30 AM – Mid-Morning',
        isCritical: false,
        isCompleted: false,
      },
      {
        shiftId: shift.id,
        title: 'Diabetic-Friendly Lunch & Hydration Log',
        description:
          'Provide balanced low-sodium diabetic meal tray. Encourage at least 250ml water intake. Record exact meal percentage consumed.',
        scheduledSlot: '12:30 PM – Afternoon',
        isCritical: false,
        isCompleted: false,
      },
      {
        shiftId: shift.id,
        title: 'Midday Insulin Glargine Administration',
        description:
          'Subcutaneous injection of 10 units Insulin Glargine in right abdominal quadrant (alternate site). CRITICAL: Requires dual nurse signoff confirmation before delivery.',
        scheduledSlot: '01:00 PM – Afternoon',
        isCritical: true,
        isCompleted: false,
      },
      {
        shiftId: shift.id,
        title: 'Skin Integrity & Lower Extremity Wound Inspection',
        description:
          'Inspect right lower pretibial dressing for signs of strike-through, erythema, or edema. Cleanse margins with sterile saline if necessary.',
        scheduledSlot: '03:30 PM – Afternoon',
        isCritical: false,
        isCompleted: false,
      },
      {
        shiftId: shift.id,
        title: 'Evening Shift Handover & Clinical Summary',
        description:
          'Complete handover documentation. Recheck vitals and verbally brief incoming evening nurse Elena Gomez regarding insulin response and intake.',
        scheduledSlot: '04:30 PM – Late Afternoon',
        isCritical: true,
        isCompleted: false,
      },
    ])
    .returning();

  await (db as any).insert(schema.taskLogs).values([
    {
      taskId: insertedTasks[0].id,
      action: 'COMPLETED',
      note: 'BP: 122/78 mmHg, HR: 72 bpm, SpO2: 97%, Blood Glucose: 114 mg/dL. All within normal limits.',
      createdAt: new Date(Date.now() - 3 * 3600 * 1000),
    },
    {
      taskId: insertedTasks[1].id,
      action: 'COMPLETED',
      note: 'Metoprolol 25mg administered with 200ml water. Resident tolerated without complaints.',
      createdAt: new Date(Date.now() - 2.5 * 3600 * 1000),
    },
  ]);

  console.log('✅ Seeding completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
