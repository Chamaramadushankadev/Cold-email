import React, { useState } from 'react';
import { Plus, Edit3, Trash2, CheckCircle, XCircle, Settings } from 'lucide-react';
import { coldEmailAPI } from '../../services/api';

interface EmailAccountsTabProps {
  emailAccounts: any[];
  setEmailAccounts: (accounts: any[]) => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const EmailAccountsTab: React.FC<EmailAccountsTabProps> = ({
  emailAccounts,
  setEmailAccounts,
  showNotification
}) => {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [testingAccount, setTestingAccount] = useState<string | null>(null);

  const handleAddOrUpdateAccount = async (formData: FormData) => {
    try {
      const accountData = {
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        provider: formData.get('provider') as string || 'namecheap',
        smtpSettings: {
          host: formData.get('smtpHost') as string || 'mail.privateemail.com',
          port: parseInt(formData.get('smtpPort') as string) || 587,
          username: formData.get('smtpUsername') as string,
          password: formData.get('smtpPassword') as string,
          secure: formData.get('smtpSecure') === 'true'
        },
        dailyLimit: parseInt(formData.get('dailyLimit') as string) || 30
      };

      if (editingAccount) {
        const response = await coldEmailAPI.updateAccount(editingAccount.id, accountData);
        setEmailAccounts(emailAccounts.map(acc => acc.id === editingAccount.id ? response.data : acc));
        showNotification('success', 'Email account updated successfully');
      } else {
        const response = await coldEmailAPI.createAccount(accountData);
        setEmailAccounts([...emailAccounts, response.data]);
        showNotification('success', 'Email account created successfully');
      }

      setEditingAccount(null);
      setShowAddAccount(false);
    } catch (error: any) {
      console.error('Error saving account:', error);
      showNotification('error', error.message || 'Failed to save email account');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!window.confirm('Are you sure you want to delete this email account?')) return;
    
    try {
      await coldEmailAPI.deleteAccount(accountId);
      setEmailAccounts(emailAccounts.filter(acc => acc.id !== accountId));
      showNotification('success', 'Email account deleted successfully');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      showNotification('error', 'Failed to delete email account');
    }
  };

  const handleTestAccount = async (accountId: string) => {
    try {
      setTestingAccount(accountId);
      showNotification('success', 'Testing connection... This may take a moment.');
      try {
        const response = await coldEmailAPI.testAccount(accountId);
        if (response.data.success) {
          showNotification('success', 'Email account verified successfully!');
        } else {
          showNotification('error', response.data.message || 'Email account verification failed');
        }
      } catch (error: any) {
        console.error('Error testing account:', error);
        showNotification('error', error.message || 'Failed to verify email account');
      }
    } catch (error: any) {
      console.error('Error testing account:', error);
      showNotification('error', error.message || 'Failed to verify email account');
    } finally {
      setTimeout(() => {
        setTestingAccount(null);
      }, 1000);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'in-progress': return 'text-yellow-600';
      case 'not-started': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Email Accounts</h3>
        <button
          onClick={() => {
            setEditingAccount(null);
            setShowAddAccount(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {emailAccounts.map((account) => (
          <div key={account.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">{account.name}</h4>
                <p className="text-sm text-gray-600">{account.email}</p>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => {
                    setEditingAccount(account);
                    setShowAddAccount(true);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${account.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {account.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Daily Limit:</span>
                <span className="font-medium text-gray-900">{account.dailyLimit || 30}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Warmup:</span>
                <span className={`font-medium ${getStatusColor(account.warmupStatus)}`}>
                  {account.warmupStatus?.replace('-', ' ') || 'not-started'}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Reputation:</span>
                <span className="font-medium text-gray-900">{account.reputation || 100}%</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleTestAccount(account.id)}
                disabled={testingAccount === account.id}
                className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {testingAccount === account.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              {editingAccount ? 'Edit Email Account' : 'Add New Email Account'}
            </h3>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleAddOrUpdateAccount(formData);
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingAccount?.name || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Primary Outreach"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingAccount?.email || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your-email@domain.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                  <select
                    name="provider"
                    defaultValue={editingAccount?.provider || 'namecheap'}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="namecheap">Namecheap</option>
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook</option>
                    <option value="smtp">Custom SMTP</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Daily Email Limit</label>
                  <input
                    type="number"
                    name="dailyLimit"
                    defaultValue={editingAccount?.dailyLimit || 30}
                    min="1"
                    max="200"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">SMTP Settings</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Host</label>
                    <input
                      type="text"
                      name="smtpHost"
                      defaultValue={editingAccount?.smtpSettings?.host || 'mail.privateemail.com'}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="mail.privateemail.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Port</label>
                    <input
                      type="number"
                      name="smtpPort"
                      defaultValue={editingAccount?.smtpSettings?.port || 587}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="587"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <input
                      type="text"
                      name="smtpUsername"
                      defaultValue={editingAccount?.smtpSettings?.username || ''}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Usually your email address"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <input
                      type="password"
                      name="smtpPassword"
                      defaultValue={editingAccount?.smtpSettings?.password || ''}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Your email password"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="smtpSecure"
                      value="true"
                      defaultChecked={editingAccount?.smtpSettings?.secure !== false}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Use secure connection (TLS/SSL)</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAccount(false);
                    setEditingAccount(null);
                  }}
                  className="w-full sm:flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingAccount ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};