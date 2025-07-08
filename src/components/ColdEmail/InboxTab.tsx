import React, { useState, useEffect } from 'react';
import { Mail, Star, Search, Filter, Inbox, Clock, Tag, Trash2, Reply } from 'lucide-react';
import { coldEmailAPI } from '../../services/api';

interface InboxTabProps {
  emailAccounts: any[];
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const InboxTab: React.FC<InboxTabProps> = ({
  emailAccounts,
  showNotification
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterRead, setFilterRead] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadInbox();
  }, [filterAccount, filterRead]);

  const loadInbox = async () => {
    try {
      setLoading(true);
      
      const params: any = {};
      if (filterAccount !== 'all') params.accountId = filterAccount;
      if (filterRead !== 'all') params.isRead = filterRead === 'unread' ? false : true;
      if (searchTerm) params.search = searchTerm;
      
      const response = await coldEmailAPI.getInboxMessages(params);
      setMessages(response.data.messages || []);
    } catch (error: any) {
      console.error('Error loading inbox:', error);
      showNotification('error', 'Failed to load inbox messages');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (messageId: string, isRead: boolean = true) => {
    try {
      const response = await coldEmailAPI.markAsRead(messageId, isRead);
      setMessages(messages.map(msg => msg.id === messageId ? { ...msg, isRead } : msg));
      
      if (selectedMessage?.id === messageId) {
        setSelectedMessage({ ...selectedMessage, isRead });
      }
    } catch (error: any) {
      console.error('Error marking message:', error);
      showNotification('error', 'Failed to update message');
    }
  };

  const handleToggleStar = async (messageId: string) => {
    try {
      const message = messages.find(msg => msg.id === messageId);
      const isStarred = !message?.isStarred;
      
      const response = await coldEmailAPI.toggleStar(messageId, isStarred);
      setMessages(messages.map(msg => msg.id === messageId ? { ...msg, isStarred } : msg));
      
      if (selectedMessage?.id === messageId) {
        setSelectedMessage({ ...selectedMessage, isStarred });
      }
    } catch (error: any) {
      console.error('Error starring message:', error);
      showNotification('error', 'Failed to update message');
    }
  };

  const filteredMessages = messages.filter(message => {
    const matchesSearch = message.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.from?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.content?.text?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading && messages.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search inbox..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Accounts</option>
              {emailAccounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
            
            <select
              value={filterRead}
              onChange={(e) => setFilterRead(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Messages</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
        </div>
        
        <button
          onClick={loadInbox}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Inbox className="w-4 h-4" />
          <span>Refresh Inbox</span>
        </button>
      </div>

      {/* Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium text-gray-900">Inbox</h3>
            </div>
            
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {filteredMessages.length > 0 ? (
                filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !message.isRead ? 'bg-blue-50' : ''
                    } ${selectedMessage?.id === message.id ? 'border-l-4 border-blue-500' : ''}`}
                    onClick={() => {
                      setSelectedMessage(message);
                      if (!message.isRead) {
                        handleMarkAsRead(message.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(message.id);
                          }}
                          className={`text-gray-400 hover:text-yellow-500 transition-colors ${
                            message.isStarred ? 'text-yellow-500' : ''
                          }`}
                        >
                          <Star className="w-4 h-4" />
                        </button>
                        <div className={`w-2 h-2 rounded-full ${message.isRead ? 'bg-transparent' : 'bg-blue-500'}`} />
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(message.receivedAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div>
                      <p className={`text-sm ${message.isRead ? 'text-gray-600' : 'font-medium text-gray-900'}`}>
                        {message.from.name || message.from.email}
                      </p>
                      <p className={`text-sm ${message.isRead ? 'text-gray-600' : 'font-medium text-gray-900'} truncate`}>
                        {message.subject}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {message.content.text?.substring(0, 100) || message.content.html?.substring(0, 100) || ''}...
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Mail className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No messages found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2">
          {selectedMessage ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{selectedMessage.subject}</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleStar(selectedMessage.id)}
                    className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${
                      selectedMessage.isStarred ? 'text-yellow-500' : 'text-gray-400'
                    }`}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMarkAsRead(selectedMessage.id, !selectedMessage.isRead)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400"
                  >
                    <Reply className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex items-start space-x-4 mb-6">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-600 font-medium">
                      {selectedMessage.from.name?.[0] || selectedMessage.from.email?.[0] || '?'}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900">
                        {selectedMessage.from.name || selectedMessage.from.email}
                      </p>
                      {selectedMessage.campaignId && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          Campaign
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{selectedMessage.from.email}</p>
                    <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(selectedMessage.receivedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="prose max-w-none">
                  {selectedMessage.content.html ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedMessage.content.html }} />
                  ) : (
                    <div className="whitespace-pre-line">{selectedMessage.content.text}</div>
                  )}
                </div>
                
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-3">Attachments</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedMessage.attachments.map((attachment: any) => (
                        <div key={attachment.contentId} className="p-2 border border-gray-200 rounded-lg flex items-center space-x-2">
                          <span className="text-sm text-gray-900">{attachment.filename}</span>
                          <span className="text-xs text-gray-500">
                            ({Math.round(attachment.size / 1024)} KB)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center min-h-[400px]">
              <div className="text-center p-6">
                <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Message Selected</h3>
                <p className="text-gray-600">Select a message from the inbox to view its contents</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};