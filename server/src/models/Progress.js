import mongoose from 'mongoose';

// One document per (user, plan item). Ticks are write-once timestamps for learners:
//   a = lecture watched, b = DPP done, c = revision done / test taken.
const progressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'PlanItem', required: true },
    a: { type: Date, default: null },
    b: { type: Date, default: null },
    c: { type: Date, default: null },
    note: { type: String, default: '', maxlength: 500 },
    score: { type: String, default: '', maxlength: 20 },
  },
  { timestamps: true }
);

progressSchema.index({ user: 1, item: 1 }, { unique: true });

export const Progress = mongoose.model('Progress', progressSchema);
