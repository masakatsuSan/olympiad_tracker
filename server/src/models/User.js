import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'user'], default: 'user', index: true },
    // Bumped on password change or role change so older tokens stop working.
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.methods.toSafe = function () {
  return { id: this._id.toString(), name: this.name, email: this.email, role: this.role, createdAt: this.createdAt, lastLoginAt: this.lastLoginAt };
};

export const User = mongoose.model('User', userSchema);
