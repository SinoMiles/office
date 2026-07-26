import mongoose from 'mongoose';

const CaptchaChallengeSchema = new mongoose.Schema({
  answerHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  consumedAt: { type: Date },
}, { timestamps: true });

export default mongoose.models.CaptchaChallenge || mongoose.model('CaptchaChallenge', CaptchaChallengeSchema);
