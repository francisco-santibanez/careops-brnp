'use client';

import React, { useState, useTransition, useOptimistic, useCallback } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Badge,
  ProgressBar,
  Alert,
  Modal,
  ButtonGroup,
} from '@/components/ui/bootstrap';
import TaskCard from './TaskCard';
import UndoToast, { UndoToastData } from './UndoToast';
import IncidentModal from './IncidentModal';
import { toggleTask, undoTask, bulkCompleteRoutineTasks } from '@/app/actions/tasks';
import { validateShiftClose, reopenShift } from '@/app/actions/shifts';
import type { Shift, TaskWithLogs } from '@/db/schema';
import { useRouter } from 'next/navigation';
import { formatTime } from '@/lib/format';

interface ShiftDashboardProps {
  shift: Shift;
  initialTasks: TaskWithLogs[];
}

export default function ShiftDashboard({
  shift,
  initialTasks = [],
}: ShiftDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Heuristic #1: Instant UI feedback using React useOptimistic
  const [optimisticTasks, setOptimisticTasks] = useOptimistic(
    initialTasks || [],
    (state: TaskWithLogs[], update: { taskId: number; isCompleted: boolean }) =>
      (state || []).map((t) =>
        t.id === update.taskId
          ? {
              ...t,
              isCompleted: update.isCompleted,
              completedAt: update.isCompleted ? new Date() : null,
            }
          : t
      )
  );

  // Undo Toast state (Heuristic #3)
  const [undoToastData, setUndoToastData] = useState<UndoToastData | null>(null);

  // Incident Modal state (Heuristic #6)
  const [selectedIncidentTask, setSelectedIncidentTask] =
    useState<TaskWithLogs | null>(null);

  // Close Shift Confirmation Modal & Error handling (Heuristic #5 & #9)
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [closeError, setCloseError] = useState<{
    message: string;
    criticalTasks?: { id: number; title: string; scheduledSlot: string }[];
  } | null>(null);
  const [actionAlert, setActionAlert] = useState<{
    variant: 'success' | 'danger' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Filter state for convenience
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'pending' | 'completed' | 'critical'
  >('all');

  // Defensive array fallback
  const safeTasks = Array.isArray(optimisticTasks) ? optimisticTasks : [];

  // Stats calculation
  const totalCount = safeTasks.length;
  const completedCount = safeTasks.filter((t) => t.isCompleted).length;
  const pendingCriticalCount = safeTasks.filter(
    (t) => t.isCritical && !t.isCompleted
  ).length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Toggle Task Handler with Optimistic UI & Undo Toast
  const handleToggleTask = (task: TaskWithLogs) => {
    const nextCompleted = !task.isCompleted;

    // Trigger instant optimistic update (< 50ms)
    startTransition(async () => {
      setOptimisticTasks({ taskId: task.id, isCompleted: nextCompleted });

      // Trigger 5-second Undo Toast (Heuristic #3)
      setUndoToastData({
        id: String(Date.now()),
        taskId: task.id,
        taskTitle: task.title,
        previousState: task.isCompleted,
        newState: nextCompleted,
      });

      // Execute PostgreSQL mutation via Next.js Server Action
      const result = await toggleTask(task.id, nextCompleted);
      if (!result.success) {
        // Revert optimistic state and notify user gracefully (Heuristic #9)
        setOptimisticTasks({ taskId: task.id, isCompleted: task.isCompleted });
        setActionAlert({
          variant: 'danger',
          message: result.error || 'Failed to update task state in database.',
        });
      }
    });
  };

  // Undo Handler (Heuristic #3: User Control & Freedom)
  const handleUndo = async (toast: UndoToastData) => {
    startTransition(async () => {
      setOptimisticTasks({
        taskId: toast.taskId,
        isCompleted: toast.previousState,
      });

      const result = await undoTask(toast.taskId, toast.previousState);
      if (result.success) {
        setActionAlert({
          variant: 'info',
          message: `Undid change for "${toast.taskTitle}". Restored in audit logs.`,
        });
      } else {
        setActionAlert({
          variant: 'danger',
          message: result.error || 'Failed to revert change.',
        });
      }
    });
  };

  // Toast dismiss handler
  const handleDismissUndoToast = useCallback(() => {
    setUndoToastData(null);
  }, []);

  // Bulk Complete Routine Tasks (Heuristic #7: Flexibility & Efficiency)
  const handleBulkComplete = async () => {
    startTransition(async () => {
      const routineTasks = safeTasks.filter(
        (t) => !t.isCritical && !t.isCompleted
      );
      routineTasks.forEach((t) =>
        setOptimisticTasks({ taskId: t.id, isCompleted: true })
      );

      const result = await bulkCompleteRoutineTasks(shift.id);
      if (result.success) {
        setActionAlert({
          variant: 'success',
          message: `Successfully completed ${result.count} routine care tasks in bulk.`,
        });
      } else {
        setActionAlert({
          variant: 'danger',
          message: result.error || 'Failed to bulk-complete routine tasks.',
        });
      }
    });
  };

  // Close Shift Handler with Safety Guardrail (Heuristic #5: Error Prevention)
  const handleConfirmCloseShift = async () => {
    setIsClosingShift(true);
    setCloseError(null);

    try {
      const result = await validateShiftClose(shift.id);
      if (result.success) {
        setShowCloseModal(false);
        setActionAlert({
          variant: 'success',
          message: result.message || 'Shift closed successfully!',
        });
        router.refresh();
      } else {
        // Safety guardrail blocked shift closure
        setCloseError({
          message: result.error || 'Cannot close shift.',
          criticalTasks: result.incompleteCriticalTasks || [],
        });
      }
    } catch (err: any) {
      setCloseError({
        message: err.message || 'Network error while attempting to close shift.',
      });
    } finally {
      setIsClosingShift(false);
    }
  };

  // Re-open shift (for demo / resetting)
  const handleReopenShift = async () => {
    const res = await reopenShift(shift.id);
    if (res.success) {
      setActionAlert({
        variant: 'info',
        message: 'Shift reopened for active logging.',
      });
      router.refresh();
    }
  };

  // Filtered task view
  const filteredTasks = safeTasks.filter((task) => {
    if (activeFilter === 'pending') return !task.isCompleted;
    if (activeFilter === 'completed') return task.isCompleted;
    if (activeFilter === 'critical') return task.isCritical;
    return true;
  });

  return (
    <Container className="py-3 py-md-4" style={{ maxWidth: '840px' }}>
      {/* Global Toast Alert */}
      {actionAlert && (
        <Alert
          variant={actionAlert.variant}
          dismissible
          onClose={() => setActionAlert(null)}
          className="shadow-sm mb-3"
        >
          <div className="d-flex align-items-center">
            <i
              className={`bi ${
                actionAlert.variant === 'success'
                  ? 'bi-check-circle-fill'
                  : actionAlert.variant === 'danger'
                  ? 'bi-exclamation-triangle-fill'
                  : 'bi-info-circle-fill'
              } me-2 fs-5`}
            ></i>
            <span>{actionAlert.message}</span>
          </div>
        </Alert>
      )}

      {/* Header & Shift Status Card (Heuristic #1: Visibility of System Status) */}
      <Card className="shadow-sm border-0 mb-4 bg-primary text-white overflow-hidden">
        <div
          className="p-3 p-md-4"
          style={{
            background:
              'linear-gradient(135deg, #0d6efd 0%, #0a58ca 60%, #084298 100%)',
          }}
        >
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="badge bg-white text-primary fw-bold text-uppercase px-2 py-1">
                  <i className="bi bi-shield-check me-1"></i> CareOps BRNP
                </span>
                <Badge
                  bg={shift.status === 'ACTIVE' ? 'success' : 'secondary'}
                  className="px-2 py-1"
                >
                  {shift.status === 'ACTIVE' ? '● ACTIVE SHIFT' : 'CLOSED'}
                </Badge>
              </div>
              <h2 className="h4 fw-bold mb-1 text-white">
                {shift.patientAlias}
              </h2>
              <div className="text-white-50 small">
                <i className="bi bi-person-badge me-1"></i>
                Caregiver: <span className="text-white fw-medium">{shift.caregiverName}</span>
                <span className="mx-2">•</span>
                <i className="bi bi-calendar-event me-1"></i>
                Started: <span suppressHydrationWarning>{formatTime(shift.startTime)}</span>
              </div>
            </div>

            {/* Shift Close / Reopen Trigger (Heuristic #5: Error Prevention) */}
            <div>
              {shift.status === 'ACTIVE' ? (
                <Button
                  variant="light"
                  size="sm"
                  className="fw-bold text-primary shadow-sm px-3 py-2"
                  onClick={() => {
                    setCloseError(null);
                    setShowCloseModal(true);
                  }}
                >
                  <i className="bi bi-box-arrow-right me-1"></i> Complete & Close Shift
                </Button>
              ) : (
                <Button
                  variant="outline-light"
                  size="sm"
                  className="fw-bold shadow-sm"
                  onClick={handleReopenShift}
                >
                  <i className="bi bi-arrow-counterclockwise me-1"></i> Reopen Shift
                </Button>
              )}
            </div>
          </div>

          {/* Shift Progress Bar (Heuristic #1) */}
          <div className="mt-3 bg-black bg-opacity-25 p-3 rounded-3">
            <div className="d-flex justify-content-between align-items-center text-white small mb-2 fw-medium">
              <span>
                Shift Progress: <strong>{completedCount}</strong> of <strong>{totalCount}</strong> tasks complete
              </span>
              <span className="fw-bold">{progressPercent}%</span>
            </div>
            <ProgressBar
              now={progressPercent}
              variant={progressPercent === 100 ? 'success' : 'warning'}
              style={{ height: '10px', borderRadius: '5px' }}
            />
            {pendingCriticalCount > 0 && (
              <div className="mt-2 text-warning small d-flex align-items-center">
                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                <span>
                  <strong>{pendingCriticalCount} critical task(s) pending.</strong> Must be completed before closing shift.
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Operational Controls & Shortcuts (Heuristic #7: Flexibility and Efficiency) */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        {/* Filter Buttons */}
        <ButtonGroup size="sm" className="shadow-sm">
          <Button
            variant={activeFilter === 'all' ? 'dark' : 'outline-secondary'}
            onClick={() => setActiveFilter('all')}
          >
            All ({totalCount})
          </Button>
          <Button
            variant={activeFilter === 'pending' ? 'dark' : 'outline-secondary'}
            onClick={() => setActiveFilter('pending')}
          >
            Pending ({totalCount - completedCount})
          </Button>
          <Button
            variant={activeFilter === 'critical' ? 'dark' : 'outline-secondary'}
            onClick={() => setActiveFilter('critical')}
          >
            Critical ({safeTasks.filter((t) => t.isCritical).length})
          </Button>
          <Button
            variant={activeFilter === 'completed' ? 'dark' : 'outline-secondary'}
            onClick={() => setActiveFilter('completed')}
          >
            Completed ({completedCount})
          </Button>
        </ButtonGroup>

        {/* Bulk-Completion Shortcut for Routine Tasks (Heuristic #7) */}
        {shift.status === 'ACTIVE' && (
          <Button
            variant="outline-success"
            size="sm"
            className="fw-semibold shadow-sm d-flex align-items-center gap-1"
            onClick={handleBulkComplete}
            disabled={isPending}
            title="Bulk complete routine, non-critical tasks"
          >
            <i className="bi bi-check2-all fs-6"></i>
            <span>Quick-Complete Routine</span>
          </Button>
        )}
      </div>

      {/* Chronological Daily Task List (Heuristic #2: Match Between System and Real World) */}
      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <Card className="text-center p-5 border-dashed bg-light">
            <div className="text-muted">
              <i className="bi bi-clipboard-check display-4 mb-2 d-block text-secondary"></i>
              <h5>No tasks found in this view</h5>
              <p className="small mb-0">Switch filters to see active or completed care items.</p>
            </div>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isPendingOptimistic={isPending}
              onToggle={handleToggleTask}
              onReportIncident={(t) => setSelectedIncidentTask(t)}
            />
          ))
        )}
      </div>

      {/* Undo Toast Notification (Heuristic #3: User Control and Freedom) */}
      <UndoToast
        toastData={undoToastData}
        onUndo={handleUndo}
        onDismiss={handleDismissUndoToast}
      />

      {/* Incident Reporting Modal (Heuristic #6: Recognition Rather Than Recall) */}
      <IncidentModal
        task={selectedIncidentTask}
        show={Boolean(selectedIncidentTask)}
        onHide={() => setSelectedIncidentTask(null)}
        onIncidentLogged={() => {
          setActionAlert({
            variant: 'success',
            message: 'Incident note successfully saved to PostgreSQL audit trail.',
          });
          router.refresh();
        }}
      />

      {/* Close Shift Confirmation & Safety Guardrail Modal (Heuristic #5 & #9) */}
      <Modal
        show={showCloseModal}
        onHide={() => !isClosingShift && setShowCloseModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!isClosingShift} className="bg-light">
          <Modal.Title className="h5 mb-0 fw-bold">
            <i className="bi bi-shield-lock-fill text-primary me-2"></i>
            Shift Handover & Closure Check
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {/* Error Prevention Guardrail Alert (Heuristic #5 & #9) */}
          {closeError ? (
            <Alert variant="danger" className="border-danger">
              <div className="d-flex align-items-start gap-2">
                <i className="bi bi-slash-circle-fill fs-4 text-danger flex-shrink-0"></i>
                <div>
                  <h6 className="alert-heading fw-bold mb-1">
                    Closure Blocked: Unresolved Critical Tasks
                  </h6>
                  <p className="small mb-2">{closeError.message}</p>
                  {Array.isArray(closeError.criticalTasks) && closeError.criticalTasks.length > 0 && (
                    <div className="bg-white p-2 rounded border border-danger-subtle small mt-2">
                      <strong className="text-danger d-block mb-1">
                        Outstanding Critical Protocols:
                      </strong>
                      <ul className="mb-0 ps-3">
                        {closeError.criticalTasks.map((ct) => (
                          <li key={ct.id} className="text-dark fw-medium">
                            {ct.title} ({ct.scheduledSlot})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-3 small text-muted">
                    Please mark these items completed or document clinical reasons before attempting to close this shift.
                  </div>
                </div>
              </div>
            </Alert>
          ) : (
            <div>
              <p className="mb-3 text-secondary">
                You are about to close the active shift for{' '}
                <strong>{shift.patientAlias}</strong>. This will finalize time-stamps and generate the audit handover summary.
              </p>
              {pendingCriticalCount > 0 ? (
                <Alert variant="warning" className="small py-2 mb-0">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  <strong>Warning:</strong> You have {pendingCriticalCount} critical task(s) uncompleted. The system will prevent closing until they are marked complete.
                </Alert>
              ) : (
                <Alert variant="success" className="small py-2 mb-0">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  All critical tasks are complete. Safe to finalize shift.
                </Alert>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light d-flex justify-content-between">
          <Button
            variant="outline-secondary"
            onClick={() => setShowCloseModal(false)}
            disabled={isClosingShift}
          >
            {closeError ? 'Back to Dashboard' : 'Cancel'}
          </Button>
          {!closeError && (
            <Button
              variant="primary"
              className="fw-bold px-4"
              onClick={handleConfirmCloseShift}
              disabled={isClosingShift}
            >
              {isClosingShift ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Validating Protocols...
                </>
              ) : (
                'Confirm Shift Handover & Close'
              )}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
