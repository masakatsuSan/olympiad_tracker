import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // Lower-case copy of the name, so "Physics" and "physics" count as the same subject.
    key: { type: String, unique: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
subjectSchema.pre('validate', function setKey(next) { this.key = (this.name || '').trim().toLowerCase(); next(); });
// findByIdAndUpdate and bulkWrite skip document hooks, so keep the key in step there too.
subjectSchema.pre('findOneAndUpdate', function setKeyOnUpdate(next) {
  const u = this.getUpdate() || {};
  const name = u.name ?? u.$set?.name;
  if (name) this.set({ key: String(name).trim().toLowerCase() });
  next();
});

export const Subject = mongoose.model('Subject', subjectSchema);
