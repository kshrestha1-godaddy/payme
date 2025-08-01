export interface InvestmentInterface {
    id: number;
    name: string;
    type: 'STOCKS' | 'CRYPTO' | 'MUTUAL_FUNDS' | 'BONDS' | 'REAL_ESTATE' | 'GOLD' | 'FIXED_DEPOSIT' | 'PROVIDENT_FUNDS' | 'SAFE_KEEPINGS' | 'OTHER';
    symbol?: string;
    quantity: number;
    purchasePrice: number;
    currentPrice: number;
    purchaseDate: Date;
    accountId?: number;
    userId: number;
    notes?: string;
    // Fixed Deposit specific fields
    interestRate?: number; // Annual interest rate as percentage
    maturityDate?: Date; // When the FD matures
    createdAt: Date;
    updatedAt: Date;
    // Account information (populated when included)
    account?: {
        id: number;
        holderName: string;
        bankName: string;
        accountNumber: string;
        balance: number;
        accountOpeningDate: Date;
        createdAt: Date;
        updatedAt: Date;
        [key: string]: any; // For other account properties
    };
}

export interface InvestmentTransaction {
    id: number;
    investmentId: number;
    type: 'BUY' | 'SELL' | 'DIVIDEND';
    quantity: number;
    price: number;
    transactionDate: Date;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface InvestmentTarget {
    id: number;
    userId: number;
    investmentType: 'STOCKS' | 'CRYPTO' | 'MUTUAL_FUNDS' | 'BONDS' | 'REAL_ESTATE' | 'GOLD' | 'FIXED_DEPOSIT' | 'PROVIDENT_FUNDS' | 'SAFE_KEEPINGS' | 'OTHER';
    targetAmount: number;
    createdAt: Date;
    updatedAt: Date;
}

export type InvestmentTargetFormData = {
    investmentType: 'STOCKS' | 'CRYPTO' | 'MUTUAL_FUNDS' | 'BONDS' | 'REAL_ESTATE' | 'GOLD' | 'FIXED_DEPOSIT' | 'PROVIDENT_FUNDS' | 'SAFE_KEEPINGS' | 'OTHER';
    targetAmount: number;
};

export interface InvestmentTargetProgress {
    investmentType: string;
    targetAmount: number;
    currentAmount: number;
    progress: number; // percentage
    isComplete: boolean;
} 