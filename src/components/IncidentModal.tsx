'use client';

import React, { useState } from 'react';
import { Modal, Button, Form, Badge, Alert } from '@/components/ui/bootstrap';
import { reportIncident } from '@/app/actions/shifts';
import type { Task } from '@/db/schema';

interface IncidentModalProps {
  task: Task | null;
  show: boolean;
  onHide: () => void;
  onIncidentLogged?: () => void;
}

const QUICK_CHIPS = [
  { label: 'No issues', variant: 'outline-secondary' },
  { label: 'Low supplies', variant: 'outline-warning' },
  { label: 'Schedule change', variant: 'outline-info' },
  { label: 'Patient refused', variant: 'outline-danger' },
  { label: 'Abnormal vitals', variant: 'outline-danger' },
  { label: 'Family request', variant: 'outline-primary' },
  { label: 'Physician notified', variant: 'outline-dark' },
];

export default function IncidentModal({
  task,
  show,
  onHide,
  onIncidentLogged,
}: IncidentModalProps) {
  const [selectedChip, setSelectedChip] = useState<string>('Low supplies');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChip) {
      setErrorMessage('Please select a quick chip reason.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await reportIncident(task.id, selectedChip, details);
      if (result.success) {
        setDetails('');
        onIncidentLogged?.();
        onHide();
      } else {
        setErrorMessage(result.error || 'Failed to submit incident report.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error while submitting report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static" keyboard={false}>
      <Modal.Header closeButton className="bg-light">
        <Modal.Title className="h5 mb-0 fw-bold">
          <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
          Report Care Log / Incident
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body className="p-4">
          {errorMessage && (
            <Alert variant="danger" className="py-2 small mb-3">
              <i className="bi bi-x-circle-fill me-2"></i>
              {errorMessage}
            </Alert>
          )}

          <div className="mb-3">
            <span className="text-muted small">Associated Task:</span>
            <div className="fw-semibold text-dark">{task.title}</div>
            <div className="text-secondary small">{task.scheduledSlot}</div>
          </div>

          <div className="mb-3">
            <Form.Label className="fw-bold small text-secondary text-uppercase d-block mb-2">
              Select Quick Reason (Recognition Rather Than Recall)
            </Form.Label>
            <div className="d-flex flex-wrap gap-2">
              {QUICK_CHIPS.map((chip) => {
                const isSelected = selectedChip === chip.label;
                return (
                  <Button
                    key={chip.label}
                    type="button"
                    variant={isSelected ? 'dark' : 'outline-secondary'}
                    size="sm"
                    className={`rounded-pill px-3 py-2 fw-medium ${
                      isSelected ? 'shadow-sm border-dark' : ''
                    }`}
                    onClick={() => {
                      setSelectedChip(chip.label);
                      setErrorMessage(null);
                    }}
                  >
                    {isSelected && <i className="bi bi-check2 me-1"></i>}
                    {chip.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <Form.Group className="mb-2">
            <Form.Label className="fw-bold small text-secondary text-uppercase">
              Clinical Context / Specific Notes (Optional)
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="e.g. resident requested 30-min delay, inventory low on 23G needles, notify Dr. Evans..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="form-control-lg fs-6"
            />
            <Form.Text className="text-muted small">
              This log will be appended permanently to the PostgreSQL audit trail.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="bg-light d-flex justify-content-between">
          <Button variant="outline-secondary" onClick={onHide} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="warning"
            type="submit"
            className="fw-bold px-4 text-dark"
            disabled={isSubmitting || !selectedChip}
          >
            {isSubmitting ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Saving...
              </>
            ) : (
              'Save to Audit Trail'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
