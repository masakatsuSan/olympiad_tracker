// A tick is write-once for learners: once ticked the box locks. Admins can untick to unlock it.
export default function TickBox({ id, label, ticked, isAdmin, onChange }) {
  const locked = ticked && !isAdmin;
  return (
    <label className="chk" title={locked ? 'Locked once ticked. An admin can unlock it.' : undefined}>
      <input type="checkbox" id={id} checked={!!ticked} disabled={locked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
