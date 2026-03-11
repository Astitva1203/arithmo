import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8
    },
    hasCompletedOnboarding: {
      type: Boolean,
      default: false
    },
    responseStyle: {
      type: String,
      enum: ["professional", "friendly", "teacher", "concise"],
      default: "friendly"
    },
    responseLength: {
      type: String,
      enum: ["short", "normal", "detailed"],
      default: "normal"
    },
    legalConsent: {
      acceptedTermsAt: {
        type: Date,
        default: null
      },
      acceptedPrivacyAt: {
        type: Date,
        default: null
      },
      ageConfirmed: {
        type: Boolean,
        default: false
      },
      policyVersion: {
        type: String,
        default: "2026-03-11"
      }
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("User", userSchema);
