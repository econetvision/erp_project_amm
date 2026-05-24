import { useEffect, useRef } from "react";

interface ConfirmModalProps {
  id?: string;
  title?: string;
  message?: string;
  onConfirm?: () => void;
  show?: boolean;
  onCancel?: () => void;
}

export default function ConfirmModal({ id = "confirmModal", title = "Confirm", message, onConfirm, show, onCancel }: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const bsModal = useRef<any>(null);

  useEffect(() => {
    if (!modalRef.current) return;
    // Lazy-load bootstrap Modal
    import("bootstrap").then(({ Modal }) => {
      bsModal.current = Modal.getOrCreateInstance(modalRef.current!);
    });
  }, []);

  useEffect(() => {
    if (!bsModal.current) return;
    if (show) bsModal.current.show();
    else bsModal.current.hide();
  }, [show]);

  function handleCancel() {
    bsModal.current?.hide();
    onCancel?.();
  }

  function handleConfirm() {
    bsModal.current?.hide();
    onConfirm?.();
  }

  return (
    <div className="modal fade" id={id} tabIndex={-1} ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" onClick={handleCancel} />
          </div>
          <div className="modal-body">{message}</div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
            <button className="btn btn-danger" onClick={handleConfirm}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}
