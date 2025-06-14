"use server";

import prisma from "@repo/db/client";
import { getServerSession } from "next-auth";
import { authOptions } from "../lib/auth";
import { AccountInterface } from "../types/accounts";

// Helper function to get user ID from session
function getUserIdFromSession(sessionUserId: string): number {
    // If it's a very large number (OAuth provider), take last 10 digits
    if (sessionUserId.length > 5) {
        return parseInt(sessionUserId.slice(-5));
    }
    // Otherwise parse normally
    return parseInt(sessionUserId);
}


export async function getAllAccounts(): Promise<AccountInterface[]> {
    const accounts = await prisma.account.findMany();
    
    // Convert Decimal balance to number to prevent serialization issues
    return accounts.map(account => ({
        ...account,
        balance: account.balance ? parseFloat(account.balance.toString()) : undefined,
        accountOpeningDate: new Date(account.accountOpeningDate),
        createdAt: new Date(account.createdAt),
        updatedAt: new Date(account.updatedAt),
        // Convert null values to undefined for compatibility with AccountInterface
        appUsername: account.appUsername || undefined,
        appPassword: account.appPassword || undefined,
        appPin: account.appPin || undefined,
        notes: account.notes || undefined,
        nickname: account.nickname || undefined,
    }));
}


export async function getUserAccounts() {
    
    const session = await getServerSession(authOptions);
    if (!session) {
        return { error: "Unauthorized" };
    }

    const userId = getUserIdFromSession(session.user.id);
    // console.log("Original session ID:", session.user.id);
    // console.log("Converted userId:", userId);
    
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    // console.log("Found user:", user);

    if (!user) {
        // If user doesn't exist, create them (for OAuth users)
        if (session.user.email && session.user.name) {
            console.log("Creating new user for OAuth login");
            const newUser = await prisma.user.create({
                data: {
                    id: userId,
                    email: session.user.email,
                    name: session.user.name,
                    number: `oauth_${userId}`, // Temporary number for OAuth users
                    password: "oauth_user", // Placeholder password for OAuth users
                },
            });
            console.log("Created new user:", newUser);
            
            // Return empty accounts array for new user
            return [];
        } else {
            return { error: "User not found in database and insufficient data to create user" };
        }
    }

    const accounts = await prisma.account.findMany({
        where: {
            userId: user.id,
        },
    });
    
    // Convert Decimal balance to number to prevent serialization issues
    return accounts.map(account => ({
        ...account,
        balance: account.balance ? parseFloat(account.balance.toString()) : undefined,
        accountOpeningDate: new Date(account.accountOpeningDate),
        createdAt: new Date(account.createdAt),
        updatedAt: new Date(account.updatedAt),
        // Convert null values to undefined for compatibility with AccountInterface
        appUsername: account.appUsername || undefined,
        appPassword: account.appPassword || undefined,
        appPin: account.appPin || undefined,
        notes: account.notes || undefined,
        nickname: account.nickname || undefined,
    })) as AccountInterface[];
}



export async function createAccount(account: Omit<AccountInterface, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    const session = await getServerSession(authOptions);
    if (!session) {
        throw new Error("Unauthorized");
    }

    const userId = getUserIdFromSession(session.user.id);
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (!user) {
        throw new Error("User not found");
    }

    // Check for account number uniqueness
    if (account.accountNumber) {
        const existingAccount = await prisma.account.findUnique({
            where: {
                accountNumber: account.accountNumber,
            },
        });

        if (existingAccount) {
            throw new Error(`Account number ${account.accountNumber} is already in use. Please use a different account number.`);
        }
    }

    try {
        const newAccount = await prisma.account.create({
            data: {
                ...account,
                userId: user.id,
                balance: account.balance || 0,
            },
        });
        
        // Convert Decimal balance to number to prevent serialization issues
        return {
            ...newAccount,
            balance: newAccount.balance ? parseFloat(newAccount.balance.toString()) : undefined,
            accountOpeningDate: new Date(newAccount.accountOpeningDate),
            createdAt: new Date(newAccount.createdAt),
            updatedAt: new Date(newAccount.updatedAt),
            // Convert null values to undefined for compatibility with AccountInterface
            appUsername: newAccount.appUsername || undefined,
            appPassword: newAccount.appPassword || undefined,
            appPin: newAccount.appPin || undefined,
            notes: newAccount.notes || undefined,
            nickname: newAccount.nickname || undefined,
        } as AccountInterface;
    } catch (error: any) {
        // Handle Prisma unique constraint errors
        if (error.code === 'P2002' && error.meta?.target?.includes('accountNumber')) {
            throw new Error(`Account number ${account.accountNumber} is already in use. Please use a different account number.`);
        }
        // Re-throw other errors
        throw error;
    }
}

export async function updateAccount(id: number, account: Partial<Omit<AccountInterface, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
    const session = await getServerSession(authOptions);
    if (!session) {
        throw new Error("Unauthorized");
    }

    const userId = getUserIdFromSession(session.user.id);

    // Verify the account belongs to the user
    const existingAccount = await prisma.account.findFirst({
        where: {
            id,
            userId: userId,
        },
    });

    if (!existingAccount) {
        throw new Error("Account not found or unauthorized");
    }

    // Check for account number uniqueness if it's being updated
    if (account.accountNumber && account.accountNumber !== existingAccount.accountNumber) {
        const duplicateAccount = await prisma.account.findUnique({
            where: {
                accountNumber: account.accountNumber,
            },
        });

        if (duplicateAccount && duplicateAccount.id !== id) {
            throw new Error(`Account number ${account.accountNumber} is already in use. Please use a different account number.`);
        }
    }

    try {
        const updatedAccount = await prisma.account.update({
            where: { id },
            data: account,
        });
        
        // Convert Decimal balance to number to prevent serialization issues
        return {
            ...updatedAccount,
            balance: updatedAccount.balance ? parseFloat(updatedAccount.balance.toString()) : undefined,
            accountOpeningDate: new Date(updatedAccount.accountOpeningDate),
            createdAt: new Date(updatedAccount.createdAt),
            updatedAt: new Date(updatedAccount.updatedAt),
            // Convert null values to undefined for compatibility with AccountInterface
            appUsername: updatedAccount.appUsername || undefined,
            appPassword: updatedAccount.appPassword || undefined,
            appPin: updatedAccount.appPin || undefined,
            notes: updatedAccount.notes || undefined,
            nickname: updatedAccount.nickname || undefined,
        } as AccountInterface;
    } catch (error: any) {
        // Handle Prisma unique constraint errors
        if (error.code === 'P2002' && error.meta?.target?.includes('accountNumber')) {
            throw new Error(`Account number ${account.accountNumber} is already in use. Please use a different account number.`);
        }
        // Re-throw other errors
        throw error;
    }
}

export async function deleteAccount(id: number) {
    const session = await getServerSession(authOptions);
    if (!session) {
        throw new Error("Unauthorized");
    }

    const userId = getUserIdFromSession(session.user.id);

    // Verify the account belongs to the user
    const existingAccount = await prisma.account.findFirst({
        where: {
            id,
            userId: userId,
        },
    });

    if (!existingAccount) {
        throw new Error("Account not found or unauthorized");
    }

    await prisma.account.delete({
        where: { id },
    });
    
    return { success: true };
}

export async function bulkDeleteAccounts(accountIds: number[]) {
    const session = await getServerSession(authOptions);
    if (!session) {
        throw new Error("Unauthorized");
    }

    const userId = getUserIdFromSession(session.user.id);

    // Verify all accounts belong to the user
    const existingAccounts = await prisma.account.findMany({
        where: {
            id: { in: accountIds },
            userId: userId,
        },
    });

    if (existingAccounts.length !== accountIds.length) {
        throw new Error("Some accounts not found or unauthorized");
    }

    // Check if any of these accounts are referenced by transactions
    const [expenseCount, incomeCount, investmentCount] = await Promise.all([
        prisma.expense.count({
            where: { accountId: { in: accountIds } }
        }),
        prisma.income.count({
            where: { accountId: { in: accountIds } }
        }),
        prisma.investment.count({
            where: { accountId: { in: accountIds } }
        })
    ]);

    if (expenseCount > 0 || incomeCount > 0 || investmentCount > 0) {
        throw new Error("Cannot delete accounts that are referenced by transactions. Please delete associated transactions first.");
    }

    // Delete the accounts
    await prisma.account.deleteMany({
        where: { 
            id: { in: accountIds },
            userId: userId
        }
    });
    
    return { 
        success: true, 
        deletedCount: existingAccounts.length 
    };
}

