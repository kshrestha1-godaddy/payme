"use client";

import { useState } from "react";
import { InvestmentInterface } from "../../types/investments";
import { formatCurrency } from "../../utils/currency";
import { useCurrency } from "../../providers/CurrencyProvider";

interface InvestmentTableProps {
    investments: InvestmentInterface[];
    onEdit: (investment: InvestmentInterface) => void;
    onDelete: (investment: InvestmentInterface) => void;
    onViewDetails: (investment: InvestmentInterface) => void;
}

type SortField = 'name' | 'type' | 'quantity' | 'purchasePrice' | 'currentPrice' | 'totalValue' | 'gain' | 'purchaseDate';
type SortOrder = 'asc' | 'desc';

export function InvestmentTable({ investments, onEdit, onDelete, onViewDetails }: InvestmentTableProps) {
    const [sortField, setSortField] = useState<SortField>('purchaseDate');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const { currency: userCurrency } = useCurrency();

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const sortedInvestments = [...investments].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
            case 'name':
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                break;
            case 'type':
                aValue = a.type;
                bValue = b.type;
                break;
            case 'quantity':
                aValue = a.quantity;
                bValue = b.quantity;
                break;
            case 'purchasePrice':
                aValue = a.purchasePrice;
                bValue = b.purchasePrice;
                break;
            case 'currentPrice':
                aValue = a.currentPrice;
                bValue = b.currentPrice;
                break;
            case 'totalValue':
                aValue = a.quantity * a.currentPrice;
                bValue = b.quantity * b.currentPrice;
                break;
            case 'gain':
                aValue = (a.currentPrice - a.purchasePrice) * a.quantity;
                bValue = (b.currentPrice - b.purchasePrice) * b.quantity;
                break;
            case 'purchaseDate':
                aValue = new Date(a.purchaseDate).getTime();
                bValue = new Date(b.purchaseDate).getTime();
                break;
            default:
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
        }

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) return '⇅';
        return sortOrder === 'asc' ? '↑' : '↓';
    };

    const getGainColor = (gain: number) => {
        if (gain > 0) return 'text-green-600';
        if (gain < 0) return 'text-red-600';
        return 'text-gray-600';
    };

    const getGainPercentage = (investment: InvestmentInterface) => {
        const gain = (investment.currentPrice - investment.purchasePrice) / investment.purchasePrice * 100;
        return gain.toFixed(2);
    };

    const formatType = (type: string) => {
        return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('name')}
                            >
                                Investment {getSortIcon('name')}
                            </th>
                            <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('type')}
                            >
                                Type {getSortIcon('type')}
                            </th>
                            <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('quantity')}
                            >
                                Quantity/Interest {getSortIcon('quantity')}
                            </th>
                            <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('purchasePrice')}
                            >
                                Purchase/Principal {getSortIcon('purchasePrice')}
                            </th>
                            <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('currentPrice')}
                            >
                                Current Value {getSortIcon('currentPrice')}
                            </th>
                            <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('totalValue')}
                            >
                                Total Value {getSortIcon('totalValue')}
                            </th>
                            <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('gain')}
                            >
                                Gain/Loss {getSortIcon('gain')}
                            </th>
                            <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('purchaseDate')}
                            >
                                Purchase Date {getSortIcon('purchaseDate')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedInvestments.map((investment) => {
                            const totalValue = investment.quantity * investment.currentPrice;
                            const totalCost = investment.quantity * investment.purchasePrice;
                            const gain = totalValue - totalCost;
                            const gainPercentage = getGainPercentage(investment);

                            return (
                                <tr key={investment.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                {investment.name}
                                            </div>
                                            {investment.symbol && (
                                                <div className="text-sm text-gray-500">
                                                    {investment.symbol}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {formatType(investment.type)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {investment.type === 'FIXED_DEPOSIT' ? (
                                            <div>
                                                <div>{investment.interestRate}% p.a.</div>
                                                {investment.maturityDate && (
                                                    <div className="text-xs text-gray-500">
                                                        Matures: {new Date(investment.maturityDate).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            investment.quantity
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {investment.type === 'FIXED_DEPOSIT' ? 
                                            `${formatCurrency(investment.purchasePrice, userCurrency)} (Principal)` : 
                                            formatCurrency(investment.purchasePrice, userCurrency)
                                        }
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {investment.type === 'FIXED_DEPOSIT' ? (
                                            <div>
                                                <div>{formatCurrency(investment.currentPrice, userCurrency)}</div>
                                                <div className="text-xs text-gray-500">Current Value</div>
                                            </div>
                                        ) : (
                                            formatCurrency(investment.currentPrice, userCurrency)
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {formatCurrency(totalValue, userCurrency)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <div className={`font-medium ${getGainColor(gain)}`}>
                                            {formatCurrency(gain, userCurrency)}
                                        </div>
                                        <div className={`text-xs ${getGainColor(gain)}`}>
                                            ({gainPercentage}%)
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <div>
                                            <div>{new Date(investment.purchaseDate).toLocaleDateString()}</div>
                                            {investment.type === 'FIXED_DEPOSIT' && (
                                                <div className="text-xs text-gray-500">Deposit Date</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end space-x-2">
                                            <button 
                                                onClick={() => onViewDetails(investment)}
                                                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800 transition-colors"
                                            >
                                                View
                                            </button>
                                            <button 
                                                onClick={() => onEdit(investment)}
                                                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => onDelete(investment)}
                                                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-800 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
} 