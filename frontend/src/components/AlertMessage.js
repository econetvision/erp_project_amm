export default function AlertMessage({ type = "success", message, onClose }) {
  if (!message) return null;
  return (
    <div className={`alert alert-${type} alert-dismissible fade show`} role="alert">
      {message}
      <button type="button" className="btn-close" onClick={onClose} />
    </div>
  );
}
