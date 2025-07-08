import express from 'express';
import mongoose from 'mongoose';
import { EmailAccount, InboxSync } from '../../models/ColdEmailSystem.js';
import { authenticate } from '../../middleware/auth.js';
import { createTransporter } from '../../services/emailService.js';

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

// Get all email accounts
router.get('/', authenticate, async (req, res) => {
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
router.post('/', authenticate, async (req, res) => {
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
router.put('/:id', authenticate, async (req, res) => {
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
router.delete('/:id', authenticate, async (req, res) => {
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

    res.json({ message: 'Email account deleted successfully' });
  } catch (error) {
    console.error('Error deleting email account:', error);
    res.status(500).json({ message: error.message });
  }
});

// Test email account connection
router.post('/:id/test', authenticate, async (req, res) => {
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

export default router;