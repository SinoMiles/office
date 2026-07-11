import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }, // Links to previous chat turn
  filename: { type: String },
  originalFile: { type: String }, // Path to the uploaded file
  processedFile: { type: String }, // Path to the modified file
  prompt: { type: String },
  aiTextResponse: { type: String }, // AI's conversational text response
  outputFilename: { type: String },
  outputFile: { type: String },
  previewFile: { type: String },
  status: { type: String, enum: ['pending', 'processing', 'cancelling', 'cancelled', 'completed', 'failed'], default: 'pending' },
  isPinned: { type: Boolean, default: false },
  runtime: {
    state: { type: String, enum: ['running', 'cancelling', 'cancelled', 'completed', 'failed'], default: undefined },
    progress: { type: mongoose.Schema.Types.Mixed },
    thought: { type: mongoose.Schema.Types.Mixed },
    streamedText: { type: String, default: '' },
    cancelRequested: { type: Boolean, default: false },
    updatedAt: { type: Date },
  },
  tokensUsed: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  errorMessage: { type: String },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) } // 24 hours TTL
}, { timestamps: true });

TaskSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

delete mongoose.models.Task;
export default mongoose.models.Task || mongoose.model('Task', TaskSchema);
