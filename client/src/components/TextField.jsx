import { useEffect, useState } from 'react';

// Saves when the field loses focus, and only when the text changed.
export default function TextField({ id, value, placeholder, className, onSave, readOnly }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  return (
    <input id={id} type="text" className={className} placeholder={placeholder} value={v} readOnly={readOnly}
      onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value || '') && onSave(v)} />
  );
}
