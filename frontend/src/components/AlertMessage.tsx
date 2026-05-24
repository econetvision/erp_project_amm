interface AlertMessageProps {
  type?: string;
  message?: string;
  alert?: { type: string; message: string } | null;
  onClose: () => void;
}

export default function AlertMessage({ type = "success", message, alert, onClose }: AlertMessageProps) {
  const finalType = alert?.type || type;
  const finalMessage = alert?.message || message;
  if (!finalMessage) return null;
  return (
    <div className={`alert alert-${finalType} alert-dismissible fade show`} role="alert">
      {finalMessage}
      <button type="button" className="btn-close" onClick={onClose} />
    </div>
  );
}
