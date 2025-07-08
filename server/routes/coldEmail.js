import express from 'express';
import { EmailAccount, Lead, ColdEmailCampaign } from '../models/ColdEmail.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Email Accounts Routes
router.get('/accounts', authenticate, async (req, res) => {
  try {
    const accounts = await EmailAccount.find({ userId: req.user._id });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/accounts', authenticate, async (req, res) => {
  try {
    const account = new EmailAccount({
      ...req.body,
      userId: req.user._id
    });
    await account.save();
    res.status(201).json(account);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/accounts/:id', authenticate, async (req, res) => {
  try {
    const account = await EmailAccount.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }
    res.json(account);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/accounts/:id', authenticate, async (req, res) => {
  try {
    const account = await EmailAccount.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }
    res.json({ message: 'Email account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Leads Routes
router.get('/leads', authenticate, async (req, res) => {
  try {
    const { status, tags, search } = req.query;
    const filter = { userId: req.user._id };

    if (status) filter.status = status;
    if (tags) filter.tags = { $in: tags.split(',') };

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

    const leads = await query.sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/leads', authenticate, async (req, res) => {
  try {
    const lead = new Lead({
      ...req.body,
      userId: req.user._id
    });
    await lead.save();
    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/leads/:id', authenticate, async (req, res) => {
  try {
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/leads/:id', authenticate, async (req, res) => {
  try {
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk import leads
router.post('/leads/bulk-import', authenticate, async (req, res) => {
  try {
    const { leads } = req.body;
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
    res.status(400).json({ message: error.message });
  }
});

// Campaigns Routes
router.get('/campaigns', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { userId: req.user._id };

    if (status) filter.status = status;

    const campaigns = await ColdEmailCampaign.find(filter)
      .populate('emailAccountIds', 'name email')
      .sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/campaigns', authenticate, async (req, res) => {
  try {
    const campaign = new ColdEmailCampaign({
      ...req.body,
      userId: req.user._id
    });
    await campaign.save();
    await campaign.populate('emailAccountIds', 'name email');
    res.status(201).json(campaign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/campaigns/:id', authenticate, async (req, res) => {
  try {
    const campaign = await ColdEmailCampaign.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    ).populate('emailAccountIds', 'name email');
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/campaigns/:id', authenticate, async (req, res) => {
  try {
    const campaign = await ColdEmailCampaign.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Start/Stop campaign
router.patch('/campaigns/:id/toggle', authenticate, async (req, res) => {
  try {
    const campaign = await ColdEmailCampaign.findOne({ _id: req.params.id, userId: req.user._id });
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
    }

    await campaign.save();
    await campaign.populate('emailAccountIds', 'name email');
    res.json(campaign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get campaign analytics
router.get('/campaigns/:id/analytics', authenticate, async (req, res) => {
  try {
    const campaign = await ColdEmailCampaign.findOne({ _id: req.params.id, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Calculate additional analytics
    const analytics = {
      ...campaign.stats,
      openRate: campaign.stats.emailsSent > 0 ? (campaign.stats.opened / campaign.stats.emailsSent) * 100 : 0,
      clickRate: campaign.stats.emailsSent > 0 ? (campaign.stats.clicked / campaign.stats.emailsSent) * 100 : 0,
      replyRate: campaign.stats.emailsSent > 0 ? (campaign.stats.replied / campaign.stats.emailsSent) * 100 : 0,
      bounceRate: campaign.stats.emailsSent > 0 ? (campaign.stats.bounced / campaign.stats.emailsSent) * 100 : 0,
      conversionRate: campaign.stats.emailsSent > 0 ? (campaign.stats.interested / campaign.stats.emailsSent) * 100 : 0
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;