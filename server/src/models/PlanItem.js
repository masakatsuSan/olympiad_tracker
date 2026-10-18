import mongoose from 'mongoose';

// One row of the schedule: a lecture, a revision day, a test or a rest day.
// Week 0 items have no plan date; they carry the original class date instead.
const planItemSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    type: { type: String, enum: ['lec', 'rev', 'test', 'rest'], required: true },
    date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null, index: true },
    week0: { type: Boolean, default: false },
    origDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
    chapter: { type: Number, default: null, index: true },
    topic: { type: String, default: '', maxlength: 160 },
    name: { type: String, default: '', maxlength: 120 },
    text: { type: String, default: '', maxlength: 400 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

planItemSchema.index({ week0: 1, date: 1, order: 1 });

export const PlanItem = mongoose.model('PlanItem', planItemSchema);

export const KINDS_FOR = { lec: ['a', 'b'], rev: ['c'], test: ['c'], rest: [] };
