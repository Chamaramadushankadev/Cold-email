import express from 'express';
import mongoose from 'mongoose';
import { EmailAccount, Lead, Campaign, EmailLog, WarmupEmail, InboxSync, EmailTemplate, InboxMessage, CsvImport } from '../models/ColdEmailSystem.js';
import { authenticate } from '../middleware/auth.js';
import { sendEmail, syncInbox, generateWarmupContent, createTransporter } from '../services/emailService.js';
import { scheduleWarmupEmails, scheduleCampaignEmails } from '../services/emailScheduler.js';

// Import modular routes
import accountsRoutes from './coldEmailSystem/accounts.js';
import leadsRoutes from './coldEmailSystem/leads.js';
import categoriesRoutes from './coldEmailSystem/categories.js';

const router = express.Router();

// Mount sub-routes
router.use('/accounts', accountsRoutes);
router.use('/leads', leadsRoutes);
router.use('/lead-categories', categoriesRoutes);

// Helper function to transform data
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

export default router;