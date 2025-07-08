import React, { useState } from 'react';
import { Plus, Play, Pause, Edit3, Trash2, BarChart3, Calendar, Users, Mail } from 'lucide-react';
import { coldEmailAPI } from '../../services/api';

interface CampaignsTabProps {
  campaigns: any[];
  setCampaigns: (campaigns: any[]) => void;
  emailAccounts: any[];
  leadCategories: any[];
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const CampaignsTab: React.FC<CampaignsTabProps> = ({
  campaigns,
  setCampaigns,
  emailAccounts,
  leadCategories,
  showNotification
}) => {
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [showAnalytics, setShowAnalytics] = useState<string | null>(null);
  const [campaignAnalytics, setCampaignAnalytics] = useState<any>(null);

  const handleAddOrUpdateCampaign = async (formData: FormData) => {
    try {
      const selectedAccounts = formData.getAll('emailAccounts') as string[];
      const selectedCategories = formData.getAll('leadCategories') as string[];
      
      // Build email sequence from form data
      const sequence = [];
      let stepNumber = 1;
      
      // Initial email
      sequence.push({
        stepNumber,
        subject: formData.get('subject1') as string,
        content: formData.get('content1') as string,
        delayDays: 0,
        isActive: true
      });
      
      // Follow-up emails (up to 8)
      for (let i = 2; i <= 8; i++) {
        const subject = formData.get(`subject${i}`) as string;
        const content = formData.get(`content${i}`) as string;
        const delay = parseInt(formData.get(`delay${i}`) as string) || 0;
        
        if (subject && content) {
          stepNumber++;
          sequence.push({
            stepNumber,
            subject,
            content,
            delayDays: delay,
            isActive: true
          });
        }
      }

      const campaignData = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        emailAccountIds: selectedAccounts,
        leadCategories: selectedCategories,
        sequence,
        settings: {
          sendingSchedule: {
            timezone: formData.get('timezone') as string || 'UTC',
            workingDays: [1, 2, 3, 4, 5], // Monday to Friday
            startTime: formData.get('startTime') as string || '09:00',
            endTime: formData.get('endTime') as string || '17:00'
          },
          throttling: {
            emailsPerHour: parseInt(formData.get('emailsPerHour') as string) || 10,
            delayBetweenEmails: parseInt(formData.get('delayBetweenEmails') as string) || 300,
            randomizeDelay: formData.get('randomizeDelay') === 'true'
          },
          tracking: {
            openTracking: formData.get('openTracking') === 'true',
            clickTracking: formData.get('clickTracking') === 'true',
            replyTracking: formData.get('replyTracking') === 'true'
          }
        }
      };

      if (editingCampaign) {
        const response = await coldEmailAPI.updateCampaign(editingCampaign.id, campaignData);
        setCampaigns(campaigns.map(c => c.id === editingCampaign.id ? response.data : c));
        showNotification('success', 'Campaign updated successfully');
      } else {
        const response = await coldEmailAPI.createCampaign(campaignData);
        setCampaigns([...campaigns, response.data]);
        showNotification('success', 'Campaign created successfully');
      }

      setEditingCampaign(null);
      setShowAddCampaign(false);
    } catch (error: any) {
      console.error('Error saving campaign:', error);
      showNotification('error', error.message || 'Failed to save campaign');
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await coldEmailAPI.deleteCampaign(campaignId);
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
      showNotification('success', 'Campaign deleted successfully');
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      showNotification('error', 'Failed to delete campaign');
    }
  };

  const handleToggleCampaign = async (campaignId: string) => {
    try {
      const response = await coldEmailAPI.toggleCampaign(campaignId);
      setCampaigns(campaigns.map(c => c.id === campaignId ? response.data : c));
      
      const campaign = campaigns.find(c => c.id === campaignId);
      const newStatus = campaign?.status === 'active' ? 'paused' : 'active';
      showNotification('success', `Campaign ${newStatus === 'active' ? 'started' : 'paused'} successfully`);
    } catch (error: any) {
      console.error('Error toggling campaign:', error);
      showNotification('error', 'Failed to toggle campaign status');
    }
  };

  const handleViewAnalytics = async (campaignId: string) => {
    try {
      const response = await coldEmailAPI.getCampaignAnalytics(campaignId);
      setCampaignAnalytics(response.data);
      setShowAnalytics(campaignId);
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      showNotification('error', 'Failed to load campaign analytics');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Email Campaigns</h3>
        <button
          onClick={() => {
            setEditingCampaign(null);
            setShowAddCampaign(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Campaign</span>
        </button>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">{campaign.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{campaign.description}</p>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => {
                    setEditingCampaign(campaign);
                    setShowAddCampaign(true);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteCampaign(campaign.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                  {campaign.status}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Email Accounts:</span>
                <span className="font-medium text-gray-900">{campaign.emailAccountIds?.length || 0}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Sequence Steps:</span>
                <span className="font-medium text-gray-900">{campaign.sequence?.length || 0}</span>
              </div>
              
              {campaign.stats && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-medium text-gray-900">{campaign.stats.emailsSent || 0}</div>
                    <div className="text-gray-600">Sent</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-medium text-gray-900">{Math.round(campaign.stats.openRate || 0)}%</div>
                    <div className="text-gray-600">Open Rate</div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center space-x-2">
              <button
                onClick={() => handleToggleCampaign(campaign.id)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                  campaign.status === 'active'
                    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                }`}
              >
                {campaign.status === 'active' ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Start</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleViewAnalytics(campaign.id)}
                className="flex-1 bg-blue-100 text-blue-800 px-3 py-2 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium flex items-center justify-center space-x-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-12">
          <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Campaigns Yet</h3>
          <p className="text-gray-600 mb-6">Create your first email campaign to start reaching out to leads</p>
          <button
            onClick={() => setShowAddCampaign(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Campaign
          </button>
        </div>
      )}

      {/* Add/Edit Campaign Modal */}
      {showAddCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              {editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}
            </h3>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleAddOrUpdateCampaign(formData);
              }}
              className="space-y-6"
            >
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingCampaign?.name || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    name="description"
                    defaultValue={editingCampaign?.description || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Email Accounts Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Accounts (Max 30 emails/day each)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {emailAccounts.map((account) => (
                    <label key={account.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="emailAccounts"
                        value={account.id}
                        defaultChecked={editingCampaign?.emailAccountIds?.includes(account.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{account.name} ({account.email})</span>
                    </label>
                  ))}
                </div>
              </div>

              

              {/* Lead Categories Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lead Categories</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {leadCategories.map((category) => (
                    <label key={category.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="leadCategories"
                        value={category.id}
                        defaultChecked={editingCampaign?.leadCategories?.includes(category.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{category.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Email Sequence */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Email Sequence</h4>
                
                {/* Initial Email */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-gray-900">Initial Email</h5>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Step 1</span>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                    <input
                      type="text"
                      name="subject1"
                      defaultValue={editingCampaign?.sequence?.[0]?.subject || ''}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                    <textarea
                      name="content1"
                      rows={6}
                      defaultValue={editingCampaign?.sequence?.[0]?.content || ''}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                
                {/* Follow-up Emails (up to 8) */}
                {[2, 3, 4, 5, 6, 7, 8].map((step) => {
                  const existingStep = editingCampaign?.sequence?.find((s: any) => s.stepNumber === step);
                  
                  return (
                    <div key={step} className="border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-gray-900">Follow-up Email {step-1}</h5>
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">Step {step}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                          <input
                            type="text"
                            name={`subject${step}`}
                            defaultValue={existingStep?.subject || ''}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Delay (days)</label>
                          <input
                            type="number"
                            name={`delay${step}`}
                            defaultValue={existingStep?.delayDays || step + 1}
                            min="1"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                        <textarea
                          name={`content${step}`}
                          rows={6}
                          defaultValue={existingStep?.content || ''}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Campaign Settings */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Campaign Settings</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                    <select
                      name="timezone"
                      defaultValue={editingCampaign?.settings?.sendingSchedule?.timezone || 'UTC'}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                    <input
                      type="time"
                      name="startTime"
                      defaultValue={editingCampaign?.settings?.sendingSchedule?.startTime || '09:00'}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                    <input
                      type="time"
                      name="endTime"
                      defaultValue={editingCampaign?.settings?.sendingSchedule?.endTime || '17:00'}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Emails Per Hour</label>
                    <input
                      type="number"
                      name="emailsPerHour"
                      defaultValue={editingCampaign?.settings?.throttling?.emailsPerHour || 10}
                      min="1"
                      max="20"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Delay Between Emails (seconds)</label>
                    <input
                      type="number"
                      name="delayBetweenEmails"
                      defaultValue={editingCampaign?.settings?.throttling?.delayBetweenEmails || 300}
                      min="60"
                      max="3600"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="randomizeDelay"
                        value="true"
                        defaultChecked={editingCampaign?.settings?.throttling?.randomizeDelay !== false}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Randomize delay (recommended)</span>
                    </label>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="openTracking"
                        value="true"
                        defaultChecked={editingCampaign?.settings?.tracking?.openTracking !== false}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Track opens</span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="clickTracking"
                        value="true"
                        defaultChecked={editingCampaign?.settings?.tracking?.clickTracking !== false}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Track clicks</span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="replyTracking"
                        value="true"
                        defaultChecked={editingCampaign?.settings?.tracking?.replyTracking !== false}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Track replies</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCampaign(false);
                    setEditingCampaign(null);
                  }}
                  className="w-full sm:flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingCampaign ? 'Update Campaign' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Analytics Modal */}
      {showAnalytics && campaignAnalytics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Campaign Analytics</h3>
              <button
                onClick={() => {
                  setShowAnalytics(null);
                  setCampaignAnalytics(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Sent', value: campaignAnalytics.emailsSent, color: 'bg-blue-500' },
                  { label: 'Opened', value: campaignAnalytics.opened, color: 'bg-green-500' },
                  { label: 'Clicked', value: campaignAnalytics.clicked, color: 'bg-purple-500' },
                  { label: 'Replied', value: campaignAnalytics.replied, color: 'bg-yellow-500' }
                ].map((stat, index) => (
                  <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                      </div>
                      <div className={`${stat.color} rounded-lg p-2`}>
                        <Mail className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Open Rate', value: `${Math.round(campaignAnalytics.openRate)}%` },
                  { label: 'Click Rate', value: `${Math.round(campaignAnalytics.clickRate)}%` },
                  { label: 'Reply Rate', value: `${Math.round(campaignAnalytics.replyRate)}%` }
                ].map((stat, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {campaignAnalytics.emailLogs && campaignAnalytics.emailLogs.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Recent Activity</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Lead</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Subject</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Sent</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Opened</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignAnalytics.emailLogs.map((log: any) => (
                          <tr key={log.id} className="border-t border-gray-200">
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {log.lead ? `${log.lead.firstName} ${log.lead.lastName}` : 'Unknown'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{log.subject}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                log.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                                log.status === 'opened' ? 'bg-green-100 text-green-800' :
                                log.status === 'clicked' ? 'bg-purple-100 text-purple-800' :
                                log.status === 'replied' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {log.sentAt ? new Date(log.sentAt).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {log.openedAt ? new Date(log.openedAt).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowAnalytics(null);
                  setCampaignAnalytics(null);
                }}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};