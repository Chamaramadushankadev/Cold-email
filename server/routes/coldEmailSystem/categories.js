import express from 'express';
import mongoose from 'mongoose';
import LeadCategory from '../../models/LeadCategory.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// Get all lead categories
router.get('/', authenticate, async (req, res) => {
  try {
    const categories = await LeadCategory.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(categories.map(cat => ({
      ...cat.toObject(),
      id: cat._id.toString(),
      userId: cat.userId.toString()
    })));
  } catch (error) {
    console.error('Error fetching lead categories:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create lead category
router.post('/', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const category = new LeadCategory({
      name: name.trim(),
      userId: req.user._id
    });

    await category.save();
    
    res.status(201).json({
      ...category.toObject(),
      id: category._id.toString(),
      userId: category.userId.toString()
    });
  } catch (error) {
    console.error('Error creating lead category:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete lead category
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid category ID format' });
    }

    const category = await LeadCategory.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!category) {
      return res.status(404).json({ message: 'Lead category not found' });
    }

    res.json({ message: 'Lead category deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead category:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;