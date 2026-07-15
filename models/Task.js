import mongoose from 'mongoose';

const ArtifactSchema = new mongoose.Schema({
  filePath: { type: String, required: true },
  filename: { type: String, required: true },
  fileType: { type: String },
  workspace: { type: String },
  status: { type: String, enum: ['generating', 'ready', 'failed'], default: 'generating' },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const TaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }, // Links to previous chat turn
  filename: { type: String },
  originalFile: { type: String }, // Path to the uploaded file
  processedFile: { type: String }, // Path to the modified file
  prompt: { type: String },
  aionConversationId: { type: String },
  workspace: { type: String },
  aiTextResponse: { type: String }, // AI's conversational text response
  outputFilename: { type: String },
  outputFile: { type: String },
  previewFile: { type: String },
  artifacts: { type: [ArtifactSchema], default: [] },
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
}, { timestamps: true });

delete mongoose.models.Task;
export default mongoose.models.Task || mongoose.model('Task', TaskSchema);
