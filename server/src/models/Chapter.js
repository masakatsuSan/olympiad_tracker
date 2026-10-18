import mongoose from 'mongoose';

// Chapter numbers are unique inside a subject, so two subjects can both have a Chapter 1.
const chapterSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    n: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    part: { type: String, default: '', trim: true, maxlength: 60 },
    summary: { type: String, default: '', maxlength: 600 },
    topics: { type: [String], default: [] }, // sub-topics
    tip: { type: String, default: '', maxlength: 400 },
  },
  { timestamps: true }
);
chapterSchema.index({ subject: 1, n: 1 }, { unique: true });

export const Chapter = mongoose.model('Chapter', chapterSchema);
