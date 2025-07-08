import { ColdEmailCampaign, Lead, EmailAccount, EmailTemplate, EmailSequenceStep } from '../types';

export const mockEmailAccounts: EmailAccount[] = [
  {
    id: '1',
    name: 'Primary Outreach',
    email: 'outreach@ooopzzz.com',
    provider: 'gmail',
    dailyLimit: 50,
    isActive: true,
    warmupStatus: 'completed',
    reputation: 92,
    createdAt: new Date('2025-01-01')
  },
  {
    id: '2',
    name: 'Secondary Outreach',
    email: 'hello@ooopzzz.com',
    provider: 'outlook',
    dailyLimit: 40,
    isActive: true,
    warmupStatus: 'in-progress',
    reputation: 78,
    createdAt: new Date('2025-01-05')
  },
  {
    id: '3',
    name: 'Partnership Outreach',
    email: 'partnerships@ooopzzz.com',
    provider: 'smtp',
    smtpSettings: {
      host: 'smtp.mailgun.org',
      port: 587,
      username: 'partnerships@ooopzzz.com',
      password: '••••••••',
      secure: true
    },
    dailyLimit: 30,
    isActive: false,
    warmupStatus: 'not-started',
    reputation: 65,
    createdAt: new Date('2025-01-10')
  }
];

export const mockLeads: Lead[] = [
  {
    id: '1',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@techstartup.com',
    company: 'TechStartup Inc',
    website: 'https://techstartup.com',
    jobTitle: 'Head of Marketing',
    industry: 'Technology',
    customFields: {
      'company_size': '50-100',
      'funding_stage': 'Series A'
    },
    tags: ['saas', 'marketing', 'high-priority'],
    status: 'interested',
    score: 85,
    source: 'LinkedIn',
    addedAt: new Date('2025-01-10'),
    lastContactedAt: new Date('2025-01-12'),
    notes: 'Showed interest in AI tools for content creation. Follow up with demo.'
  },
  {
    id: '2',
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'mike@creativestudio.io',
    company: 'Creative Studio',
    website: 'https://creativestudio.io',
    jobTitle: 'Creative Director',
    industry: 'Design',
    customFields: {
      'company_size': '10-25',
      'tools_used': 'Adobe Suite, Figma'
    },
    tags: ['design', 'creative', 'warm-lead'],
    status: 'replied',
    score: 72,
    source: 'Website Contact Form',
    addedAt: new Date('2025-01-08'),
    lastContactedAt: new Date('2025-01-11'),
    notes: 'Replied asking for pricing information. Send proposal.'
  },
  {
    id: '3',
    firstName: 'Emily',
    lastName: 'Rodriguez',
    email: 'emily@marketingagency.com',
    company: 'Digital Marketing Pro',
    website: 'https://marketingagency.com',
    jobTitle: 'Agency Owner',
    industry: 'Marketing',
    customFields: {
      'company_size': '25-50',
      'clients': '50+'
    },
    tags: ['agency', 'marketing', 'potential-partner'],
    status: 'opened',
    score: 68,
    source: 'Cold Outreach',
    addedAt: new Date('2025-01-05'),
    lastContactedAt: new Date('2025-01-09'),
    notes: 'Opened emails but no response yet. Try different angle.'
  },
  {
    id: '4',
    firstName: 'David',
    lastName: 'Kim',
    email: 'david@ecommercebrand.com',
    company: 'E-commerce Brand',
    website: 'https://ecommercebrand.com',
    jobTitle: 'Founder',
    industry: 'E-commerce',
    customFields: {
      'revenue': '$1M-5M',
      'platform': 'Shopify'
    },
    tags: ['ecommerce', 'founder', 'high-value'],
    status: 'contacted',
    score: 79,
    source: 'Industry Event',
    addedAt: new Date('2025-01-12'),
    lastContactedAt: new Date('2025-01-14'),
    notes: 'Met at conference. Interested in automation tools.'
  },
  {
    id: '5',
    firstName: 'Lisa',
    lastName: 'Wang',
    email: 'lisa@consultingfirm.com',
    company: 'Strategic Consulting',
    website: 'https://consultingfirm.com',
    jobTitle: 'Senior Consultant',
    industry: 'Consulting',
    customFields: {
      'specialization': 'Digital Transformation',
      'clients': 'Fortune 500'
    },
    tags: ['consulting', 'enterprise', 'decision-maker'],
    status: 'new',
    score: 91,
    source: 'Referral',
    addedAt: new Date('2025-01-15'),
    notes: 'Referred by existing client. High potential.'
  }
];

const mockSequenceSteps: EmailSequenceStep[] = [
  {
    id: '1',
    stepNumber: 1,
    subject: 'Quick question about {{company}} content strategy',
    content: `Hi {{first_name}},

I noticed {{company}} has been doing some interesting work in {{industry}}. I'm particularly impressed by your recent {{specific_achievement}}.

I help companies like yours streamline their content creation process using AI tools. We've helped similar companies reduce content creation time by 60% while improving quality.

Would you be open to a quick 15-minute call this week to discuss how this might apply to {{company}}?

Best regards,
[Your Name]`,
    delayDays: 0,
    isActive: true
  },
  {
    id: '2',
    stepNumber: 2,
    subject: 'Re: Quick question about {{company}} content strategy',
    content: `Hi {{first_name}},

I wanted to follow up on my previous email about helping {{company}} with content automation.

I understand you're probably busy, so I'll keep this brief. Here's a quick case study that might interest you:

[Case Study Link]

One of our clients in {{industry}} saw a 3x increase in content output while reducing costs by 40%.

If this sounds relevant, I'd love to show you how it works. Are you free for a brief call this week?

Best,
[Your Name]`,
    delayDays: 3,
    conditions: {
      ifOpened: false
    },
    isActive: true
  },
  {
    id: '3',
    stepNumber: 3,
    subject: 'Last follow-up - {{company}} content automation',
    content: `Hi {{first_name}},

This will be my last email about content automation for {{company}}.

I realize timing might not be right, but I wanted to leave you with something valuable regardless:

[Free Resource Link] - "The Complete Guide to AI-Powered Content Creation"

If your priorities change and you'd like to explore how AI can transform your content process, feel free to reach out.

Best of luck with your content initiatives!

[Your Name]`,
    delayDays: 7,
    conditions: {
      ifOpened: false,
      ifReplied: false
    },
    isActive: true
  }
];

export const mockColdEmailCampaigns: ColdEmailCampaign[] = [
  {
    id: '1',
    name: 'SaaS Content Marketing Outreach',
    description: 'Targeting SaaS companies for AI content creation tools',
    status: 'active',
    emailAccountIds: ['1', '2'],
    leadListIds: ['list1', 'list2'],
    sequence: mockSequenceSteps,
    settings: {
      sendingSchedule: {
        timezone: 'America/New_York',
        workingDays: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '17:00'
      },
      throttling: {
        emailsPerHour: 10,
        delayBetweenEmails: 300,
        randomizeDelay: true
      },
      tracking: {
        openTracking: true,
        clickTracking: true,
        replyTracking: true
      }
    },
    createdAt: new Date('2025-01-01'),
    startedAt: new Date('2025-01-05'),
    stats: {
      totalLeads: 250,
      emailsSent: 180,
      delivered: 175,
      opened: 89,
      clicked: 23,
      replied: 12,
      bounced: 5,
      unsubscribed: 2,
      interested: 8,
      openRate: 50.9,
      clickRate: 13.1,
      replyRate: 6.9,
      bounceRate: 2.8
    }
  },
  {
    id: '2',
    name: 'Agency Partnership Outreach',
    description: 'Reaching out to marketing agencies for partnership opportunities',
    status: 'active',
    emailAccountIds: ['3'],
    leadListIds: ['list3'],
    sequence: mockSequenceSteps,
    settings: {
      sendingSchedule: {
        timezone: 'America/Los_Angeles',
        workingDays: [1, 2, 3, 4, 5],
        startTime: '10:00',
        endTime: '16:00'
      },
      throttling: {
        emailsPerHour: 8,
        delayBetweenEmails: 450,
        randomizeDelay: true
      },
      tracking: {
        openTracking: true,
        clickTracking: true,
        replyTracking: true
      }
    },
    createdAt: new Date('2025-01-08'),
    startedAt: new Date('2025-01-10'),
    stats: {
      totalLeads: 150,
      emailsSent: 95,
      delivered: 92,
      opened: 41,
      clicked: 15,
      replied: 8,
      bounced: 3,
      unsubscribed: 1,
      interested: 5,
      openRate: 44.6,
      clickRate: 16.3,
      replyRate: 8.7,
      bounceRate: 3.3
    }
  },
  {
    id: '3',
    name: 'E-commerce Tool Promotion',
    description: 'Promoting AI tools to e-commerce business owners',
    status: 'paused',
    emailAccountIds: ['1'],
    leadListIds: ['list4'],
    sequence: mockSequenceSteps,
    settings: {
      sendingSchedule: {
        timezone: 'America/Chicago',
        workingDays: [1, 2, 3, 4, 5],
        startTime: '08:00',
        endTime: '18:00'
      },
      throttling: {
        emailsPerHour: 12,
        delayBetweenEmails: 300,
        randomizeDelay: false
      },
      tracking: {
        openTracking: true,
        clickTracking: true,
        replyTracking: true
      }
    },
    createdAt: new Date('2025-01-12'),
    stats: {
      totalLeads: 200,
      emailsSent: 45,
      delivered: 43,
      opened: 18,
      clicked: 6,
      replied: 3,
      bounced: 2,
      unsubscribed: 0,
      interested: 2,
      openRate: 41.9,
      clickRate: 14.0,
      replyRate: 7.0,
      bounceRate: 4.7
    }
  }
];

export const mockEmailTemplates: EmailTemplate[] = [
  {
    id: '1',
    name: 'SaaS Cold Outreach - Initial',
    category: 'cold-outreach',
    subject: 'Quick question about {{company}} content strategy',
    content: `Hi {{first_name}},

I noticed {{company}} has been doing some interesting work in {{industry}}. I'm particularly impressed by your recent {{specific_achievement}}.

I help companies like yours streamline their content creation process using AI tools. We've helped similar companies reduce content creation time by 60% while improving quality.

Would you be open to a quick 15-minute call this week to discuss how this might apply to {{company}}?

Best regards,
[Your Name]`,
    variables: ['first_name', 'company', 'industry', 'specific_achievement'],
    industry: 'SaaS',
    useCase: 'Initial cold outreach to SaaS companies',
    createdAt: new Date('2025-01-01')
  },
  {
    id: '2',
    name: 'Agency Partnership Proposal',
    category: 'partnership',
    subject: 'Partnership opportunity for {{company}}',
    content: `Hi {{first_name}},

I've been following {{company}} and I'm impressed by the quality of work you deliver to your clients.

I run Ooopzzz, where we help businesses leverage AI for content creation. I think there could be a great partnership opportunity here.

Our AI tools could help you:
- Deliver faster results to clients
- Increase your profit margins
- Offer new services

Would you be interested in exploring a partnership? I'd love to show you how other agencies are using our tools.

Best,
[Your Name]`,
    variables: ['first_name', 'company'],
    industry: 'Marketing',
    useCase: 'Partnership outreach to marketing agencies',
    createdAt: new Date('2025-01-02')
  },
  {
    id: '3',
    name: 'Follow-up - No Response',
    category: 'follow-up',
    subject: 'Re: {{original_subject}}',
    content: `Hi {{first_name}},

I wanted to follow up on my previous email about helping {{company}} with content automation.

I understand you're probably busy, so I'll keep this brief. Here's a quick case study that might interest you:

[Case Study Link]

One of our clients in {{industry}} saw a 3x increase in content output while reducing costs by 40%.

If this sounds relevant, I'd love to show you how it works. Are you free for a brief call this week?

Best,
[Your Name]`,
    variables: ['first_name', 'company', 'industry', 'original_subject'],
    useCase: 'Follow-up when no response to initial outreach',
    createdAt: new Date('2025-01-03')
  }
];