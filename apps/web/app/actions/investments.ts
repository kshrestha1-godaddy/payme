"use server";

import prisma from "@repo/db/client";
import { getServerSession } from "next-auth";
import { authOptions } from "../lib/auth";
import { InvestmentInterface } from "../types/investments";
import { revalidatePath } from "next/cache";
import { getUserIdFromSession } from "../utils/auth";
import { parseInvestmentsCSV, ParsedInvestmentData } from "../utils/csvImportInvestments";
import { ImportResult } from "../types/bulkImport";

export async function getUserInvestments(): Promise<{ data?: InvestmentInterface[], error?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return { error: "Unauthorized" };
        }

        const userId = getUserIdFromSession(session.user.id);
        
        // Validate that userId is a valid number
        if (isNaN(userId)) {
            console.error(`Invalid user ID: ${session.user.id}`);
            return { error: "Invalid user ID" };
        }
        
        // First verify user exists
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!user) {
            // If user doesn't exist, create them (for OAuth users)
            if (session.user.email && session.user.name) {
                console.info(`Creating new OAuth user for investments: ${session.user.email}`);
                const newUser = await prisma.user.create({
                    data: {
                        id: userId,
                        email: session.user.email,
                        name: session.user.name,
                        number: `oauth_${userId}`, // Temporary number for OAuth users
                        password: "oauth_user", // Placeholder password for OAuth users
                    },
                });
                
                // Return empty investments array for new user
                return { data: [] };
            } else {
                console.error(`User not found and insufficient OAuth data for investments user ID: ${userId}`);
                return { error: "User not found in database and insufficient data to create user" };
            }
        }
        
        // Get investments for the verified user
        const investments = await prisma.investment.findMany({
            where: {
                userId: userId,
            },
            include: {
                account: true,
            },
            orderBy: {
                purchaseDate: 'desc',
            },
        });
        
        // Ensure investments is an array
        if (!Array.isArray(investments)) {
            console.error("Invalid investments data received from database");
            return { error: "Invalid investments data" };
        }
        
        // Convert Decimal amounts to number to prevent serialization issues
        const transformedInvestments = investments.map(investment => {
            try {
                const quantity = parseFloat(investment.quantity.toString());
                const purchasePrice = parseFloat(investment.purchasePrice.toString());
                const currentPrice = parseFloat(investment.currentPrice.toString());
                
                // Validate converted numbers
                if (!isFinite(quantity) || isNaN(quantity)) {
                    throw new Error(`Invalid investment quantity: ${investment.quantity}`);
                }
                if (!isFinite(purchasePrice) || isNaN(purchasePrice)) {
                    throw new Error(`Invalid purchase price: ${investment.purchasePrice}`);
                }
                if (!isFinite(currentPrice) || isNaN(currentPrice)) {
                    throw new Error(`Invalid current price: ${investment.currentPrice}`);
                }
                
                // Transform nested account data if it exists
                const transformedAccount = investment.account ? {
                    ...investment.account,
                    balance: parseFloat(investment.account.balance.toString()),
                    accountOpeningDate: new Date(investment.account.accountOpeningDate),
                    createdAt: new Date(investment.account.createdAt),
                    updatedAt: new Date(investment.account.updatedAt),
                } : investment.account;
                
                return {
                    id: investment.id,
                    name: investment.name,
                    type: investment.type,
                    symbol: investment.symbol,
                    quantity,
                    purchasePrice,
                    currentPrice,
                    purchaseDate: new Date(investment.purchaseDate),
                    accountId: investment.accountId,
                    userId: investment.userId,
                    notes: investment.notes,
                    createdAt: new Date(investment.createdAt),
                    updatedAt: new Date(investment.updatedAt),
                    account: transformedAccount,
                    // Handle fixed deposit specific fields
                    interestRate: investment.interestRate ? parseFloat(investment.interestRate.toString()) : undefined,
                    maturityDate: investment.maturityDate ? new Date(investment.maturityDate) : undefined,
                };
            } catch (transformError) {
                console.error(`Data transformation failed for investment ID ${investment.id}:`, transformError);
                throw new Error(`Data transformation failed for investment ID ${investment.id}`);
            }
        }) as InvestmentInterface[];

        return { data: transformedInvestments };
    } catch (error) {
        console.error("Failed to fetch user investments:", error);
        return { error: "Failed to fetch investments" };
    }
}

export async function createInvestment(investment: Omit<InvestmentInterface, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'account'>) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            throw new Error("Unauthorized");
        }

        const userId = getUserIdFromSession(session.user.id);
        let user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!user) {
            // If user doesn't exist, create them (for OAuth users)
            if (session.user.email && session.user.name) {
                console.info(`Creating new OAuth user for investment creation: ${session.user.email}`);
                user = await prisma.user.create({
                    data: {
                        id: userId,
                        email: session.user.email,
                        name: session.user.name,
                        number: `oauth_${userId}`, // Temporary number for OAuth users
                        password: "oauth_user", // Placeholder password for OAuth users
                    },
                });
            } else {
                console.error(`User not found and insufficient OAuth data for investment creation user ID: ${userId}`);
                throw new Error("User not found in database and insufficient data to create user");
            }
        }

        // Use a transaction to ensure both investment creation and account balance are updated atomically
        const result = await prisma.$transaction(async (tx) => {
            // Validate account balance only if account is provided
            let account = null;
            if (investment.accountId) {
                account = await tx.account.findUnique({
                    where: { id: investment.accountId },
                    select: { balance: true, bankName: true }
                });

                if (!account) {
                    throw new Error("Selected account not found");
                }

                const totalInvestmentAmount = (investment.type === 'FIXED_DEPOSIT' || investment.type === 'PROVIDENT_FUNDS' || investment.type === 'SAFE_KEEPINGS') ? 
                    investment.purchasePrice : investment.quantity * investment.purchasePrice;
                const currentBalance = parseFloat(account.balance.toString());
                
                if (currentBalance < totalInvestmentAmount) {
                    throw new Error(`Insufficient balance in ${account.bankName}. Available: ${currentBalance}, Required: ${totalInvestmentAmount}`);
                }
            }

            // Create the investment
            const newInvestment = await tx.investment.create({
                data: {
                    ...investment,
                    userId: user.id,
                },
                include: {
                    account: true,
                },
            });

            // Update the account balance (decrease by investment amount) only if account is provided
            if (investment.accountId && account) {
                const totalInvestmentAmount = (investment.type === 'FIXED_DEPOSIT' || investment.type === 'PROVIDENT_FUNDS' || investment.type === 'SAFE_KEEPINGS') ? 
                    investment.purchasePrice : investment.quantity * investment.purchasePrice;
                
                await tx.account.update({
                    where: { id: investment.accountId },
                    data: {
                        balance: {
                            decrement: totalInvestmentAmount
                        }
                    }
                });
            }

            return newInvestment;
        });

        // Revalidate related pages
        revalidatePath("/(dashboard)/investments");
        revalidatePath("/(dashboard)/accounts");
        
        console.info(`Investment created successfully: ${investment.name} - $${investment.purchasePrice} for user ${userId}`);

        // Trigger notification checks
        try {
            const { generateNotificationsForUser } = await import('./notifications');
            
            // Use the comprehensive check to ensure all notification types are evaluated
            await generateNotificationsForUser(userId);
        } catch (error) {
            console.error("Failed to check notifications after investment creation:", error);
        }
        
        // Convert Decimal amounts to number to prevent serialization issues
        // Transform nested account data if it exists
        const transformedAccount = result.account ? {
            ...result.account,
            balance: parseFloat(result.account.balance.toString()),
            accountOpeningDate: new Date(result.account.accountOpeningDate),
            createdAt: new Date(result.account.createdAt),
            updatedAt: new Date(result.account.updatedAt),
        } : result.account;
        
        return {
            id: result.id,
            name: result.name,
            type: result.type,
            symbol: result.symbol,
            quantity: parseFloat(result.quantity.toString()),
            purchasePrice: parseFloat(result.purchasePrice.toString()),
            currentPrice: parseFloat(result.currentPrice.toString()),
            purchaseDate: new Date(result.purchaseDate),
            accountId: result.accountId,
            userId: result.userId,
            notes: result.notes,
            createdAt: new Date(result.createdAt),
            updatedAt: new Date(result.updatedAt),
            account: transformedAccount,
            // Handle fixed deposit specific fields
            interestRate: result.interestRate ? parseFloat(result.interestRate.toString()) : undefined,
            maturityDate: result.maturityDate ? new Date(result.maturityDate) : undefined,
        } as InvestmentInterface;
    } catch (error) {
        console.error(`Failed to create investment: ${investment.name}`, error);
        throw error;
    }
}

export async function updateInvestment(id: number, investment: Partial<Omit<InvestmentInterface, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'account'>>) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            throw new Error("Unauthorized");
        }

        const userId = getUserIdFromSession(session.user.id);

        // Use a transaction to handle investment update and account balance changes
        const result = await prisma.$transaction(async (tx) => {
            // Verify the investment belongs to the user
            const existingInvestment = await tx.investment.findFirst({
                where: {
                    id,
                    userId: userId,
                },
            });

            if (!existingInvestment) {
                throw new Error("Investment not found or unauthorized");
            }

            // Update the investment
            const updatedInvestment = await tx.investment.update({
                where: { id },
                data: investment,
                include: {
                    account: true,
                },
            });

            return updatedInvestment;
        });

        // Revalidate related pages
        revalidatePath("/(dashboard)/investments");
        revalidatePath("/(dashboard)/accounts");

        console.info(`Investment updated successfully: ${id} for user ${userId}`);
        
        // Convert Decimal amounts to number to prevent serialization issues
        // Transform nested account data if it exists
        const transformedAccount = result.account ? {
            ...result.account,
            balance: parseFloat(result.account.balance.toString()),
            accountOpeningDate: new Date(result.account.accountOpeningDate),
            createdAt: new Date(result.account.createdAt),
            updatedAt: new Date(result.account.updatedAt),
        } : result.account;
        
        return {
            id: result.id,
            name: result.name,
            type: result.type,
            symbol: result.symbol,
            quantity: parseFloat(result.quantity.toString()),
            purchasePrice: parseFloat(result.purchasePrice.toString()),
            currentPrice: parseFloat(result.currentPrice.toString()),
            purchaseDate: new Date(result.purchaseDate),
            accountId: result.accountId,
            userId: result.userId,
            notes: result.notes,
            createdAt: new Date(result.createdAt),
            updatedAt: new Date(result.updatedAt),
            account: transformedAccount,
            // Handle fixed deposit specific fields
            interestRate: result.interestRate ? parseFloat(result.interestRate.toString()) : undefined,
            maturityDate: result.maturityDate ? new Date(result.maturityDate) : undefined,
        } as InvestmentInterface;
    } catch (error) {
        console.error(`Failed to update investment ${id}:`, error);
        throw error;
    }
}

export async function deleteInvestment(id: number) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            throw new Error("Unauthorized");
        }

        const userId = getUserIdFromSession(session.user.id);

        // Use a transaction to handle investment deletion and account balance restoration
        await prisma.$transaction(async (tx) => {
            // Verify the investment belongs to the user and get its details
            const existingInvestment = await tx.investment.findFirst({
                where: {
                    id,
                    userId: userId,
                },
            });

            if (!existingInvestment) {
                throw new Error("Investment not found or unauthorized");
            }

            // Delete the investment
            await tx.investment.delete({
                where: { id },
            });

            // Restore the account balance only if investment was linked to an account
            if (existingInvestment.accountId) {
                const totalInvestmentAmount = (existingInvestment.type === 'FIXED_DEPOSIT' || existingInvestment.type === 'PROVIDENT_FUNDS' || existingInvestment.type === 'SAFE_KEEPINGS') ? 
                    parseFloat(existingInvestment.purchasePrice.toString()) : 
                    parseFloat(existingInvestment.quantity.toString()) * parseFloat(existingInvestment.purchasePrice.toString());
                
                await tx.account.update({
                    where: { id: existingInvestment.accountId },
                    data: {
                        balance: {
                            increment: totalInvestmentAmount
                        }
                    }
                });
            }
        });

        // Revalidate related pages
        revalidatePath("/(dashboard)/investments");
        revalidatePath("/(dashboard)/accounts");

        console.info(`Investment deleted successfully: ${id} for user ${userId}`);
        return { success: true };
    } catch (error) {
        console.error(`Failed to delete investment ${id}:`, error);
        throw error;
    }
}

export async function getUserAccounts(): Promise<{ data?: any[], error?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return { error: "Unauthorized" };
        }

        const userId = getUserIdFromSession(session.user.id);
        
        const accounts = await prisma.account.findMany({
            where: {
                userId: userId,
            },
            orderBy: {
                bankName: 'asc',
            },
        });

        // Convert Decimal balance to number to prevent serialization issues
        const transformedAccounts = accounts.map(account => ({
            ...account,
            balance: parseFloat(account.balance.toString()),
            accountOpeningDate: new Date(account.accountOpeningDate),
            createdAt: new Date(account.createdAt),
            updatedAt: new Date(account.updatedAt),
        }));

        return { data: transformedAccounts };
    } catch (error) {
        console.error("Failed to fetch user accounts for investments:", error);
        return { error: "Failed to fetch accounts" };
    }
}

/**
 * Bulk import investments from CSV
 */
export async function bulkImportInvestments(csvContent: string): Promise<ImportResult> {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            throw new Error("Unauthorized");
        }

        const userId = getUserIdFromSession(session.user.id);

        // Get user accounts for validation
        const accounts = await prisma.account.findMany({
            where: { userId: userId }
        });

        // Parse CSV
        const parseResult = parseInvestmentsCSV(csvContent, accounts) as ImportResult & { data?: ParsedInvestmentData[] };
        
        if (!parseResult.success || !parseResult.data) {
            return {
                success: parseResult.success,
                importedCount: 0,
                errors: parseResult.errors,
                skippedCount: parseResult.skippedCount
            };
        }

        const validInvestments = parseResult.data;
        const result: ImportResult = {
            success: false,
            importedCount: 0,
            errors: [...parseResult.errors],
            skippedCount: parseResult.skippedCount
        };

        // Process investments in batches to avoid timeout
        const BATCH_SIZE = 10;
        const batches = [];
        for (let i = 0; i < validInvestments.length; i += BATCH_SIZE) {
            batches.push(validInvestments.slice(i, i + BATCH_SIZE));
        }

        for (const batch of batches) {
            try {
                await prisma.$transaction(async (tx) => {
                    for (const investmentData of batch) {
                        try {
                            // Validate account exists
                            const account = await tx.account.findUnique({
                                where: { id: investmentData.accountId },
                                select: { id: true, bankName: true }
                            });

                            if (!account) {
                                result.errors.push({
                                    row: 0, // We don't have row tracking in batch processing
                                    error: `Account not found for investment: ${investmentData.name}`,
                                    data: investmentData
                                });
                                continue;
                            }

                            const totalInvestmentAmount = (investmentData.type === 'FIXED_DEPOSIT' || investmentData.type === 'PROVIDENT_FUNDS' || investmentData.type === 'SAFE_KEEPINGS') ? 
                                investmentData.purchasePrice : 
                                investmentData.quantity * investmentData.purchasePrice;

                            // Create the investment
                            await tx.investment.create({
                                data: {
                                    ...investmentData,
                                    userId: userId,
                                },
                            });

                            // Update account balance - no balance check for bulk import (only if account is provided)
                            if (investmentData.accountId) {
                                await tx.account.update({
                                    where: { id: investmentData.accountId },
                                    data: {
                                        balance: {
                                            decrement: totalInvestmentAmount
                                        }
                                    }
                                });
                            }

                            result.importedCount++;
                        } catch (error) {
                            result.errors.push({
                                row: 0,
                                error: `Failed to import investment ${investmentData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                data: investmentData
                            });
                        }
                    }
                }, {
                    timeout: 30000, // 30 second timeout per batch
                });
            } catch (error) {
                // If a batch fails, add errors for all items in that batch
                batch.forEach(investmentData => {
                    result.errors.push({
                        row: 0,
                        error: `Batch import failed for ${investmentData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        data: investmentData
                    });
                });
            }
        }

        result.success = result.importedCount > 0;

        revalidatePath("/(dashboard)/investments");
        revalidatePath("/(dashboard)/accounts");

        return result;

    } catch (error) {
        throw new Error(error instanceof Error ? error.message : "Failed to import investments");
    }
}

/**
 * Bulk delete investments
 */
export async function bulkDeleteInvestments(investmentIds: number[]) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            throw new Error("Unauthorized");
        }

        const userId = getUserIdFromSession(session.user.id);

        // Verify all investments belong to the user and get investment details for account balance restoration
        const existingInvestments = await prisma.investment.findMany({
            where: {
                id: { in: investmentIds },
                userId: userId,
            },
            include: {
                account: true
            }
        });

        if (existingInvestments.length !== investmentIds.length) {
            throw new Error("Some investments not found or unauthorized");
        }

        // Use a transaction to handle investment deletion and account balance restoration
        await prisma.$transaction(async (tx) => {
            // Delete the investments
            await tx.investment.deleteMany({
                where: { 
                    id: { in: investmentIds },
                    userId: userId
                }
            });

            // Restore account balances (increase by investment amounts since investments are removed)
            const accountUpdates = new Map<number, number>();
            
            existingInvestments.forEach(investment => {
                if (investment.accountId) {
                    const totalInvestmentAmount = investment.type === 'FIXED_DEPOSIT' ? 
                        parseFloat(investment.purchasePrice.toString()) : 
                        parseFloat(investment.quantity.toString()) * parseFloat(investment.purchasePrice.toString());
                    
                    const currentTotal = accountUpdates.get(investment.accountId) || 0;
                    accountUpdates.set(investment.accountId, currentTotal + totalInvestmentAmount);
                }
            });

            // Apply account balance updates
            for (const [accountId, totalAmount] of accountUpdates) {
                await tx.account.update({
                    where: { id: accountId },
                    data: {
                        balance: {
                            increment: totalAmount
                        }
                    }
                });
            }
        });

        // Revalidate related pages
        revalidatePath("/(dashboard)/investments");
        revalidatePath("/(dashboard)/accounts");
        
        console.info(`Bulk investment deletion successful: ${investmentIds.length} investments for user ${userId}`);
        return { 
            success: true, 
            deletedCount: existingInvestments.length 
        };
    } catch (error) {
        console.error(`Failed to bulk delete investments:`, error);
        throw error;
    }
} 