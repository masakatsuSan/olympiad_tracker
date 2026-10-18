import { useEffect } from 'react';

export default function Modal({ title, note, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div id="overlay">
      <div className="ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="dlg" role="dialog" aria-modal="true" aria-label={title}>
          <h3>{title}</h3>
          {note && <p className="cap">{note}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
