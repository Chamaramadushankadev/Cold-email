import React, { useState } from 'react';
import { Plus, Upload, Edit3, Trash2, Search, Filter, Tag, FolderPlus } from 'lucide-react';
import { coldEmailAPI } from '../../services/api';

interface LeadsTabProps {
  leads: any[];
  setLeads: (leads: any[]) => void;
  leadCategories: any[];
  setLeadCategories: (categories: any[]) => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const LeadsTab: React.FC<LeadsTabProps> = ({
  leads,
  setLeads,
  leadCategories,
  setLeadCategories,
  showNotification
}) => {
  const [showAddLead, setShowAddLead] = useState(false);
  const [showImportCsv, setShowImportCsv] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [csvMapping, setCsvMapping] = useState<any>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.company?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || lead.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleAddOrUpdateLead = async (formData: FormData) => {
    try {
      const leadData = {
        firstName: formData.get('firstName') as string || '',
        lastName: formData.get('lastName') as string || '',
        email: formData.get('email') as string || '',
        company: formData.get('company') as string || '',
        jobTitle: formData.get('jobTitle') as string || '',
        industry: formData.get('industry') as string || '',
        website: formData.get('website') as string || '',
        category: formData.get('category') as string || '',
        tags: (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(t => t),
        notes: formData.get('notes') as string || ''
      };

      if (editingLead) {
        const response = await coldEmailAPI.updateLead(editingLead.id, leadData);
        setLeads(leads.map(lead => lead.id === editingLead.id ? response.data : lead));
        showNotification('success', 'Lead updated successfully');
      } else {
        const response = await coldEmailAPI.createLead(leadData);
        setLeads([...leads, response.data]);
        showNotification('success', 'Lead created successfully');
      }

      setEditingLead(null);
      setShowAddLead(false);
    } catch (error: any) {
      console.error('Error saving lead:', error);
      showNotification('error', error.message || 'Failed to save lead');
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    
    try {
      await coldEmailAPI.deleteLead(leadId);
      setLeads(leads.filter(lead => lead.id !== leadId));
      showNotification('success', 'Lead deleted successfully');
    } catch (error: any) {
      console.error('Error deleting lead:', error);
      showNotification('error', 'Failed to delete lead');
    }
  };

  const handleCsvUpload = async (file: File) => {
    try {
      const response = await coldEmailAPI.previewCsv(file);
      setCsvPreview(response.data);
      setCsvMapping(response.data.suggestedMapping || {});
    } catch (error: any) {
      console.error('Error previewing CSV:', error);
      showNotification('error', 'Failed to preview CSV file');
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile || !selectedCategory) {
      showNotification('error', 'Please select a file and category');
      return;
    }

    try {
      const response = await coldEmailAPI.importCsv(csvFile, csvMapping, selectedCategory);
      showNotification('success', response.data.message);
      setShowImportCsv(false);
      setCsvFile(null);
      setCsvPreview(null);
      
      // Reload leads
      const leadsResponse = await coldEmailAPI.getLeads();
      setLeads(leadsResponse.data?.leads || []);
    } catch (error: any) {
      console.error('Error importing CSV:', error);
      showNotification('error', error.message || 'Failed to import CSV');
    }
  };

  const handleAddCategory = async (formData: FormData) => {
    try {
      const categoryName = formData.get('categoryName') as string;
      if (!categoryName.trim()) return;

      const response = await coldEmailAPI.createCategory({ name: categoryName });
      setLeadCategories([...leadCategories, response.data]);
      setShowAddCategory(false);
      showNotification('success', 'Category created successfully');
    } catch (error: any) {
      console.error('Error creating category:', error);
      showNotification('error', 'Failed to create category');
    }
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await coldEmailAPI.deleteCategory(categoryId);
      setLeadCategories(leadCategories.filter(cat => cat.id !== categoryId));
      showNotification('success', 'Category deleted successfully');
    } catch (error: any) {
      console.error('Error deleting category:', error);
      showNotification('error', 'Failed to delete category');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'replied': return 'bg-green-100 text-green-800';
      case 'interested': return 'bg-purple-100 text-purple-800';
      case 'not-interested': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {leadCategories.map(category => (
                <option key={category.id} value={category.id || category.name}>{category.name}</option>
              ))}
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="replied">Replied</option>
              <option value="interested">Interested</option>
              <option value="not-interested">Not Interested</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddCategory(true)}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
          
          <button
            onClick={() => setShowImportCsv(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </button>
          
          <button
            onClick={() => {
              setEditingLead(null);
              setShowAddLead(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Categories</h3>
        <div className="flex flex-wrap gap-2">
          {leadCategories.map((category) => (
            <div key={category.id} className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
              <span className="text-sm font-medium">{category.name}</span>
              <button
                onClick={() => handleDeleteCategory(category.id)}
                className="text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {leadCategories.length === 0 && (
            <p className="text-gray-500 text-sm">No categories created yet</p>
          )}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Leads ({filteredLeads.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {lead.firstName} {lead.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{lead.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{lead.company || '-'}</div>
                    <div className="text-sm text-gray-500">{lead.jobTitle || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                      {lead.category || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setEditingLead(lead);
                          setShowAddLead(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLead(lead.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredLeads.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No leads found</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Lead Modal */}
      {showAddLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              {editingLead ? 'Edit Lead' : 'Add New Lead'}
            </h3>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleAddOrUpdateLead(formData);
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    defaultValue={editingLead?.firstName || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    defaultValue={editingLead?.lastName || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingLead?.email || ''}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <input
                    type="text"
                    name="company"
                    defaultValue={editingLead?.company || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                  <input
                    type="text"
                    name="jobTitle"
                    defaultValue={editingLead?.jobTitle || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                  <input
                    type="text"
                    name="industry"
                    defaultValue={editingLead?.industry || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                  <input
                    type="url"
                    name="website"
                    defaultValue={editingLead?.website || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    name="category"
                    defaultValue={editingLead?.category || selectedCategory || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    {leadCategories.map(category => (
                      <option key={category.id} value={category.id || category.name}>{category.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
                  <input
                    type="text"
                    name="tags"
                    defaultValue={editingLead?.tags?.join(', ') || ''}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={editingLead?.notes || ''}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional notes about this lead..."
                />
              </div>

              <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddLead(false);
                    setEditingLead(null);
                  }}
                  className="w-full sm:flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingLead ? 'Update Lead' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Add New Category</h3>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleAddCategory(formData);
              }}
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category Name</label>
                <input
                  type="text"
                  name="categoryName"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., SaaS Companies"
                  required
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportCsv && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Import Leads from CSV</h3>
            
            {!csvPreview ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select CSV File (Required)</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setCsvFile(file);
                        handleCsvUpload(file);
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Category (Required)</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select category</option>
                    {leadCategories.length > 0 && leadCategories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Map CSV Columns</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(csvMapping).map(([field, column]) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                          {field.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                        <select
                          value={column as string}
                          onChange={(e) => setCsvMapping({...csvMapping, [field]: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select column</option>
                          {csvPreview.headers?.map((header: string) => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Preview (First 5 rows)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          {csvPreview.headers?.map((header: string) => (
                            <th key={header} className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.preview?.map((row: any, index: number) => (
                          <tr key={index} className="border-t border-gray-200">
                            {csvPreview.headers?.map((header: string) => (
                              <td key={header} className="px-4 py-2 text-sm text-gray-900">
                                {row[header]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowImportCsv(false);
                  setCsvFile(null);
                  setCsvPreview(null);
                  setSelectedCategory('');
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {csvPreview && (
                <button
                  onClick={handleCsvImport}
                  disabled={!selectedCategory}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import Leads
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};