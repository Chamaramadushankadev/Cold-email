import mongoose from 'mongoose';

const emailAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: ['namecheap', 'gmail', 'outlook', 'smtp'],
    required: true
  },
  smtpSettings: {
    host: String,
    port: Number,
    username: String,
    password: String,
    secure: Boolean
  },
  dailyLimit: {
    type: Number,
    default: 50
  },
  isActive: {
    type: Boolean,
    default: true
  },
  warmupStatus: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed'],
    default: 'not-started'
  },
  reputation: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  }
}, {
  timestamps: true
});

const leadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  company: String,
  website: String,
  jobTitle: String,
  industry: String,
  customFields: {
    type: Map,
    of: String
  },
  tags: [String],
  status: {
    type: String,
    enum: ['new', 'contacted', 'opened', 'replied', 'interested', 'not-interested', 'bounced', 'unsubscribed'],
    default: 'new'
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  source: String,
  lastContactedAt: Date,
  notes: String
}, {
  timestamps: true
});

const campaignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed'],
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
    stepNumber: Number,
    subject: String,
    content: String,
    delayDays: Number,
    conditions: {
      ifOpened: Boolean,
      ifClicked: Boolean,
      ifReplied: Boolean
    },
    isActive: { type: Boolean, default: true }
  }],
  settings: {
    sendingSchedule: {
      timezone: String,
      workingDays: [Number],
      startTime: String,
      endTime: String
    },
    throttling: {
      emailsPerHour: Number,
      delayBetweenEmails: Number,
      randomizeDelay: Boolean
    },
    tracking: {
      openTracking: Boolean,
      clickTracking: Boolean,
      replyTracking: Boolean
    }
  },
  startedAt: Date,
  completedAt: Date,
  stats: {
    totalLeads: { type: Number, default: 0 },
    emailsSent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    replied: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
    interested: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Virtual fields for rates
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

// Indexes
leadSchema.index({ userId: 1, email: 1 }, { unique: true });
leadSchema.index({ userId: 1, status: 1 });
campaignSchema.index({ userId: 1, status: 1 });

export const EmailAccount = mongoose.model('EmailAccount', emailAccountSchema);
export const Lead = mongoose.model('Lead', leadSchema);
export const ColdEmailCampaign = mongoose.model('ColdEmailCampaign', campaignSchema);