import express from 'express';
import mongoose from 'mongoose';
import { Lead } from '../../models/ColdEmailSystem.js';
import { authenticate } from '../../middleware/auth.js';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';

// Configure multer for CSV uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const router = express.Router();

// Helper function to transform data
const transformLead = (lead) => {
  const leadObj = lead.toObject();
  return {
    ...leadObj,
    id: leadObj._id.toString(),
    userId: leadObj.userId.toString()
  };
};

// Get all leads
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, tags, search, page = 1, limit = 50 } = req.query;
    const filter = { userId: req.user._id };

    if (status && status !== 'all') filter.status = status;
    if (tags && tags !== 'all') filter.tags = { $in: tags.split(',') };

    let query = Lead.find(filter);

    if (search) {
      query = query.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { company: { $regex: search, $options: 'i' } }
        ]
      });
    }

    const leads = await query
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Lead.countDocuments(filter);
    const transformedLeads = leads.map(transformLead);

    res.json({
      leads: transformedLeads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create lead
router.post('/', authenticate, async (req, res) => {
  try {
    const leadData = {
      ...req.body,
      userId: req.user._id
    };

    const lead = new Lead(leadData);
    await lead.save();
    
    res.status(201).json(transformLead(lead));
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(400).json({ message: error.message });
  }
});

// Bulk import leads
router.post('/bulk-import', authenticate, async (req, res) => {
  try {
    const { leads } = req.body;
    
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ message: 'Invalid leads data' });
    }

    const leadsWithUserId = leads.map(lead => ({
      ...lead,
      userId: req.user._id
    }));

    const result = await Lead.insertMany(leadsWithUserId, { ordered: false });
    
    res.status(201).json({
      message: `Successfully imported ${result.length} leads`,
      imported: result.length
    });
  } catch (error) {
    console.error('Error bulk importing leads:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update lead
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lead ID format' });
    }

    const lead = await Lead.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json(transformLead(lead));
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete lead
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lead ID format' });
    }

    const lead = await Lead.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ message: error.message });
  }
});

// Upload and preview CSV
router.post('/csv-preview', authenticate, upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const results = [];
    const headers = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers.push(...headerList);
      })
      .on('data', (data) => {
        if (results.length < 5) { // Preview first 5 rows
          results.push(data);
        }
      })
      .on('end', () => {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({
          headers,
          preview: results,
          totalRows: results.length,
          suggestedMapping: {
            firstName: headers.find(h => /first.*name|fname/i.test(h)) || '',
            lastName: headers.find(h => /last.*name|lname/i.test(h)) || '',
            email: headers.find(h => /email|mail/i.test(h)) || '',
            company: headers.find(h => /company|organization/i.test(h)) || '',
            jobTitle: headers.find(h => /title|position|job/i.test(h)) || '',
            industry: headers.find(h => /industry|sector/i.test(h)) || '',
            website: headers.find(h => /website|url|domain/i.test(h)) || '',
            source: headers.find(h => /source|origin/i.test(h)) || ''
          }
        });
      })
      .on('error', (error) => {
        // Clean up uploaded file
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(400).json({ message: 'Error parsing CSV file: ' + error.message });
      });
  } catch (error) {
    console.error('Error previewing CSV:', error);
    res.status(500).json({ message: error.message });
  }
});

// Import CSV with mapping
router.post('/csv-import', authenticate, upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const { mapping, categoryId = '' } = req.body;
    const parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;

    const results = [];
    const errors = [];
    const duplicates = [];
    let rowNumber = 0;

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        rowNumber++;
        results.push({ ...data, rowNumber });
      })
      .on('end', async () => {
        try {
          let successCount = 0;
          let failCount = 0;

          for (const row of results) {
            try {
              const leadData = {
                firstName: row[parsedMapping.firstName] || '',
                lastName: row[parsedMapping.lastName] || '',
                email: row[parsedMapping.email] || '',
                company: row[parsedMapping.company] || '',
                jobTitle: row[parsedMapping.jobTitle] || '',
                industry: row[parsedMapping.industry] || '',
                website: row[parsedMapping.website] || '',
                source: row[parsedMapping.source] || 'CSV Import',
                categoryId: categoryId || null,
                userId: req.user._id
              };

              // Validate required fields
              if (!leadData.email) {
                errors.push({
                  row: row.rowNumber,
                  field: 'email',
                  message: 'Email is required'
                });
                failCount++;
                continue;
              }

              if (!leadData.firstName && !leadData.lastName) {
                errors.push({
                  row: row.rowNumber,
                  field: 'name',
                  message: 'First name or last name is required'
                });
                failCount++;
                continue;
              }

              // Check for duplicates
              const existingLead = await Lead.findOne({
                userId: req.user._id,
                email: leadData.email
              });

              if (existingLead) {
                duplicates.push({
                  row: row.rowNumber,
                  email: leadData.email,
                  existingLeadId: existingLead._id.toString()
                });
                failCount++;
                continue;
              }

              // Create lead
              const lead = new Lead(leadData);
              await lead.save();
              successCount++;

            } catch (error) {
              errors.push({
                row: row.rowNumber,
                field: 'general',
                message: error.message
              });
              failCount++;
            }
          }

          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          res.json({
            totalRows: results.length,
            successfulRows: successCount,
            failedRows: failCount,
            errors: errors.slice(0, 10), // Return first 10 errors
            duplicates: duplicates.slice(0, 10), // Return first 10 duplicates
            message: `Import completed. ${successCount} leads imported successfully, ${failCount} failed.`
          });

        } catch (error) {
          // Clean up uploaded file
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          
          res.status(500).json({ message: 'Import failed: ' + error.message });
        }
      })
      .on('error', async (error) => {
        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        res.status(400).json({ message: 'Error parsing CSV file: ' + error.message });
      });

  } catch (error) {
    console.error('Error importing CSV:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;