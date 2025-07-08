// models/LeadCategory.js
import mongoose from 'mongoose';

const LeadCategorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model('LeadCategory', LeadCategorySchema);
