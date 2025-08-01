"use client";

import React, { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  RadialLinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { PolarArea } from 'react-chartjs-2';
import { formatCurrency } from "../../utils/currency";
import { InvestmentInterface } from "../../types/investments";
import { ChartControls } from "../ChartControls";
import { useChartExpansion } from "../../utils/chartUtils";
import { useChartAnimationState } from "../../hooks/useChartAnimationContext";

ChartJS.register(RadialLinearScale, ArcElement, Tooltip, Legend, ChartDataLabels);

interface InvestmentTypePolarChartProps {
    investments: InvestmentInterface[];
    currency?: string;
    title?: string;
}

const INVESTMENT_TYPE_COLORS = {
    STOCKS: '#0088FE',
    CRYPTO: '#00C49F', 
    MUTUAL_FUNDS: '#FFBB28',
    BONDS: '#FF8042',
    REAL_ESTATE: '#8884D8',
    GOLD: '#82CA9D',
    FIXED_DEPOSIT: '#FFC658',
    PROVIDENT_FUNDS: '#FF7C7C',
    SAFE_KEEPINGS: '#8DD1E1',
    OTHER: '#D084D0'
};

const TYPE_LABELS = {
    STOCKS: 'Stocks',
    CRYPTO: 'Cryptocurrency',
    MUTUAL_FUNDS: 'Mutual Funds',
    BONDS: 'Bonds',
    REAL_ESTATE: 'Real Estate',
    GOLD: 'Gold',
    FIXED_DEPOSIT: 'Fixed Deposits',
    PROVIDENT_FUNDS: 'Provident Funds',
    SAFE_KEEPINGS: 'Safe Keepings',
    OTHER: 'Other'
};

export const InvestmentTypePolarChart = React.memo<InvestmentTypePolarChartProps>(({ investments, currency = "USD", title }) => {
    const { isExpanded, toggleExpanded } = useChartExpansion();
    const chartRef = useRef<HTMLDivElement>(null);
    
    // Animation control - allow animations but prevent excessive re-renders
    const chartId = "investment-type-polar";
    const { hasAnimated } = useChartAnimationState(chartId);
    
    // Process data - group by investment type
    const processedData = useMemo(() => {
        const typeMap = new Map<string, { totalValue: number; count: number }>();
        
        investments.forEach(investment => {
            const type = investment.type || 'OTHER';
            const currentData = typeMap.get(type) || { totalValue: 0, count: 0 };
            
            const quantity = Number(investment.quantity) || 0;
            const purchasePrice = Number(investment.purchasePrice) || 0;
            const investedAmount = quantity * purchasePrice;
            
            typeMap.set(type, {
                totalValue: currentData.totalValue + investedAmount,
                count: currentData.count + 1
            });
        });

        // Convert to structured data with additional info
        const typeData = Array.from(typeMap.entries())
            .sort(([, a], [, b]) => b.totalValue - a.totalValue)
            .map(([type, data]) => ({
                type,
                label: TYPE_LABELS[type as keyof typeof TYPE_LABELS] || type,
                value: data.totalValue,
                count: data.count,
                color: INVESTMENT_TYPE_COLORS[type as keyof typeof INVESTMENT_TYPE_COLORS] || '#9CA3AF'
            }));

        const totalInvested = typeData.reduce((sum, item) => sum + item.value, 0);

        return {
            typeData,
            totalInvested,
            chartData: {
                labels: typeData.map(item => {
                    const percentage = totalInvested > 0 ? ((item.value / totalInvested) * 100).toFixed(1) : '0.0';
                    return `${item.label} [${percentage}%]`;
                }),
                datasets: [{
                    label: 'Investment Distribution',
                    data: typeData.map(item => item.value),
                    backgroundColor: typeData.map(item => item.color),
                    borderColor: '#fff',
                    borderWidth: 2,
                }]
            }
        };
    }, [
        investments.length,
        // Add checksum to detect actual data changes, not just reference changes
        investments.reduce((sum, inv) => sum + inv.id + inv.quantity + inv.purchasePrice, 0)
    ]);

    const { typeData, totalInvested, chartData } = processedData;

    // Custom download function for Chart.js canvas with white background, margins, and legends
    const downloadChartAsPNG = () => {
        if (!chartRef.current) return;
        
        const canvas = chartRef.current.querySelector('canvas');
        if (!canvas) return;
        
        try {
            const padding = 60;
            const legendWidth = 280;
            const titleHeight = 80;
            const chartWidth = canvas.width;
            const chartHeight = canvas.height;
            
            // Create a new canvas with extra space for margins and legends
            const newCanvas = document.createElement('canvas');
            const ctx = newCanvas.getContext('2d');
            
            newCanvas.width = chartWidth + legendWidth + (padding * 3); // Left, middle, right padding
            newCanvas.height = chartHeight + titleHeight + (padding * 2); // Top and bottom padding
            
            if (ctx) {
                // Fill with white background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
                
                // Draw title
                ctx.fillStyle = '#1f2937';
                ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'center';
                const chartTitle = title || 'Investment Portfolio by Type';
                ctx.fillText(chartTitle, newCanvas.width / 2, padding + 25);
                
                // Draw subtitle
                ctx.fillStyle = '#6b7280';
                ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillText(`Total Invested: ${formatCurrency(totalInvested, currency)}`, newCanvas.width / 2, padding + 50);
                
                // Draw the original chart canvas
                const chartX = padding;
                const chartY = titleHeight + padding;
                ctx.drawImage(canvas, chartX, chartY);
                
                // Draw legend
                const legendX = chartWidth + padding * 2;
                const legendY = titleHeight + padding + 10;
                
                // Legend title
                ctx.fillStyle = '#1f2937';
                ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('Investment Breakdown', legendX, legendY);
                
                // Draw legend items
                let currentY = legendY + 30;
                typeData.forEach((item, index) => {
                    const percentage = totalInvested > 0 ? ((item.value / totalInvested) * 100).toFixed(1) : '0.0';
                    
                    // Draw color circle (smaller)
                    ctx.fillStyle = item.color;
                    ctx.beginPath();
                    ctx.arc(legendX + 8, currentY - 4, 6, 0, 2 * Math.PI);
                    ctx.fill();
                    
                    // Draw white border around circle
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    
                    // Draw investment type name and count on same line
                    ctx.fillStyle = '#374151';
                    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    ctx.textAlign = 'left';
                    const labelText = `${item.label} (${item.count})`;
                    ctx.fillText(labelText, legendX + 22, currentY);
                    
                    // Draw amount and percentage on same line
                    ctx.fillStyle = '#1f2937';
                    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    const valueText = `${formatCurrency(item.value, currency)} • ${percentage}%`;
                    ctx.fillText(valueText, legendX + 22, currentY + 16);
                    
                    currentY += 42;
                });
                
                // Create download link
                const link = document.createElement('a');
                link.download = 'investment-portfolio-polar-chart.png';
                link.href = newCanvas.toDataURL('image/png', 1.0);
                link.click();
            }
        } catch (error) {
            console.error('Error exporting chart as PNG:', error);
        }
    };

    const downloadChartAsSVG = () => {
        if (!chartRef.current) return;
        
        const canvas = chartRef.current.querySelector('canvas');
        if (!canvas) return;
        
        try {
            const padding = 60;
            const legendWidth = 280;
            const titleHeight = 80;
            const chartWidth = canvas.width;
            const chartHeight = canvas.height;
            
            const svgWidth = chartWidth + legendWidth + (padding * 3);
            const svgHeight = chartHeight + titleHeight + (padding * 2);
            
            // Create a comprehensive canvas for SVG embedding
            const newCanvas = document.createElement('canvas');
            const ctx = newCanvas.getContext('2d');
            
            newCanvas.width = svgWidth;
            newCanvas.height = svgHeight;
            
            if (ctx) {
                // Fill with white background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
                
                // Draw title
                ctx.fillStyle = '#1f2937';
                ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'center';
                const chartTitle = title || 'Investment Portfolio by Type';
                ctx.fillText(chartTitle, newCanvas.width / 2, padding + 25);
                
                // Draw subtitle
                ctx.fillStyle = '#6b7280';
                ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillText(`Total Invested: ${formatCurrency(totalInvested, currency)}`, newCanvas.width / 2, padding + 50);
                
                // Draw the original chart canvas
                const chartX = padding;
                const chartY = titleHeight + padding;
                ctx.drawImage(canvas, chartX, chartY);
                
                // Draw legend
                const legendX = chartWidth + padding * 2;
                const legendY = titleHeight + padding + 10;
                
                // Legend title
                ctx.fillStyle = '#1f2937';
                ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('Investment Breakdown', legendX, legendY);
                
                // Draw legend items
                let currentY = legendY + 30;
                typeData.forEach((item, index) => {
                    const percentage = totalInvested > 0 ? ((item.value / totalInvested) * 100).toFixed(1) : '0.0';
                    
                    // Draw color circle (smaller)
                    ctx.fillStyle = item.color;
                    ctx.beginPath();
                    ctx.arc(legendX + 8, currentY - 4, 6, 0, 2 * Math.PI);
                    ctx.fill();
                    
                    // Draw white border around circle
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    
                    // Draw investment type name and count on same line
                    ctx.fillStyle = '#374151';
                    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    ctx.textAlign = 'left';
                    const labelText = `${item.label} (${item.count})`;
                    ctx.fillText(labelText, legendX + 22, currentY);
                    
                    // Draw amount and percentage on same line
                    ctx.fillStyle = '#1f2937';
                    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    const valueText = `${formatCurrency(item.value, currency)} • ${percentage}%`;
                    ctx.fillText(valueText, legendX + 22, currentY + 16);
                    
                    currentY += 42;
                });
                
                // Create SVG with embedded comprehensive image
                const dataURL = newCanvas.toDataURL('image/png', 1.0);
                const svgContent = `
                    <svg xmlns="http://www.w3.org/2000/svg" 
                         xmlns:xlink="http://www.w3.org/1999/xlink" 
                         width="${svgWidth}" 
                         height="${svgHeight}" 
                         viewBox="0 0 ${svgWidth} ${svgHeight}">
                        <rect width="100%" height="100%" fill="white"/>
                        <image href="${dataURL}" width="${svgWidth}" height="${svgHeight}"/>
                    </svg>
                `;
                
                // Create and download SVG file
                const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = 'investment-portfolio-polar-chart.svg';
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error exporting chart as SVG:', error);
        }
    };

    // Prepare CSV data for export
    const csvData = [
        ['Investment Type', 'Amount', 'Count', 'Percentage'],
        ...typeData.map(item => {
            const percentage = totalInvested > 0 ? ((item.value / totalInvested) * 100).toFixed(1) : '0.0';
            return [item.label, item.value.toString(), item.count.toString(), `${percentage}%`];
        })
    ];

    // Chart options
    const options = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 0,
        animation: {
            animateRotate: true,
            animateScale: true,
            duration: isExpanded ? 0 : 1500, // Animate on initial load, disable when expanded for performance
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1f2937',
                bodyColor: '#374151',
                borderColor: '#e5e7eb',
                borderWidth: 1,
                cornerRadius: 6,
                padding: 12,
                callbacks: {
                    title: function(tooltipItems: any[]) {
                        return tooltipItems[0]?.label || '';
                    },
                    label: function(context: any) {
                        const dataIndex = context.dataIndex;
                        const typeInfo = typeData[dataIndex];
                        if (!typeInfo) return '';

                        const percentage = totalInvested > 0 ? ((typeInfo.value / totalInvested) * 100).toFixed(1) : '0.0';
                        const lines = [
                            `Amount: ${formatCurrency(typeInfo.value, currency)}`,
                            `Percentage: ${percentage}%`,
                            `Positions: ${typeInfo.count}`
                        ];
                        return lines;
                    }
                }
            },
            datalabels: {
                display: true,
                color: '#ffffff',
                font: {
                    size: 10,

                },
                formatter: function(value: number, context: any) {
                    const dataIndex = context.dataIndex;
                    const typeInfo = typeData[dataIndex];
                    if (!typeInfo) return '';
                    
                    const percentage = totalInvested > 0 ? ((typeInfo.value / totalInvested) * 100).toFixed(1) : '0.0';
                    // Only show labels for segments >= 5%
                    if (parseFloat(percentage) >= 10) {
                        return `${typeInfo.label}\n${percentage}%`;
                    } else {
                        return '';
                    }
                },
                textAlign: 'center' as const,
                anchor: 'center' as const,
                align: 'center' as const,
                offset: 0,
                padding: 4,
            } as any
        },
        scales: {
            r: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                },
                angleLines: {
                    color: 'rgba(0, 0, 0, 0.1)',
                },
                pointLabels: {
                    color: '#374151',
                    font: {
                        size: 12,
                    }
                },
                ticks: {
                    display: false,
                }
            }
        },
    }), [currency, typeData, totalInvested, isExpanded]);

    const ChartContent = () => (
        <div>
            {!investments.length ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                    No investment data available
                </div>
            ) : (
                <>
                    {/* Chart */}
                    <div 
                        ref={chartRef}
                        className={`${isExpanded ? 'h-[60vh] w-full' : 'h-[24rem] sm:h-[38rem] w-full'} mb-4`}
                        role="img"
                        aria-label={`Polar chart showing investment portfolio distribution with total invested of ${formatCurrency(totalInvested, currency)}`}
                    >
                        <div className={`grid ${isExpanded ? 'grid-cols-1 xl:grid-cols-5 gap-4 h-full' : 'grid-cols-1 lg:grid-cols-6 gap-3 h-full'}`}>
                            <div className={`${isExpanded ? 'xl:col-span-4 h-full' : 'lg:col-span-5 h-full'} relative`}>
                                <PolarArea 
                                    key={`polar-chart-${isExpanded ? 'expanded' : 'normal'}`}
                                    data={chartData} 
                                    options={options} 
                                />
                            </div>
                            
                            <div className={`space-y-3 ${isExpanded ? 'xl:col-span-1' : 'lg:col-span-1'}`} style={{ margin: '20px' }}>
                                <div className="space-y-2 max-h-full overflow-y-auto">
                                    {typeData.map((item, index) => {
                                        const percentage = totalInvested > 0 ? ((item.value / totalInvested) * 100).toFixed(1) : '0.0';
                                        return (
                                            <div key={item.type} className="p-2 rounded-lg transition-colors">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center space-x-2">
                                                        <div
                                                            className="w-4 h-4 rounded-full border border-white shadow-sm"
                                                            style={{ backgroundColor: item.color }}
                                                        />
                                                        <span className="text-sm font-medium text-gray-800">{item.label}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-500">({item.count})</span>
                                                </div>
                                                <div className="ml-6">
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {formatCurrency(item.value, currency)}
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        {percentage}% of portfolio
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <>
            <div 
                className="bg-white rounded-lg shadow p-3 sm:p-6"
                role="region"
                aria-label="Investment Portfolio Polar Chart"
                data-chart-type="polar-area"
            >
                <ChartControls
                    chartRef={chartRef}
                    isExpanded={isExpanded}
                    onToggleExpanded={toggleExpanded}
                    fileName="investment-portfolio-polar-chart"
                    csvData={csvData}
                    csvFileName="investment-portfolio-data"
                    title={title || 'Investment Portfolio by Type'}
                    tooltipText={`Total Invested: ${formatCurrency(totalInvested, currency)}`}
                    customDownloadPNG={downloadChartAsPNG}
                    customDownloadSVG={downloadChartAsSVG}
                />
                <ChartContent />
            </div>

            {/* Full screen modal */}
            {isExpanded && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-white rounded-lg p-3 sm:p-6 max-w-7xl w-full max-h-full overflow-auto">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 gap-2 sm:gap-0">
                            <div>
                                <h2 className="text-lg sm:text-2xl font-semibold">{title || 'Investment Portfolio by Type'}</h2>
                                <p className="text-sm text-gray-500">Total Invested: {formatCurrency(totalInvested, currency)}</p>
                            </div>
                            <button
                                onClick={toggleExpanded}
                                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm sm:text-base"
                            >
                                Close
                            </button>
                        </div>
                        <ChartContent />
                    </div>
                </div>
            )}
        </>
    );
});

InvestmentTypePolarChart.displayName = 'InvestmentTypePolarChart';