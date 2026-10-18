// Filter chips, shown only when the plan has more than one subject.
export default function SubjectChips({ subjects, value, onChange }) {
  if (subjects.length < 2) return null;
  return (
    <div className="chips">
      {[{ id: 'all', name: 'All subjects' }, ...subjects].map((s) => (
        <button key={s.id} type="button" className="chip" aria-pressed={value === s.id} onClick={() => onChange(s.id)}>{s.name}</button>
      ))}
    </div>
  );
}
