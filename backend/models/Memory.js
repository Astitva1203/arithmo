import mongoose from "mongoose";

const memorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    memoryKey: {
      type: String,
      required: true,
      trim: true
    },
    memoryValue: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

memorySchema.index({ userId: 1, memoryKey: 1 }, { unique: true });

export default mongoose.model("Memory", memorySchema);
