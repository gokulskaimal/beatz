const Order = require('../../models/orderModel');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } = require('date-fns');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Helper function to get date range
const getDateRange = (range, startDate, endDate) => {
    const now = new Date();
    switch (range) {
        case 'day':
            return { start: startOfDay(now), end: endOfDay(now) };
        case 'week':
            return { start: startOfWeek(now), end: endOfWeek(now) };
        case 'month':
            return { start: startOfMonth(now), end: endOfMonth(now) };
        case 'year':
            return { start: startOfYear(now), end: endOfYear(now) };
        case 'custom':
            return { start: new Date(startDate), end: new Date(endDate) };
        default:
            return { start: subDays(now, 30), end: now };
    }
};

exports.renderSalesReportPage = async (req, res) => {
    try {
        const dateRange = getDateRange('month'); 
        const salesData = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    'payment.paymentStatus': 'Completed'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    totalSales: { $sum: '$payment.totalAmount' },
                    totalOrders: { $sum: 1 },
                    totalDiscount: { $sum: '$payment.discount' },
                    totalCouponDiscount: { $sum: '$payment.couponDiscount' },
                    netAmount: { $sum: { $subtract: ['$payment.totalAmount', { $add: ['$payment.discount'] }] } },
                    orders: {
                        $push: {
                            orderId: '$_id',
                            customerName: '$customer.customerName',
                            totalAmount: '$payment.totalAmount',
                            discount: '$payment.discount',
                            couponDiscount: '$payment.couponDiscount',
                            paymentMethod: '$payment.paymentMethod',
                            paymentStatus: '$payment.paymentStatus'
                        }
                    }
                }
            },
            { $sort: { _id: -1 } }
        ]);

        const summary = salesData.reduce((acc, day) => {
            acc.totalSales += day.totalSales;
            acc.totalOrders += day.totalOrders;
            acc.totalDiscount += day.totalDiscount;
            acc.totalCouponDiscount += day.totalCouponDiscount;
            acc.netAmount += day.netAmount;
            return acc;
        }, { totalSales: 0, totalOrders: 0, totalDiscount: 0, totalCouponDiscount: 0, netAmount: 0 });

        res.render('admin/salesReport', { salesData, summary });
    } catch (error) {
        console.error('Error rendering sales report page:', error);
        res.status(500).render('error', { message: 'Error rendering sales report page' });
    }
};

exports.getSalesReport = async (req, res) => {
    try {
        const { range, startDate, endDate, page = 1, limit = 10 } = req.query;
        const dateRange = getDateRange(range, startDate, endDate);

        const skip = (page - 1) * limit;

        const salesData = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    'payment.paymentStatus': 'Completed'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    totalSales: { $sum: '$payment.totalAmount' },
                    totalOrders: { $sum: 1 },
                    totalDiscount: { $sum: '$payment.discount' },
                    totalCouponDiscount: { $sum: '$payment.couponDiscount' },
                    netAmount: { $sum: { $subtract: ['$payment.totalAmount', { $add: ['$payment.discount'] }] } },
                    orders: {
                        $push: {
                            orderId: '$_id',
                            customerName: '$customer.customerName',
                            totalAmount: '$payment.totalAmount',
                            discount: '$payment.discount',
                            couponDiscount: '$payment.couponDiscount',
                            paymentMethod: '$payment.paymentMethod',
                            paymentStatus: '$payment.paymentStatus'
                        }
                    }
                }
            },
            { $sort: { _id: -1 } },
            { $skip: parseInt(skip) },
            { $limit: parseInt(limit) }
        ]);

        const totalCount = await Order.countDocuments({
            orderDate: { $gte: dateRange.start, $lte: dateRange.end },
            'payment.paymentStatus': 'Completed'
        });

        const summary = salesData.reduce((acc, day) => {
            acc.totalSales += day.totalSales;
            acc.totalOrders += day.totalOrders;
            acc.totalDiscount += day.totalDiscount;
            acc.totalCouponDiscount += day.totalCouponDiscount;
            acc.netAmount += day.netAmount;
            return acc;
        }, { totalSales: 0, totalOrders: 0, totalDiscount: 0, totalCouponDiscount: 0, netAmount: 0 });

        res.json({
            success: true,
            salesData,
            summary,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalItems: totalCount
            }
        });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ success: false, message: 'Error generating sales report' });
    }
};


exports.downloadPdfReport = async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const dateRange = getDateRange(range, startDate, endDate);

        const salesData = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    'payment.paymentStatus': 'Completed'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    totalSales: { $sum: '$payment.totalAmount' },
                    totalOrders: { $sum: 1 },
                    totalDiscount: { $sum: '$payment.discount' },
                    totalCouponDiscount: { $sum: '$payment.couponDiscount' },
                    netAmount: { $sum: { $subtract: ['$payment.totalAmount', { $add: ['$payment.discount', '$payment.couponDiscount'] }] } },
                    orders: {
                        $push: {
                            orderId: '$_id',
                            customerName: '$customer.customerName',
                            totalAmount: '$payment.totalAmount',
                            discount: '$payment.discount',
                            couponDiscount: '$payment.couponDiscount',
                            paymentMethod: '$payment.paymentMethod'
                        }
                    }
                }
            },
            { $sort: { _id: -1 } }
        ]);

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');

        doc.pipe(res);

        doc.fontSize(14).text('Sales Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Date Range: ${dateRange.start.toDateString()} - ${dateRange.end.toDateString()}`, { align: 'center' });
        doc.moveDown();

        const tableTop = 100;
        const tableLeft = 30;
        const rowHeight = 20;
        const colWidths = [60, 60, 80, 60, 60, 80, 60, 60];

        // Table headers
        doc.font('Helvetica-Bold');
        const headers = ['Date', 'Order ID', 'Customer', 'Total', 'Discount', 'Coupon Disc', 'Net Amount', 'Payment'];
        headers.forEach((header, i) => {
            doc.text(header, tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop);
        });

        // Table rows
        doc.font('Helvetica');
        let currentTop = tableTop + rowHeight;

        salesData.forEach(day => {
            day.orders.forEach(order => {
                const netAmount = order.totalAmount - order.discount - order.couponDiscount;
                const values = [
                    day._id,
                    order.orderId.toString().slice(-6),
                    order.customerName.slice(0, 10),
                    order.totalAmount.toFixed(2),
                    order.discount.toFixed(2),
                    order.couponDiscount.toFixed(2),
                    netAmount.toFixed(2),
                    order.paymentMethod.slice(0, 8)
                ];
                values.forEach((value, i) => {
                    doc.text(value, tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0), currentTop);
                });
                currentTop += rowHeight;

                if (currentTop > 700) {
                    doc.addPage();
                    currentTop = 50;
                }
            });
        });

        doc.end();
    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).json({ success: false, message: 'Error generating PDF report' });
    }
};


exports.downloadExcelReport = async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const dateRange = getDateRange(range, startDate, endDate);

        const salesData = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    'payment.paymentStatus': 'Completed'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    totalSales: { $sum: '$payment.totalAmount' },
                    totalOrders: { $sum: 1 },
                    totalDiscount: { $sum: '$payment.discount' },
                    totalCouponDiscount: { $sum: '$payment.couponDiscount' },
                    netAmount: { $sum: { $subtract: ['$payment.totalAmount', { $add: ['$payment.discount', '$payment.couponDiscount'] }] } },
                    orders: {
                        $push: {
                            orderId: '$_id',
                            customerName: '$customer.customerName',
                            totalAmount: '$payment.totalAmount',
                            discount: '$payment.discount',
                            couponDiscount: '$payment.couponDiscount',
                            paymentMethod: '$payment.paymentMethod'
                        }
                    }
                }
            },
            { $sort: { _id: -1 } }
        ]);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Order ID', key: 'orderId', width: 20 },
            { header: 'Customer Name', key: 'customerName', width: 20 },
            { header: 'Total Amount', key: 'totalAmount', width: 15 },
            { header: 'Discount', key: 'discount', width: 15 },
            { header: 'Coupon Discount', key: 'couponDiscount', width: 15 },
            { header: 'Net Amount', key: 'netAmount', width: 15 },
            { header: 'Payment Method', key: 'paymentMethod', width: 15 }
        ];

        salesData.forEach(day => {
            day.orders.forEach(order => {
                const netAmount = order.totalAmount - order.discount - order.couponDiscount;
                worksheet.addRow({
                    date: day._id,
                    orderId: order.orderId,
                    customerName: order.customerName,
                    totalAmount: order.totalAmount,
                    discount: order.discount,
                    couponDiscount: order.couponDiscount,
                    netAmount: netAmount,
                    paymentMethod: order.paymentMethod
                });
            });
        });

        worksheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
            row.eachCell({ includeEmpty: false }, function(cell, colNumber) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.font = { size: 10 };
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating Excel report:', error);
        res.status(500).json({ success: false, message: 'Error generating Excel report' });
    }
};

module.exports = exports;

