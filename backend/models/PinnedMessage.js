import mongoose from "mongoose";

const pinnedMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true
    },
    messageId: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

pinnedMessageSchema.index({ userId: 1, messageId: 1 }, { unique: true });

export default mongoose.model("PinnedMessage", pinnedMessageSchema);
