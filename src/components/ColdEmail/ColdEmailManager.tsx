import React, { useState, useEffect } from 'react';
import { Plus, Mail, Users, BarChart3, Settings, Send } from 'lucide-react';
import { EmailAccountsTab } from './EmailAccountsTab';
import { LeadsTab } from './LeadsTab';
import { CampaignsTab } from './CampaignsTab';
import { InboxTab } from './InboxTab';
import { AnalyticsTab } from './AnalyticsTab';
import { coldEmailAPI } from '../../services/api';

export const ColdEmailManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'leads' | 'campaigns' | 'inbox' | 'analytics'>('accounts');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Shared state for cross-component communication
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [leadCategories, setLeadCategories] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [accountsRes, leadsRes, campaignsRes, categoriesRes] = await Promise.all([
        coldEmailAPI.getAccounts(),
        coldEmailAPI.getLeads(),
        coldEmailAPI.getCampaigns(),
        coldEmailAPI.getCategories()
      ]);
      
      setEmailAccounts(accountsRes.data || []);
      setLeads(leadsRes.data?.leads || []);
      setCampaigns(campaignsRes.data || []);
      setLeadCategories(categoriesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const tabs = [
    { id: 'accounts', label: 'Email Accounts', icon: Mail },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'campaigns', label: 'Campaigns', icon: Send },
    { id: 'inbox', label: 'Inbox', icon: Mail },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 }
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading cold email system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cold Email Marketing</h2>
          <p className="text-gray-600 mt-1">Manage your email outreach campaigns</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'accounts' && (
        <EmailAccountsTab 
          emailAccounts={emailAccounts}
          setEmailAccounts={setEmailAccounts}
          showNotification={showNotification}
        />
      )}
      {activeTab === 'leads' && (
        <LeadsTab 
          leads={leads}
          setLeads={setLeads}
          leadCategories={leadCategories}
          setLeadCategories={setLeadCategories}
          showNotification={showNotification}
        />
      )}
      {activeTab === 'campaigns' && (
        <CampaignsTab 
          campaigns={campaigns}
          setCampaigns={setCampaigns}
          emailAccounts={emailAccounts}
          leadCategories={leadCategories}
          showNotification={showNotification}
        />
      )}
      {activeTab === 'inbox' && (
        <InboxTab 
          emailAccounts={emailAccounts}
          showNotification={showNotification}
        />
      )}
      {activeTab === 'analytics' && (
        <AnalyticsTab 
          campaigns={campaigns}
          emailAccounts={emailAccounts}
          showNotification={showNotification}
        />
      )}
    </div>
  );
};