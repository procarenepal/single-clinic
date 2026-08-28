import React, { useState, useEffect } from "react";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "./modal";
import { Button } from "./button";

interface ReasonConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  reasonLabel?: string;
  confirmText?: string;
  confirmColor?: "primary" | "danger";
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Replaces window.prompt()/confirm() for actions that require a documented
 * reason (IRD compliance: Cancel Invoice, Issue Credit Note).
 */
export function ReasonConfirmModal({
  isOpen,
  title,
  description,
  reasonLabel = "Reason",
  confirmText = "Confirm",
  confirmColor = "danger",
  isSubmitting,
  onClose,
  onConfirm,
}: ReasonConfirmModalProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) setReason("");
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} size="md" onClose={onClose}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          {description && (
            <p className="text-[12.5px] text-[rgb(var(--color-text-muted))] mb-3">
              {description}
            </p>
          )}
          <label className="block text-[12px] font-medium text-[rgb(var(--color-text))] mb-1">
            {reasonLabel} <span className="text-danger">*</span>
          </label>
          <textarea
            autoFocus
            className="w-full min-h-[80px] px-3 py-2 text-[13px] rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Enter the reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="default" isDisabled={isSubmitting} variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color={confirmColor}
            isDisabled={!reason.trim()}
            isLoading={isSubmitting}
            onPress={() => onConfirm(reason.trim())}
          >
            {confirmText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
