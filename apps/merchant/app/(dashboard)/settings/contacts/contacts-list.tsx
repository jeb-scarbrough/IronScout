'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Check, 
  Loader2,
  Mail,
  Phone,
  Crown,
  ArrowRight
} from 'lucide-react';
import { 
  createContact, 
  updateContact, 
  deleteContact,
  transferOwnership,
  ContactData 
} from './actions';

// =============================================================================
// Phone Utilities
// =============================================================================

/**
 * Format phone number to standard US format: (XXX) XXX-XXXX
 */
function formatPhoneNumber(value: string): string {
  // Remove all non-numeric characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const limited = digits.slice(0, 10);
  
  // Format based on length
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/**
 * Get raw digits from formatted phone number
 */
function getPhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Validate phone number has exactly 10 digits
 */
function isValidPhone(value: string): boolean {
  const digits = getPhoneDigits(value);
  return digits.length === 0 || digits.length === 10;
}

// =============================================================================
// Types
// =============================================================================

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roles: string[];
  marketingOptIn: boolean;
  communicationOptIn: boolean;
  isAccountOwner: boolean;
  isActive: boolean;
}

interface ContactsListProps {
  contacts: Contact[];
  canManage: boolean;
}

type RoleType = 'PRIMARY' | 'BILLING' | 'TECHNICAL' | 'MARKETING';

const roleOptions: { value: RoleType; label: string }[] = [
  { value: 'PRIMARY', label: 'General' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'MARKETING', label: 'Marketing' },
];

const roleLabels: Record<string, string> = {
  PRIMARY: 'General',
  BILLING: 'Billing',
  TECHNICAL: 'Technical',
  MARKETING: 'Marketing',
};

// =============================================================================
// Component
// =============================================================================

export function ContactsList({ contacts, canManage }: ContactsListProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedContactForTransfer, setSelectedContactForTransfer] = useState<Contact | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    roles: [],
    marketingOptIn: false,
    communicationOptIn: true,
  });

  const currentOwner = contacts.find(c => c.isAccountOwner);

  const openCreateModal = () => {
    setEditingContact(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      roles: [],
      marketingOptIn: false,
      communicationOptIn: true,
    });
    setError(null);
    setPhoneError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone ? formatPhoneNumber(contact.phone) : '',
      roles: contact.roles as RoleType[],
      marketingOptIn: contact.marketingOptIn,
      communicationOptIn: contact.communicationOptIn,
    });
    setError(null);
    setPhoneError(null);
    setIsModalOpen(true);
  };

  const openTransferModal = (contact: Contact) => {
    setSelectedContactForTransfer(contact);
    setError(null);
    setSuccessMessage(null);
    setIsTransferModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingContact(null);
    setError(null);
    setPhoneError(null);
  };

  const closeTransferModal = () => {
    setIsTransferModalOpen(false);
    setSelectedContactForTransfer(null);
    setError(null);
    setSuccessMessage(null);
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setFormData({ ...formData, phone: formatted });
    
    const digits = getPhoneDigits(formatted);
    if (digits.length > 0 && digits.length < 10) {
      setPhoneError('Phone number must be 10 digits');
    } else {
      setPhoneError(null);
    }
  };

  const toggleRole = (role: RoleType) => {
    const currentRoles = formData.roles || [];
    if (currentRoles.includes(role)) {
      setFormData({ ...formData, roles: currentRoles.filter(r => r !== role) });
    } else {
      setFormData({ ...formData, roles: [...currentRoles, role] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone before submit
    if (formData.phone && !isValidPhone(formData.phone)) {
      setPhoneError('Phone number must be 10 digits');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Clean phone number to just digits for storage
      const cleanedData = {
        ...formData,
        phone: formData.phone ? getPhoneDigits(formData.phone) : undefined,
      };

      let result;
      if (editingContact) {
        result = await updateContact(editingContact.id, cleanedData);
      } else {
        result = await createContact(cleanedData);
      }

      if (result.success) {
        closeModal();
        router.refresh();
      } else {
        setError(result.error || 'Failed to save contact');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedContactForTransfer) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await transferOwnership(selectedContactForTransfer.id);
      if (result.success) {
        setSuccessMessage(result.message || 'Account ownership transferred successfully');
        setTimeout(() => {
          closeTransferModal();
          router.refresh();
        }, 1500);
      } else {
        setError(result.error || 'Failed to transfer ownership');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Delete contact ${contact.firstName} ${contact.lastName}? This cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await deleteContact(contact.id);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || 'Failed to delete contact');
      }
    } catch {
      alert('Failed to delete contact');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Your Contacts</h2>
          {canManage && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Contact
            </button>
          )}
        </div>

        {contacts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No contacts yet. Add a contact to receive communications.
          </p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`border rounded-lg p-4 ${contact.isAccountOwner ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">
                        {contact.firstName} {contact.lastName}
                      </span>
                      {contact.isAccountOwner && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          <Crown className="h-3 w-3" />
                          Account Owner
                        </span>
                      )}
                      {contact.roles.map((role) => (
                        <span 
                          key={role}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          {roleLabels[role] || role}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                          {contact.email}
                        </a>
                      </div>
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4 text-gray-400" />
                          {formatPhoneNumber(contact.phone)}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className={contact.communicationOptIn ? 'text-green-600' : 'text-gray-400'}>
                        {contact.communicationOptIn ? '✓' : '✗'} Communications
                      </span>
                      <span className={contact.marketingOptIn ? 'text-green-600' : 'text-gray-400'}>
                        {contact.marketingOptIn ? '✓' : '✗'} Marketing
                      </span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      {contact.isAccountOwner && contacts.length > 1 && (
                        <button
                          onClick={() => openTransferModal(contact)}
                          className="px-2.5 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded"
                          title="Transfer ownership to another contact"
                        >
                          Transfer
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(contact)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                        title="Edit contact"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {!contact.isAccountOwner && (
                        <button
                          onClick={() => handleDelete(contact)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          title="Delete contact"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={closeModal}
          />
          
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  {editingContact ? 'Edit Contact' : 'Add Contact'}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(555) 555-5555"
                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm border px-3 py-2 ${
                      phoneError 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                  />
                  {phoneError && (
                    <p className="mt-1 text-sm text-red-600">{phoneError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Roles <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {roleOptions.map((option) => {
                      const isSelected = (formData.roles || []).includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleRole(option.value)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 inline mr-1" />}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Email Preferences
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.communicationOptIn}
                        onChange={(e) => setFormData({ ...formData, communicationOptIn: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        Operational communications (feed alerts, account updates)
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.marketingOptIn}
                        onChange={(e) => setFormData({ ...formData, marketingOptIn: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        Marketing & promotional emails
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !!phoneError}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        {editingContact ? 'Save Changes' : 'Add Contact'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {isTransferModalOpen && selectedContactForTransfer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={closeTransferModal}
          />
          
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Transfer Account Ownership
                </h2>
                <button onClick={closeTransferModal} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
                  {successMessage}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  Select a contact to transfer account ownership to:
                </p>
                
                <div className="space-y-2">
                  {contacts.filter(c => !c.isAccountOwner).map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => setSelectedContactForTransfer(contact)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                        selectedContactForTransfer?.id === contact.id
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-gray-900">{contact.firstName} {contact.lastName}</p>
                        <p className="text-xs text-gray-500">{contact.email}</p>
                      </div>
                      {selectedContactForTransfer?.id === contact.id && (
                        <Check className="h-5 w-5 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                  <p>
                    <strong>Note:</strong> Account ownership determines who can manage contacts and team members. 
                    The new owner will have full control of your merchant account.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeTransferModal}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTransferOwnership}
                  disabled={isLoading || !selectedContactForTransfer}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Transferring...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Transfer Ownership
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
