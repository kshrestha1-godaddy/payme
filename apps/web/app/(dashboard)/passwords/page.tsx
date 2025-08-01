"use client";

import React, { useState, useEffect } from "react";
import { PasswordInterface } from "../../types/passwords";
import { getPasswords, createPassword, updatePassword, deletePassword } from "../../actions/passwords";
import { PasswordTable } from "../../components/passwords/PasswordTable";
import { AddPasswordModal } from "../../components/passwords/AddPasswordModal";
import { Button } from "@repo/ui/button";
import { DeleteConfirmationModal } from "../../components/DeleteConfirmationModal";
import { exportPasswordsToCSV } from "../../utils/csvExportPasswords";
import { BulkImportModal } from "../../components/passwords/BulkImportModal";

export default function PasswordsPage() {
    const [passwords, setPasswords] = useState<PasswordInterface[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingPassword, setEditingPassword] = useState<PasswordInterface | null>(null);
    const [deletingPassword, setDeletingPassword] = useState<PasswordInterface | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Load passwords on component mount
    useEffect(() => {
        loadPasswords();
    }, []);

    const loadPasswords = async () => {
        try {
            setLoading(true);
            const data = await getPasswords();
            setPasswords(data);
        } catch (error) {
            console.error("Error loading passwords:", error);
        } finally {
            setLoading(false);
        }
    };

    // Group passwords by category
    const groupedPasswords = React.useMemo(() => {
        const groups: { [key: string]: PasswordInterface[] } = {};
        
        passwords.forEach(password => {
            const category = password.category || 'Uncategorized';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(password);
        });
        
        // Sort categories alphabetically, but put 'Uncategorized' at the end
        const sortedCategories = Object.keys(groups).sort((a, b) => {
            if (a === 'Uncategorized') return 1;
            if (b === 'Uncategorized') return -1;
            return a.localeCompare(b);
        });
        
        return sortedCategories.map(category => ({
            category,
            passwords: groups[category]
        }));
    }, [passwords]);

    const handleAddPassword = async (data: any) => {
        try {
            const newPassword = await createPassword(data);
            setPasswords(prev => [newPassword, ...prev]);
        } catch (error) {
            console.error("Error adding password:", error);
            throw error;
        }
    };

    const handleEditPassword = (password: PasswordInterface) => {
        setEditingPassword(password);
        setShowAddModal(true);
    };

    const handleUpdatePassword = async (data: any) => {
        try {
            if (!editingPassword) return;
            
            const updatedPassword = await updatePassword({
                id: editingPassword.id,
                ...data
            });
            
            setPasswords(prev => prev.map(p => p.id === updatedPassword.id ? updatedPassword : p));
            setEditingPassword(null);
        } catch (error) {
            console.error("Error updating password:", error);
            throw error;
        }
    };

    const handleDeletePassword = (password: PasswordInterface) => {
        setDeletingPassword(password);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deletingPassword) return;
        
        try {
            await deletePassword(deletingPassword.id);
            setPasswords(prev => prev.filter(p => p.id !== deletingPassword.id));
            setDeletingPassword(null);
            setShowDeleteModal(false);
        } catch (error) {
            console.error("Error deleting password:", error);
        }
    };

    // Handle CSV export
    const handleExportToCSV = () => {
        if (passwords.length === 0) {
            alert("No passwords to export");
            return;
        }
        
        exportPasswordsToCSV(passwords);
    };

    // Handle bulk import success
    const handleBulkImportSuccess = () => {
        loadPasswords();
        setShowImportModal(false);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">Passwords</h1>
                </div>
                <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">Loading passwords...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Passwords</h1>
                    <p className="text-gray-600 mt-1">Securely manage your website passwords</p>
                </div>
                <div className="flex items-center">
                    <button
                        onClick={() => {
                            setEditingPassword(null);
                            setShowAddModal(true);
                        }}
                        className="h-10 px-4 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-md"
                    >
                        Add Password
                    </button>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="h-10 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md mr-2"
                    >
                        Import CSV
                    </button>
                    <button
                        onClick={handleExportToCSV}
                        className="h-10 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md mr-2"
                        disabled={passwords.length === 0}
                    >
                        Export CSV
                    </button>

                </div>
            </div>

            {/* Password Count */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                        {passwords.length} password{passwords.length !== 1 ? 's' : ''} stored
                    </span>
                </div>
            </div>

            {/* Passwords Table View */}
            {passwords.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No passwords found</h3>
                    <p className="text-gray-600 mb-6">
                        Start by adding your first password
                    </p>
                    <div className="flex justify-center space-x-4">
                        <Button onClick={() => { 
                            setEditingPassword(null); 
                            setShowAddModal(true); 
                        }}>
                            Add Your First Password
                        </Button>
                        <button 
                            onClick={() => setShowImportModal(true)}
                            className="text-gray-800 bg-white border border-gray-300 hover:bg-gray-100 font-medium rounded-lg text-sm px-5 py-2.5"
                        >
                            Import from CSV
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {groupedPasswords.map(({ category, passwords: categoryPasswords }) => {
                        if (!categoryPasswords || categoryPasswords.length === 0) return null;
                        
                        return (
                            <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
                                {/* Category Header */}
                                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center space-x-3">
                                            <div className="flex items-center justify-center w-8 h-8 bg-brand-100 rounded-full">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-900 capitalize">
                                                {category.replace(/_/g, ' ')}
                                            </h3>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800">
                                                {categoryPasswords.length} password{categoryPasswords.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Category Table */}
                                <PasswordTable
                                    passwords={categoryPasswords}
                                    onEdit={handleEditPassword}
                                    onDelete={handleDeletePassword}
                                    hideHeader={true}
                                    hideCategoryColumn={true}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Password Modal */}
            <AddPasswordModal
                key={editingPassword ? `edit-${editingPassword.id}` : 'add-new'}
                isOpen={showAddModal}
                onClose={() => {
                    setShowAddModal(false);
                    setEditingPassword(null);
                }}
                onSubmit={editingPassword ? handleUpdatePassword : handleAddPassword}
                initialData={editingPassword ? {
                    websiteName: editingPassword.websiteName,
                    description: editingPassword.description,
                    username: editingPassword.username,
                    password: "", // Don't pass the encrypted password
                    secretKey: "", // Don't pass the secret key
                    transactionPin: "", // Don't pass the encrypted PIN
                    validity: editingPassword.validity ? editingPassword.validity : undefined,
                    notes: editingPassword.notes || "",
                    category: editingPassword.category || "",
                    tags: editingPassword.tags || []
                } : undefined}
            />

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                title="Delete Password"
                message={`Are you sure you want to delete the password for "${deletingPassword?.websiteName}"? This action cannot be undone.`}
            />

            {/* Bulk Import Modal */}
            <BulkImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onSuccess={handleBulkImportSuccess}
            />
        </div>
    );
} 