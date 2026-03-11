const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    slug: { type: String, lowercase: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
    },
    phone: String,
    profileImage: String,
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned in queries unless explicitly requested
    },
    passwordChangedAt: Date,
    passwordResetCode: String,      // stored as SHA-256 hash
    passwordResetExpires: Date,
    passwordResetVerified: Boolean,
    role: {
      type: String,
      enum: ['user', 'manager', 'admin'],
      default: 'user',
    },
    active: { type: Boolean, default: true },

    // Wishlist - array of product references
    wishlist: [{ type: mongoose.Schema.ObjectId, ref: 'Product' }],

    // Embedded addresses - always accessed with user, no separate query needed
    addresses: [
      {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
        alias: String, // 'Home', 'Work', etc.
        details: String,
        phone: String,
        city: String,
        postalCode: String,
      },
    ],

    // Refresh tokens array - supports multi-device login
    // Stored as SHA-256 hashes so a DB breach doesn't expose valid tokens
    refreshTokens: [
      {
        token: String,       // hashed
        createdAt: { type: Date, default: Date.now },
        expiresAt: Date,
      },
    ],
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ email: 1 });  // unique already creates this; explicit for clarity
userSchema.index({ role: 1 });   // admin user listing filtered by role

// Pre-save: hash password only when it was actually modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance method: verify a candidate password against the hashed value
userSchema.methods.correctPassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method: was password changed AFTER the JWT was issued?
// Used in protect middleware to invalidate tokens issued before a password reset
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

module.exports = mongoose.model('User', userSchema);
