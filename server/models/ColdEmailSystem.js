import mongoose from 'mongoose';

// Email Account Schema
const emailAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  provider: {
    type: String,
    enum: ['namecheap', 'gmail', 'outlook', 'smtp'],
    default: 'namecheap'
  },
  smtpSettings: {
    host: {
      type: String,
      default: 'mail.privateemail.com'
    },
    port: {
      type: Number,
      default: 587
    },
    username: String,
    password: String, // Will be encrypted
    secure: {
      type: Boolean,
      default: true
    }
  },
  imapSettings: {
    host: {
      type: String,
      default: 'mail.privateemail.com'
    },
    port: {
      type: Number,
      default: 993
    },
    secure: {
      type: Boolean,
      default: true
    }
  },
  dailyLimit: {
    type: Number,
    default: 50,
    min: 1,
    max: 200
  },
  isActive: {
    type: Boolean,
    default: true
  },
  warmupStatus: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed', 'paused'],
    default: 'not-started'
  },
  reputation: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  lastSyncAt: Date,
  emailsSentToday: {
    type: Number,
    default: 0
  },
  lastResetDate: {
    type: Date,
    default: Date.now
  },
  warmupSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    dailyWarmupEmails: {
      type: Number,
      default: 5,
      min: 1,
      max: 20
    },
    rampUpDays: {
      type: Number,
      default: 30
    }
  }
}, {
  timestamps: true
});

// Lead Schema
const leadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  company: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  jobTitle: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    trim: true
  },
  customFields: {
    type: Map,
    of: String
  },
  tags: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['new', 'contacted', 'opened', 'clicked', 'replied', 'interested', 'not-interested', 'bounced', 'unsubscribed'],
    default: 'new'
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  source: {
    type: String,
    trim: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeadCategory'
  },
  lastContactedAt: Date,
  notes: {
    type: String,
    trim: true
  },
  unsubscribedAt: Date,
  bounceCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Campaign Schema
const campaignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'stopped'],
    default: 'draft'
  },
  emailAccountIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailAccount'
  }],
  leadIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  }],
  sequence: [{
    stepNumber: {
      type: Number,
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    delayDays: {
      type: Number,
      default: 0,
      min: 0
    },
    conditions: {
      ifOpened: Boolean,
      ifClicked: Boolean,
      ifReplied: Boolean,
      ifNotOpened: Boolean
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  settings: {
    sendingSchedule: {
      timezone: {
        type: String,
        default: 'UTC'
      },
      workingDays: [{
        type: Number,
        min: 0,
        max: 6
      }],
      startTime: {
        type: String,
        default: '09:00'
      },
      endTime: {
        type: String,
        default: '17:00'
      }
    },
    throttling: {
      emailsPerHour: {
        type: Number,
        default: 10,
        min: 1,
        max: 50
      },
      delayBetweenEmails: {
        type: Number,
        default: 300, // seconds
        min: 60,
        max: 3600
      },
      randomizeDelay: {
        type: Boolean,
        default: true
      }
    },
    tracking: {
      openTracking: {
        type: Boolean,
        default: true
      },
      clickTracking: {
        type: Boolean,
        default: true
      },
      replyTracking: {
        type: Boolean,
        default: true
      }
    }
  },
  startedAt: Date,
  completedAt: Date,
  stats: {
    totalLeads: {
      type: Number,
      default: 0
    },
    emailsSent: {
      type: Number,
      default: 0
    },
    delivered: {
      type: Number,
      default: 0
    },
    opened: {
      type: Number,
      default: 0
    },
    clicked: {
      type: Number,
      default: 0
    },
    replied: {
      type: Number,
      default: 0
    },
    bounced: {
      type: Number,
      default: 0
    },
    unsubscribed: {
      type: Number,
      default: 0
    },
    interested: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Email Log Schema
const emailLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  emailAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailAccount',
    required: true
  },
  type: {
    type: String,
    enum: ['campaign', 'warmup', 'reply'],
    required: true
  },
  stepNumber: Number,
  subject: String,
  content: String,
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed'],
    default: 'queued'
  },
  sentAt: Date,
  deliveredAt: Date,
  openedAt: Date,
  clickedAt: Date,
  repliedAt: Date,
  bouncedAt: Date,
  trackingPixelId: String,
  messageId: String,
  errorMessage: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Warmup Email Schema
const warmupEmailSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fromAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailAccount',
    required: true
  },
  toAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailAccount',
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  isReply: {
    type: Boolean,
    default: false
  },
  parentEmailId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WarmupEmail'
  },
  sentAt: Date,
  openedAt: Date,
  repliedAt: Date,
  status: {
    type: String,
    enum: ['pending', 'sent', 'opened', 'replied', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Inbox Sync Schema
const inboxSyncSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  emailAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailAccount',
    required: true
  },
  lastSyncAt: {
    type: Date,
    default: Date.now
  },
  lastUid: Number,
  syncStatus: {
    type: String,
    enum: ['idle', 'syncing', 'error'],
    default: 'idle'
  },
  errorMessage: String,
  emailsProcessed: {
    type: Number,
    default: 0
  },
  repliesFound: {
    type: Number,
    default: 0
  },
  bouncesFound: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better performance
emailAccountSchema.index({ userId: 1, isActive: 1 });
emailAccountSchema.index({ userId: 1, email: 1 }, { unique: true });

leadSchema.index({ userId: 1, email: 1 }, { unique: true });
leadSchema.index({ userId: 1, status: 1 });
leadSchema.index({ userId: 1, tags: 1 });

campaignSchema.index({ userId: 1, status: 1 });
campaignSchema.index({ userId: 1, createdAt: -1 });

emailLogSchema.index({ userId: 1, campaignId: 1 });
emailLogSchema.index({ userId: 1, emailAccountId: 1 });
emailLogSchema.index({ userId: 1, status: 1 });
emailLogSchema.index({ sentAt: 1 });
emailLogSchema.index({ trackingPixelId: 1 });

warmupEmailSchema.index({ userId: 1, fromAccountId: 1 });
warmupEmailSchema.index({ userId: 1, toAccountId: 1 });
warmupEmailSchema.index({ sentAt: 1 });

inboxSyncSchema.index({ userId: 1, emailAccountId: 1 });
inboxSyncSchema.index({ lastSyncAt: 1 });

// Email Template Schema
const emailTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['cold-outreach', 'follow-up', 'partnership', 'sales', 'custom'],
    default: 'custom'
  },
  subject: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  variables: [{
    type: String,
    trim: true
  }],
  industry: {
    type: String,
    trim: true
  },
  useCase: {
    type: String,
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Inbox Message Schema
const inboxMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  emailAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailAccount',
    required: true
  },
  messageId: {
    type: String,
    required: true
  },
  threadId: {
    type: String
  },
  from: {
    name: String,
    email: {
      type: String,
      required: true
    }
  },
  to: [{
    name: String,
    email: String
  }],
  cc: [{
    name: String,
    email: String
  }],
  bcc: [{
    name: String,
    email: String
  }],
  subject: {
    type: String,
    required: true
  },
  content: {
    text: String,
    html: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isStarred: {
    type: Boolean,
    default: false
  },
  isReply: {
    type: Boolean,
    default: false
  },
  isBounce: {
    type: Boolean,
    default: false
  },
  isAutoReply: {
    type: Boolean,
    default: false
  },
  labels: [{
    type: String,
    trim: true
  }],
  attachments: [{
    filename: String,
    contentType: String,
    size: Number,
    contentId: String
  }],
  receivedAt: {
    type: Date,
    required: true
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    default: 'neutral'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  processed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// CSV Import Schema
const csvImportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  totalRows: {
    type: Number,
    default: 0
  },
  processedRows: {
    type: Number,
    default: 0
  },
  successfulRows: {
    type: Number,
    default: 0
  },
  failedRows: {
    type: Number,
    default: 0
  },
  mapping: {
    type: Map,
    of: String
  },
  errors: [{
    row: Number,
    field: String,
    message: String
  }],
  duplicates: [{
    row: Number,
    email: String,
    existingLeadId: String
  }]
}, {
  timestamps: true
});

// Indexes for new schemas
emailTemplateSchema.index({ userId: 1, category: 1 });
emailTemplateSchema.index({ userId: 1, name: 1 });

inboxMessageSchema.index({ userId: 1, emailAccountId: 1 });
inboxMessageSchema.index({ userId: 1, receivedAt: -1 });
inboxMessageSchema.index({ userId: 1, isRead: 1 });
inboxMessageSchema.index({ messageId: 1 }, { unique: true });
inboxMessageSchema.index({ threadId: 1 });
inboxMessageSchema.index({ 'from.email': 1 });

csvImportSchema.index({ userId: 1, createdAt: -1 });
csvImportSchema.index({ status: 1 });

// Virtual fields for campaign stats
campaignSchema.virtual('stats.openRate').get(function() {
  return this.stats.emailsSent > 0 ? (this.stats.opened / this.stats.emailsSent) * 100 : 0;
});

campaignSchema.virtual('stats.clickRate').get(function() {
  return this.stats.emailsSent > 0 ? (this.stats.clicked / this.stats.emailsSent) * 100 : 0;
});

campaignSchema.virtual('stats.replyRate').get(function() {
  return this.stats.emailsSent > 0 ? (this.stats.replied / this.stats.emailsSent) * 100 : 0;
});

campaignSchema.virtual('stats.bounceRate').get(function() {
  return this.stats.emailsSent > 0 ? (this.stats.bounced / this.stats.emailsSent) * 100 : 0;
});

// Ensure virtual fields are serialized
campaignSchema.set('toJSON', { virtuals: true });

export const EmailAccount = mongoose.models.EmailAccount || mongoose.model('EmailAccount', emailAccountSchema);
export const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
export const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
export const EmailLog = mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);
export const WarmupEmail = mongoose.models.WarmupEmail || mongoose.model('WarmupEmail', warmupEmailSchema);
export const InboxSync = mongoose.models.InboxSync || mongoose.model('InboxSync', inboxSyncSchema);
export const EmailTemplate = mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', emailTemplateSchema);
export const InboxMessage = mongoose.models.InboxMessage || mongoose.model('InboxMessage', inboxMessageSchema);
export const CsvImport = mongoose.models.CsvImport || mongoose.model('CsvImport', csvImportSchema);
