import express from 'express';
import mongoose from 'mongoose';
import { EmailAccount, Lead, Campaign, EmailLog, WarmupEmail, InboxSync, EmailTemplate, InboxMessage, CsvImport } from '../models/ColdEmailSystem.js';
import LeadCategory from '../models/LeadCategory.js';
import { authenticate } from '../middleware/auth.js';
import { sendEmail, syncInbox, generateWarmupContent, createTransporter } from '../services/emailService.js';
import { scheduleWarmupEmails, scheduleCampaignEmails } from '../services/emailScheduler.js';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import LeadCategory from '../models/LeadCategory.js';

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
const transformEmailAccount = (account) => {
  const accountObj = account.toObject();
  return {
    ...accountObj,
    id: accountObj._id.toString(),
    userId: accountObj.userId.toString()
  };
};

const transformLead = (lead) => {
  const leadObj = lead.toObject();
  return {
    ...leadObj,
    id: leadObj._id.toString(),
    userId: leadObj.userId.toString()
  };
};

const transformCampaign = (campaign) => {
  const campaignObj = campaign.toObject();
  return {
    ...campaignObj,
    id: campaignObj._id.toString(),
    userId: campaignObj.userId.toString(),
    emailAccountIds: campaignObj.emailAccountIds.map(id => id.toString()),
    leadIds: campaignObj.leadIds.map(id => id.toString())
  };
};
// Lead Categories
router.get('/categories', authenticate, async (req, res) => {
  try {
    const categories = await LeadCategory.find({ userId: req.user._id });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/categories', authenticate, async (req, res) => {
  try {
    const category = new LeadCategory({
      name: req.body.name,
      userId: req.user._id
    });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
// ==================== EMAIL ACCOUNTS ====================

// Get all email accounts
router.get('/accounts', authenticate, async (req, res) => {
  try {
    const accounts = await EmailAccount.find({ userId: req.user._id }).sort({ createdAt: -1 });
    const transformedAccounts = accounts.map(transformEmailAccount);
    res.json(transformedAccounts);
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create email account
router.post('/accounts', authenticate, async (req, res) => {
  try {
    const {
      name,
      email,
      provider,
      smtpSettings,
      imapSettings,
      dailyLimit,
      warmupSettings
    } = req.body;

    const accountData = {
      name,
      email,
      provider: provider || 'namecheap',
      smtpSettings: {
        host: smtpSettings?.host || 'mail.privateemail.com',
        port: smtpSettings?.port || 587,
        username: smtpSettings?.username || email,
        password: smtpSettings?.password,
        secure: smtpSettings?.secure !== false
      },
      imapSettings: {
        host: imapSettings?.host || 'mail.privateemail.com',
        port: imapSettings?.port || 993,
        secure: imapSettings?.secure !== false
      },
      dailyLimit: dailyLimit || 50,
      warmupSettings: {
        enabled: warmupSettings?.enabled !== false,
        dailyWarmupEmails: warmupSettings?.dailyWarmupEmails || 5,
        rampUpDays: warmupSettings?.rampUpDays || 30
      },
      userId: req.user._id
    };

    const account = new EmailAccount(accountData);
    await account.save();

    // Initialize inbox sync record
    const inboxSync = new InboxSync({
      userId: req.user._id,
      emailAccountId: account._id
    });
    await inboxSync.save();

    res.status(201).json(transformEmailAccount(account));
  } catch (error) {
    console.error('Error creating email account:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update email account
router.put('/accounts/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid account ID format' });
    }

    const account = await EmailAccount.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    res.json(transformEmailAccount(account));
  } catch (error) {
    console.error('Error updating email account:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete email account
router.delete('/accounts/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid account ID format' });
    }

    const account = await EmailAccount.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    // Clean up related data
    await InboxSync.deleteMany({ emailAccountId: id });
    await WarmupEmail.deleteMany({ 
      $or: [{ fromAccountId: id }, { toAccountId: id }] 
    });

    res.json({ message: 'Email account deleted successfully' });
  } catch (error) {
    console.error('Error deleting email account:', error);
    res.status(500).json({ message: error.message });
  }
});

// Test email account connection
router.post('/accounts/:id/test', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid account ID format' });
    }

    const account = await EmailAccount.findOne({ _id: id, userId: req.user._id });
    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    // Test SMTP connection
    try {
      const transporter = createTransporter(account);
      await new Promise((resolve, reject) => {
        transporter.verify(function (error, success) {
          if (error) {
            console.log('Verification error:', error);
            reject(error);
          } else {
            console.log('Server is ready to take our messages');
            resolve(success);
          }
        });
      });

      res.json({ success: true, message: 'Email account connection successful' });
    } catch (error) {
      console.error('SMTP verification error:', error);
      res.status(400).json({ success: false, message: error.message });
    }
  } catch (error) {
    console.error('Error testing email account:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== LEAD CATEGORIES ====================

// Get all lead categories
router.get('/lead-categories', authenticate, async (req, res) => {
  try {
    const categories = await LeadCategory.find({ userId: req.user._id }).sort({ name: 1 });
    res.json(categories.map(cat => ({
      id: cat._id.toString(),
      name: cat.name,
      userId: cat.userId.toString()
    })));
  } catch (error) {
    console.error('Error fetching lead categories:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create lead category
router.post('/lead-categories', authenticate, async (req, res) => {
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
      id: category._id.toString(),
      name: category.name,
      userId: category.userId.toString()
    });
  } catch (error) {
    console.error('Error creating lead category:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete lead category
router.delete('/lead-categories/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid category ID format' });
    }

    const category = await LeadCategory.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead category:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== LEADS ====================

// Get all leads
router.get('/leads', authenticate, async (req, res) => {
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
router.post('/leads', authenticate, async (req, res) => {
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
router.post('/leads/bulk-import', authenticate, async (req, res) => {
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
router.put('/leads/:id', authenticate, async (req, res) => {
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
router.delete('/leads/:id', authenticate, async (req, res) => {
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

// ==================== EMAIL TEMPLATES ====================

// Get all email templates
router.get('/templates', authenticate, async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { userId: req.user._id };
    
    if (category && category !== 'all') filter.category = category;
    
    const templates = await EmailTemplate.find(filter).sort({ createdAt: -1 });
    
    res.json(templates.map(template => ({
      ...template.toObject(),
      id: template._id.toString(),
      userId: template.userId.toString()
    })));
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create email template
router.post('/templates', authenticate, async (req, res) => {
  try {
    const {
      name,
      category,
      subject,
      content,
      variables,
      industry,
      useCase
    } = req.body;

    const templateData = {
      name,
      category: category || 'custom',
      subject,
      content,
      variables: variables || [],
      industry: industry || '',
      useCase: useCase || '',
      userId: req.user._id
    };

    const template = new EmailTemplate(templateData);
    await template.save();
    
    res.status(201).json({
      ...template.toObject(),
      id: template._id.toString(),
      userId: template.userId.toString()
    });
  } catch (error) {
    console.error('Error creating email template:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update email template
router.put('/templates/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid template ID format' });
    }

    const template = await EmailTemplate.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!template) {
      return res.status(404).json({ message: 'Email template not found' });
    }

    res.json({
      ...template.toObject(),
      id: template._id.toString(),
      userId: template.userId.toString()
    });
  } catch (error) {
    console.error('Error updating email template:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete email template
router.delete('/templates/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid template ID format' });
    }

    const template = await EmailTemplate.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!template) {
      return res.status(404).json({ message: 'Email template not found' });
    }

    res.json({ message: 'Email template deleted successfully' });
  } catch (error) {
    console.error('Error deleting email template:', error);
    res.status(500).json({ message: error.message });
  }
});

// Duplicate email template
router.post('/templates/:id/duplicate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid template ID format' });
    }

    const originalTemplate = await EmailTemplate.findOne({ _id: id, userId: req.user._id });
    if (!originalTemplate) {
      return res.status(404).json({ message: 'Email template not found' });
    }

    const duplicateTemplate = new EmailTemplate({
      ...originalTemplate.toObject(),
      _id: undefined,
      name: `${originalTemplate.name} (Copy)`,
      usageCount: 0
    });

    await duplicateTemplate.save();

    res.status(201).json({
      ...duplicateTemplate.toObject(),
      id: duplicateTemplate._id.toString(),
      userId: duplicateTemplate.userId.toString()
    });
  } catch (error) {
    console.error('Error duplicating email template:', error);
    res.status(400).json({ message: error.message });
  }
});

// ==================== CAMPAIGNS ====================

// Get all campaigns
router.get('/campaigns', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { userId: req.user._id };

    if (status && status !== 'all') filter.status = status;

    const campaigns = await Campaign.find(filter)
      .populate('emailAccountIds', 'name email')
      .sort({ createdAt: -1 });

    const transformedCampaigns = campaigns.map(transformCampaign);
    res.json(transformedCampaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create campaign
router.post('/campaigns', authenticate, async (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      userId: req.user._id
    };

    const campaign = new Campaign(campaignData);
    await campaign.save();
    await campaign.populate('emailAccountIds', 'name email');
    
    res.status(201).json(transformCampaign(campaign));
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update campaign
router.put('/campaigns/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid campaign ID format' });
    }

    const campaign = await Campaign.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    ).populate('emailAccountIds', 'name email');

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json(transformCampaign(campaign));
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(400).json({ message: error.message });
  }
});

// Start/Stop campaign
router.patch('/campaigns/:id/toggle', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid campaign ID format' });
    }

    const campaign = await Campaign.findOne({ _id: id, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status === 'active') {
      campaign.status = 'paused';
    } else if (campaign.status === 'paused' || campaign.status === 'draft') {
      campaign.status = 'active';
      if (!campaign.startedAt) {
        campaign.startedAt = new Date();
      }
      
      // Schedule campaign emails
      await scheduleCampaignEmails(campaign);
    }

    await campaign.save();
    await campaign.populate('emailAccountIds', 'name email');
    
    res.json(transformCampaign(campaign));
  } catch (error) {
    console.error('Error toggling campaign:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get campaign analytics
router.get('/campaigns/:id/analytics', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid campaign ID format' });
    }

    const campaign = await Campaign.findOne({ _id: id, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Get detailed email logs for this campaign
    const emailLogs = await EmailLog.find({ campaignId: id })
      .populate('leadId', 'firstName lastName email company')
      .populate('emailAccountId', 'name email')
      .sort({ sentAt: -1 });

    const analytics = {
      ...campaign.stats,
      openRate: campaign.stats.emailsSent > 0 ? (campaign.stats.opened / campaign.stats.emailsSent) * 100 : 0,
      clickRate: campaign.stats.emailsSent > 0 ? (campaign.stats.clicked / campaign.stats.emailsSent) * 100 : 0,
      replyRate: campaign.stats.emailsSent > 0 ? (campaign.stats.replied / campaign.stats.emailsSent) * 100 : 0,
      bounceRate: campaign.stats.emailsSent > 0 ? (campaign.stats.bounced / campaign.stats.emailsSent) * 100 : 0,
      conversionRate: campaign.stats.emailsSent > 0 ? (campaign.stats.interested / campaign.stats.emailsSent) * 100 : 0,
      emailLogs: emailLogs.map(log => ({
        id: log._id.toString(),
        lead: log.leadId,
        emailAccount: log.emailAccountId,
        subject: log.subject,
        status: log.status,
        sentAt: log.sentAt,
        openedAt: log.openedAt,
        clickedAt: log.clickedAt,
        repliedAt: log.repliedAt
      }))
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== UNIFIED INBOX ====================

// Get inbox messages
router.get('/inbox', authenticate, async (req, res) => {
  try {
    const { 
      accountId, 
      isRead, 
      isStarred, 
      labels, 
      search, 
      page = 1, 
      limit = 50 
    } = req.query;
    
    const filter = { userId: req.user._id };
    
    if (accountId && mongoose.Types.ObjectId.isValid(accountId)) {
      filter.emailAccountId = accountId;
    }
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    if (isStarred !== undefined) filter.isStarred = isStarred === 'true';
    if (labels) filter.labels = { $in: labels.split(',') };
    
    let query = InboxMessage.find(filter)
      .populate('emailAccountId', 'name email')
      .populate('campaignId', 'name')
      .populate('leadId', 'firstName lastName email company');
    
    if (search) {
      query = query.find({
        $or: [
          { subject: { $regex: search, $options: 'i' } },
          { 'from.email': { $regex: search, $options: 'i' } },
          { 'from.name': { $regex: search, $options: 'i' } },
          { 'content.text': { $regex: search, $options: 'i' } }
        ]
      });
    }
    
    const messages = await query
      .sort({ receivedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await InboxMessage.countDocuments(filter);
    
    res.json({
      messages: messages.map(msg => ({
        ...msg.toObject(),
        id: msg._id.toString(),
        userId: msg.userId.toString(),
        emailAccountId: msg.emailAccountId._id.toString(),
        campaignId: msg.campaignId?._id.toString(),
        leadId: msg.leadId?._id.toString()
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching inbox messages:', error);
    res.status(500).json({ message: error.message });
  }
});

// Mark message as read/unread
router.patch('/inbox/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid message ID format' });
    }

    const message = await InboxMessage.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { isRead: isRead !== undefined ? isRead : true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    res.json({
      ...message.toObject(),
      id: message._id.toString(),
      userId: message.userId.toString()
    });
  } catch (error) {
    console.error('Error updating message read status:', error);
    res.status(400).json({ message: error.message });
  }
});

// Star/unstar message
router.patch('/inbox/:id/star', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { isStarred } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid message ID format' });
    }

    const message = await InboxMessage.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { isStarred: isStarred !== undefined ? isStarred : true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    res.json({
      ...message.toObject(),
      id: message._id.toString(),
      userId: message.userId.toString()
    });
  } catch (error) {
    console.error('Error updating message star status:', error);
    res.status(400).json({ message: error.message });
  }
});

// Add labels to message
router.patch('/inbox/:id/labels', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { labels, action = 'add' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid message ID format' });
    }

    const message = await InboxMessage.findOne({ _id: id, userId: req.user._id });
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (action === 'add') {
      message.labels = [...new Set([...message.labels, ...labels])];
    } else if (action === 'remove') {
      message.labels = message.labels.filter(label => !labels.includes(label));
    } else if (action === 'set') {
      message.labels = labels;
    }

    await message.save();

    res.json({
      ...message.toObject(),
      id: message._id.toString(),
      userId: message.userId.toString()
    });
  } catch (error) {
    console.error('Error updating message labels:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get inbox statistics
router.get('/inbox/stats', authenticate, async (req, res) => {
  try {
    const { accountId } = req.query;
    const filter = { userId: req.user._id };
    
    if (accountId && mongoose.Types.ObjectId.isValid(accountId)) {
      filter.emailAccountId = accountId;
    }

    const [
      totalMessages,
      unreadMessages,
      starredMessages,
      repliesCount,
      bouncesCount
    ] = await Promise.all([
      InboxMessage.countDocuments(filter),
      InboxMessage.countDocuments({ ...filter, isRead: false }),
      InboxMessage.countDocuments({ ...filter, isStarred: true }),
      InboxMessage.countDocuments({ ...filter, isReply: true }),
      InboxMessage.countDocuments({ ...filter, isBounce: true })
    ]);

    res.json({
      totalMessages,
      unreadMessages,
      starredMessages,
      repliesCount,
      bouncesCount,
      readRate: totalMessages > 0 ? ((totalMessages - unreadMessages) / totalMessages) * 100 : 0
    });
  } catch (error) {
    console.error('Error fetching inbox stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== WARMUP SYSTEM ====================

// Get warmup status
router.get('/warmup/status', authenticate, async (req, res) => {
  try {
    const accounts = await EmailAccount.find({ userId: req.user._id });
    const warmupStats = await Promise.all(
      accounts.map(async (account) => {
        const sentToday = await WarmupEmail.countDocuments({
          fromAccountId: account._id,
          sentAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        });

        const totalSent = await WarmupEmail.countDocuments({
          fromAccountId: account._id
        });

        const repliesReceived = await WarmupEmail.countDocuments({
          toAccountId: account._id,
          status: 'replied'
        });

        return {
          accountId: account._id.toString(),
          accountName: account.name,
          accountEmail: account.email,
          warmupStatus: account.warmupStatus,
          reputation: account.reputation,
          sentToday,
          totalSent,
          repliesReceived,
          dailyTarget: account.warmupSettings.dailyWarmupEmails
        };
      })
    );

    res.json(warmupStats);
  } catch (error) {
    console.error('Error fetching warmup status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Start warmup for account
router.post('/warmup/:accountId/start', authenticate, async (req, res) => {
  try {
    const { accountId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ message: 'Invalid account ID format' });
    }

    const account = await EmailAccount.findOne({ _id: accountId, userId: req.user._id });
    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    account.warmupStatus = 'in-progress';
    await account.save();

    // Schedule warmup emails
    await scheduleWarmupEmails(account);

    res.json({ message: 'Warmup started successfully', account: transformEmailAccount(account) });
  } catch (error) {
    console.error('Error starting warmup:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== INBOX SYNC ====================

// Get inbox sync status
router.get('/inbox/sync-status', authenticate, async (req, res) => {
  try {
    const syncStatuses = await InboxSync.find({ userId: req.user._id })
      .populate('emailAccountId', 'name email')
      .sort({ lastSyncAt: -1 });

    res.json(syncStatuses.map(sync => ({
      id: sync._id.toString(),
      emailAccount: sync.emailAccountId,
      lastSyncAt: sync.lastSyncAt,
      syncStatus: sync.syncStatus,
      emailsProcessed: sync.emailsProcessed,
      repliesFound: sync.repliesFound,
      bouncesFound: sync.bouncesFound,
      errorMessage: sync.errorMessage
    })));
  } catch (error) {
    console.error('Error fetching inbox sync status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Trigger manual inbox sync
router.post('/inbox/sync/:accountId', authenticate, async (req, res) => {
  try {
    const { accountId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ message: 'Invalid account ID format' });
    }

    const account = await EmailAccount.findOne({ _id: accountId, userId: req.user._id });
    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    // Trigger inbox sync
    const syncResult = await syncInbox(account);

    res.json({
      message: 'Inbox sync completed',
      result: syncResult
    });
  } catch (error) {
    console.error('Error syncing inbox:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== CSV IMPORT ====================

// Upload and preview CSV
router.post('/leads/csv-preview', authenticate, upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const results = [];
    const headers = [];
    let isFirstRow = true;

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
router.post('/leads/csv-import', authenticate, upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const { mapping, tags = '' } = req.body;
    const parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
    const leadTags = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];

    // Create import record
    const csvImport = new CsvImport({
      userId: req.user._id,
      filename: req.file.originalname,
      mapping: parsedMapping,
      status: 'processing'
    });
    await csvImport.save();

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
          csvImport.totalRows = results.length;
          await csvImport.save();

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
                tags: leadTags,
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

          // Update import record
          csvImport.status = 'completed';
          csvImport.processedRows = results.length;
          csvImport.successfulRows = successCount;
          csvImport.failedRows = failCount;
          csvImport.errors = errors;
          csvImport.duplicates = duplicates;
          await csvImport.save();

          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          res.json({
            importId: csvImport._id.toString(),
            totalRows: results.length,
            successfulRows: successCount,
            failedRows: failCount,
            errors: errors.slice(0, 10), // Return first 10 errors
            duplicates: duplicates.slice(0, 10), // Return first 10 duplicates
            message: `Import completed. ${successCount} leads imported successfully, ${failCount} failed.`
          });

        } catch (error) {
          csvImport.status = 'failed';
          csvImport.errors = [{ row: 0, field: 'general', message: error.message }];
          await csvImport.save();
          
          // Clean up uploaded file
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          
          res.status(500).json({ message: 'Import failed: ' + error.message });
        }
      })
      .on('error', async (error) => {
        csvImport.status = 'failed';
        csvImport.errors = [{ row: 0, field: 'general', message: error.message }];
        await csvImport.save();
        
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

// Get import history
router.get('/leads/import-history', authenticate, async (req, res) => {
  try {
    const imports = await CsvImport.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(imports.map(imp => ({
      ...imp.toObject(),
      id: imp._id.toString(),
      userId: imp.userId.toString()
    })));
  } catch (error) {
    console.error('Error fetching import history:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== EMAIL LOGS ====================

// Get email logs
router.get('/logs', authenticate, async (req, res) => {
  try {
    const { campaignId, accountId, status, page = 1, limit = 50 } = req.query;
    const filter = { userId: req.user._id };

    if (campaignId && mongoose.Types.ObjectId.isValid(campaignId)) {
      filter.campaignId = campaignId;
    }
    if (accountId && mongoose.Types.ObjectId.isValid(accountId)) {
      filter.emailAccountId = accountId;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const logs = await EmailLog.find(filter)
      .populate('campaignId', 'name')
      .populate('leadId', 'firstName lastName email company')
      .populate('emailAccountId', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await EmailLog.countDocuments(filter);

    res.json({
      logs: logs.map(log => ({
        id: log._id.toString(),
        campaign: log.campaignId,
        lead: log.leadId,
        emailAccount: log.emailAccountId,
        type: log.type,
        subject: log.subject,
        status: log.status,
        sentAt: log.sentAt,
        openedAt: log.openedAt,
        clickedAt: log.clickedAt,
        repliedAt: log.repliedAt,
        bouncedAt: log.bouncedAt,
        errorMessage: log.errorMessage
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== DASHBOARD ANALYTICS ====================

// Get dashboard analytics
router.get('/analytics/dashboard', authenticate, async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get counts
    const [
      totalAccounts,
      activeAccounts,
      totalLeads,
      totalCampaigns,
      activeCampaigns,
      emailsSentInRange,
      repliesInRange
    ] = await Promise.all([
      EmailAccount.countDocuments({ userId: req.user._id }),
      EmailAccount.countDocuments({ userId: req.user._id, isActive: true }),
      Lead.countDocuments({ userId: req.user._id }),
      Campaign.countDocuments({ userId: req.user._id }),
      Campaign.countDocuments({ userId: req.user._id, status: 'active' }),
      EmailLog.countDocuments({ 
        userId: req.user._id, 
        sentAt: { $gte: startDate },
        status: { $in: ['sent', 'delivered', 'opened', 'clicked', 'replied'] }
      }),
      EmailLog.countDocuments({ 
        userId: req.user._id, 
        repliedAt: { $gte: startDate }
      })
    ]);

    // Calculate overall stats from all campaigns
    const campaigns = await Campaign.find({ userId: req.user._id });
    const overallStats = campaigns.reduce((acc, campaign) => ({
      emailsSent: acc.emailsSent + campaign.stats.emailsSent,
      opened: acc.opened + campaign.stats.opened,
      clicked: acc.clicked + campaign.stats.clicked,
      replied: acc.replied + campaign.stats.replied,
      bounced: acc.bounced + campaign.stats.bounced
    }), { emailsSent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 });

    const analytics = {
      timeRange,
      period: { start: startDate, end: now },
      accounts: {
        total: totalAccounts,
        active: activeAccounts,
        warmingUp: await EmailAccount.countDocuments({ 
          userId: req.user._id, 
          warmupStatus: 'in-progress' 
        })
      },
      leads: {
        total: totalLeads,
        new: await Lead.countDocuments({ userId: req.user._id, status: 'new' }),
        contacted: await Lead.countDocuments({ userId: req.user._id, status: 'contacted' }),
        replied: await Lead.countDocuments({ userId: req.user._id, status: 'replied' }),
        interested: await Lead.countDocuments({ userId: req.user._id, status: 'interested' })
      },
      campaigns: {
        total: totalCampaigns,
        active: activeCampaigns,
        paused: await Campaign.countDocuments({ userId: req.user._id, status: 'paused' }),
        completed: await Campaign.countDocuments({ userId: req.user._id, status: 'completed' })
      },
      emails: {
        sentInRange: emailsSentInRange,
        repliesInRange: repliesInRange,
        totalSent: overallStats.emailsSent,
        totalOpened: overallStats.opened,
        totalClicked: overallStats.clicked,
        totalReplied: overallStats.replied,
        totalBounced: overallStats.bounced,
        openRate: overallStats.emailsSent > 0 ? (overallStats.opened / overallStats.emailsSent) * 100 : 0,
        clickRate: overallStats.emailsSent > 0 ? (overallStats.clicked / overallStats.emailsSent) * 100 : 0,
        replyRate: overallStats.emailsSent > 0 ? (overallStats.replied / overallStats.emailsSent) * 100 : 0,
        bounceRate: overallStats.emailsSent > 0 ? (overallStats.bounced / overallStats.emailsSent) * 100 : 0
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== ADVANCED ANALYTICS ====================

// Get advanced analytics
router.get('/analytics/advanced', authenticate, async (req, res) => {
  try {
    const { timeRange = 'month', campaignId, accountId } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const filter = { userId: req.user._id };
    const emailLogFilter = { userId: req.user._id, sentAt: { $gte: startDate } };
    
    if (campaignId && mongoose.Types.ObjectId.isValid(campaignId)) {
      emailLogFilter.campaignId = campaignId;
    }
    if (accountId && mongoose.Types.ObjectId.isValid(accountId)) {
      emailLogFilter.emailAccountId = accountId;
    }

    // Email performance over time
    const emailPerformance = await EmailLog.aggregate([
      { $match: emailLogFilter },
      {
        $group: {
          _id: {
            year: { $year: '$sentAt' },
            month: { $month: '$sentAt' },
            day: { $dayOfMonth: '$sentAt' }
          },
          sent: { $sum: 1 },
          opened: { $sum: { $cond: [{ $ne: ['$openedAt', null] }, 1, 0] } },
          clicked: { $sum: { $cond: [{ $ne: ['$clickedAt', null] }, 1, 0] } },
          replied: { $sum: { $cond: [{ $ne: ['$repliedAt', null] }, 1, 0] } },
          bounced: { $sum: { $cond: [{ $ne: ['$bouncedAt', null] }, 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Campaign comparison
    const campaignComparison = await Campaign.aggregate([
      { $match: filter },
      {
        $project: {
          name: 1,
          'stats.emailsSent': 1,
          'stats.opened': 1,
          'stats.clicked': 1,
          'stats.replied': 1,
          'stats.bounced': 1,
          openRate: {
            $cond: [
              { $gt: ['$stats.emailsSent', 0] },
              { $multiply: [{ $divide: ['$stats.opened', '$stats.emailsSent'] }, 100] },
              0
            ]
          },
          replyRate: {
            $cond: [
              { $gt: ['$stats.emailsSent', 0] },
              { $multiply: [{ $divide: ['$stats.replied', '$stats.emailsSent'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { 'stats.emailsSent': -1 } },
      { $limit: 10 }
    ]);

    // Lead source analysis
    const leadSources = await Lead.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          contacted: { $sum: { $cond: [{ $ne: ['$status', 'new'] }, 1, 0] } },
          replied: { $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] } },
          interested: { $sum: { $cond: [{ $eq: ['$status', 'interested'] }, 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Email account performance
    const accountPerformance = await EmailLog.aggregate([
      { $match: emailLogFilter },
      {
        $group: {
          _id: '$emailAccountId',
          sent: { $sum: 1 },
          opened: { $sum: { $cond: [{ $ne: ['$openedAt', null] }, 1, 0] } },
          replied: { $sum: { $cond: [{ $ne: ['$repliedAt', null] }, 1, 0] } },
          bounced: { $sum: { $cond: [{ $ne: ['$bouncedAt', null] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'emailaccounts',
          localField: '_id',
          foreignField: '_id',
          as: 'account'
        }
      },
      { $unwind: '$account' },
      {
        $project: {
          accountName: '$account.name',
          accountEmail: '$account.email',
          sent: 1,
          opened: 1,
          replied: 1,
          bounced: 1,
          openRate: {
            $cond: [
              { $gt: ['$sent', 0] },
              { $multiply: [{ $divide: ['$opened', '$sent'] }, 100] },
              0
            ]
          },
          replyRate: {
            $cond: [
              { $gt: ['$sent', 0] },
              { $multiply: [{ $divide: ['$replied', '$sent'] }, 100] },
              0
            ]
          },
          bounceRate: {
            $cond: [
              { $gt: ['$sent', 0] },
              { $multiply: [{ $divide: ['$bounced', '$sent'] }, 100] },
              0
            ]
          }
        }
      }
    ]);

    // Response time analysis
    const responseTimeAnalysis = await EmailLog.aggregate([
      { 
        $match: { 
          ...emailLogFilter, 
          repliedAt: { $ne: null },
          sentAt: { $ne: null }
        } 
      },
      {
        $project: {
          responseTime: {
            $divide: [
              { $subtract: ['$repliedAt', '$sentAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' },
          totalReplies: { $sum: 1 }
        }
      }
    ]);

    // Industry performance
    const industryPerformance = await Lead.aggregate([
      { $match: { ...filter, industry: { $ne: null, $ne: '' } } },
      {
        $lookup: {
          from: 'emaillogs',
          localField: '_id',
          foreignField: 'leadId',
          as: 'emails'
        }
      },
      {
        $group: {
          _id: '$industry',
          totalLeads: { $sum: 1 },
          contacted: { $sum: { $cond: [{ $gt: [{ $size: '$emails' }, 0] }, 1, 0] } },
          replied: { $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] } },
          interested: { $sum: { $cond: [{ $eq: ['$status', 'interested'] }, 1, 0] } }
        }
      },
      {
        $project: {
          industry: '$_id',
          totalLeads: 1,
          contacted: 1,
          replied: 1,
          interested: 1,
          contactRate: {
            $cond: [
              { $gt: ['$totalLeads', 0] },
              { $multiply: [{ $divide: ['$contacted', '$totalLeads'] }, 100] },
              0
            ]
          },
          replyRate: {
            $cond: [
              { $gt: ['$contacted', 0] },
              { $multiply: [{ $divide: ['$replied', '$contacted'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { totalLeads: -1 } }
    ]);

    res.json({
      timeRange,
      period: { start: startDate, end: now },
      emailPerformance,
      campaignComparison,
      leadSources,
      accountPerformance,
      responseTimeAnalysis: responseTimeAnalysis[0] || {
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        totalReplies: 0
      },
      industryPerformance
    });
  } catch (error) {
    console.error('Error fetching advanced analytics:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;