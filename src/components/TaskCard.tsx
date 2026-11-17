'use client';

import React from 'react';
import {
  Card,
  Button,
  Badge,
  Accordion,
  OverlayTrigger,
  Tooltip,
  Popover,
} from '@/components/ui/bootstrap';
import type { TaskWithLogs } from '@/db/schema';
import { formatTime } from '@/lib/format';

interface TaskCardProps {
  task: TaskWithLogs;
  isPendingOptimistic?: boolean;
  onToggle: (task: TaskWithLogs) => void;
  onReportIncident: (task: TaskWithLogs) => void;
}

export default function TaskCard({
  task,
  isPendingOptimistic,
  onToggle,
  onReportIncident,
}: TaskCardProps) {
  const isCompleted = task.isCompleted;
  const isCritical = task.isCritical;

  // Nielsen Heuristic #10: Contextual documentation popover
  const protocolPopover = (
    <Popover id={`protocol-popover-${task.id}`} className="shadow-lg border-0">
      <Popover.Header as="h3" className="bg-primary text-white py-2 fw-semibold">
        <i className="bi bi-journal-medical me-2"></i>
        Clinical Care Protocol
      </Popover.Header>
      <Popover.Body className="small text-secondary">
        <p className="mb-2">
          <strong>Task:</strong> {task.title}
        </p>
        <p className="mb-2">
          <strong>Requirement:</strong> {task.description}
        </p>
        {isCritical && (
          <div className="alert alert-danger py-1 px-2 mb-0 small">
            <strong>Critical Safety Notice:</strong> Uncompleted critical tasks prevent
            shift closure under Heuristic #5. Double-check vitals or dual-signoff protocol.
          </div>
        )}
      </Popover.Body>
    </Popover>
  );

  return (
    <Card
      className={`mb-3 border-2 transition-all ${
        isCompleted
          ? 'border-success-subtle bg-light shadow-sm opacity-90'
          : isCritical
          ? 'border-danger shadow-sm bg-white'
          : 'border-light-subtle shadow-sm bg-white'
      }`}
      style={{
        borderRadius: '12px',
        transition: 'all 0.15s ease-in-out',
      }}
    >
      <Card.Body className="p-3 p-md-4">
        {/* Top Minimalist Row: 3 Essential Data Points (Action, Time Slot, Status Badge) */}
        <div className="d-flex align-items-start justify-content-between gap-3">
          {/* Touch-Friendly Completion Toggle (Ergonomics: Large 48px touch target) */}
          <button
            type="button"
            onClick={() => onToggle(task)}
            disabled={isPendingOptimistic}
            aria-label={`Mark "${task.title}" as ${isCompleted ? 'incomplete' : 'completed'}`}
            className={`btn d-flex align-items-center justify-content-center p-0 flex-shrink-0 ${
              isCompleted
                ? 'btn-success text-white'
                : isCritical
                ? 'btn-outline-danger'
                : 'btn-outline-secondary'
            }`}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              borderWidth: '2px',
              cursor: 'pointer',
            }}
          >
            {isCompleted ? (
              <i className="bi bi-check-lg fs-3 fw-bold"></i>
            ) : isCritical ? (
              <i className="bi bi-exclamation-diamond-fill fs-5"></i>
            ) : (
              <i className="bi bi-circle fs-5"></i>
            )}
          </button>

          {/* Primary View: Essential Data Points */}
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            {/* Essential Point 1 & 2: Time Slot & Status Badge */}
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <span className="badge bg-secondary-subtle text-dark border small fw-medium">
                <i className="bi bi-clock me-1 text-primary"></i>
                {task.scheduledSlot}
              </span>

              {/* Semantic Status Badges (Heuristic #4) */}
              {isCompleted ? (
                <Badge bg="success" className="d-flex align-items-center gap-1">
                  <i className="bi bi-check-circle-fill"></i> COMPLETED
                </Badge>
              ) : isCritical ? (
                <Badge bg="danger" className="d-flex align-items-center gap-1">
                  <i className="bi bi-exclamation-triangle-fill"></i> CRITICAL ALERT
                </Badge>
              ) : (
                <Badge bg="warning" text="dark" className="d-flex align-items-center gap-1">
                  <i className="bi bi-hourglass-split"></i> PENDING
                </Badge>
              )}

              {/* Help & Documentation (Heuristic #10) */}
              <OverlayTrigger
                trigger={['hover', 'focus']}
                placement="top"
                overlay={protocolPopover}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-outline-info rounded-circle d-inline-flex align-items-center justify-content-center p-0"
                  style={{ width: '22px', height: '22px', fontSize: '11px' }}
                  aria-label="Clinical Protocol Information"
                >
                  <i className="bi bi-question-lg"></i>
                </button>
              </OverlayTrigger>
            </div>

            {/* Essential Point 3: Action / Title */}
            <h5
              className={`card-title mb-1 fw-bold ${
                isCompleted
                  ? 'text-decoration-line-through text-muted'
                  : isCritical
                  ? 'text-danger'
                  : 'text-dark'
              }`}
              style={{ fontSize: '1.05rem', lineHeight: '1.4' }}
            >
              {task.title}
            </h5>
          </div>

          {/* Incident / Fast Note Button (Heuristic #6) */}
          <div className="flex-shrink-0">
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip id={`incident-tip-${task.id}`}>Report Incident / Note</Tooltip>}
            >
              <Button
                variant="outline-secondary"
                size="sm"
                className="rounded-3 px-2 py-2 text-dark"
                onClick={() => onReportIncident(task)}
                aria-label="Log incident"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <i className="bi bi-pencil-square fs-6"></i>
              </Button>
            </OverlayTrigger>
          </div>
        </div>

        {/* Heuristic #8: Aesthetic & Minimalist Design - Extended details & audit logs in Accordion */}
        <Accordion className="mt-3 border-0">
          <Accordion.Item eventKey="0" className="border-0 bg-transparent">
            <Accordion.Header className="small text-secondary py-0">
              <span className="small text-muted fw-semibold">
                Clinical Instructions & Audit Trail ({Array.isArray(task.logs) ? task.logs.length : 0} logs)
              </span>
            </Accordion.Header>
            <Accordion.Body className="pt-2 px-0 pb-0 small">
              <div className="p-3 bg-light rounded-3 mb-2 border">
                <div className="fw-semibold text-dark mb-1">
                  <i className="bi bi-card-text me-1 text-primary"></i> Instructions:
                </div>
                <div className="text-secondary">{task.description}</div>
                {task.completedAt && (
                  <div className="mt-2 text-success small fw-medium">
                    <i className="bi bi-check2-all me-1"></i>
                    Completed timestamp:{' '}
                    <span suppressHydrationWarning>{formatTime(task.completedAt, true)}</span>
                  </div>
                )}
              </div>

              {/* PostgreSQL Audit Logs (Heuristic #1 & #3) */}
              {Array.isArray(task.logs) && task.logs.length > 0 ? (
                <div className="mt-2">
                  <div className="fw-semibold text-muted text-uppercase small mb-1" style={{ fontSize: '11px' }}>
                    PostgreSQL Audit Trail:
                  </div>
                  <div className="list-group list-group-flush rounded-2 border">
                    {task.logs.map((log) => (
                      <div
                        key={log.id}
                        className="list-group-item list-group-item-action py-2 px-3 small d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <span
                            className={`badge me-2 ${
                              log.action === 'COMPLETED'
                                ? 'bg-success'
                                : log.action === 'REVERTED'
                                ? 'bg-warning text-dark'
                                : 'bg-danger'
                            }`}
                          >
                            {log.action}
                          </span>
                          <span className="text-secondary">{log.note}</span>
                        </div>
                        <span className="text-muted" style={{ fontSize: '10px' }} suppressHydrationWarning>
                          {formatTime(log.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-muted fst-italic small">No audit logs recorded yet.</div>
              )}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Card.Body>
    </Card>
  );
}
