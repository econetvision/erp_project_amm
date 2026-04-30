export default function ConfirmModal({ id = "confirmModal", title = "Confirm", message, onConfirm }) {
  return (
    <div className="modal fade" id={id} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" />
          </div>
          <div className="modal-body">{message}</div>
          <div className="modal-footer">
            <button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button className="btn btn-danger"    data-bs-dismiss="modal" onClick={onConfirm}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
