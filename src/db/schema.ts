import { pgTable, serial, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  caregiverName: text('caregiver_name').notNull(),
  patientAlias: text('patient_alias').notNull(),
  startTime: timestamp('start_time').notNull().defaultNow(),
  endTime: timestamp('end_time'),
  status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' | 'CLOSED'
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id')
    .notNull()
    .references(() => shifts.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  scheduledSlot: text('scheduled_slot').notNull(),
  isCritical: boolean('is_critical').notNull().default(false),
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: timestamp('completed_at'),
});

export const taskLogs = pgTable('task_logs', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'COMPLETED' | 'REVERTED' | 'INCIDENT'
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const shiftsRelations = relations(shifts, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  shift: one(shifts, {
    fields: [tasks.shiftId],
    references: [shifts.id],
  }),
  logs: many(taskLogs),
}));

export const taskLogsRelations = relations(taskLogs, ({ one }) => ({
  task: one(tasks, {
    fields: [taskLogs.taskId],
    references: [tasks.id],
  }),
}));

export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskLog = typeof taskLogs.$inferSelect;
export type NewTaskLog = typeof taskLogs.$inferInsert;

export type TaskWithLogs = Task & {
  logs?: TaskLog[];
};

export type ShiftWithTasks = Shift & {
  tasks: TaskWithLogs[];
};
