import PDFDocument from 'pdfkit';
import { query } from '../db';
import fs from 'fs';
import path from 'path';

export const generateInvoicePDF = async (orderId: string): Promise<string> => {
    console.log(`[SERVICE] Generating beautiful invoice for order: ${orderId}`);

    // 1. Fetch Order Details
    const { rows: orderRows } = await query(`
        SELECT o.*, u.name as customer_name, u.phone as customer_phone
        FROM orders o
        JOIN users u ON o.customer_id = u.id
        WHERE o.id = $1
    `, [orderId]);

    const order = orderRows[0];
    if (!order) throw new Error('ORDER_NOT_FOUND');

    const { rows: items } = await query(
        "SELECT * FROM order_items WHERE order_id = $1",
        [orderId]
    );

    // 2. Create PDF
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const fileName = `INV-${order.invoice_number || order.display_id}.pdf`;
    const publicDir = path.join(__dirname, '../../public/invoices');
    const filePath = path.join(publicDir, fileName);
    
    // Ensure public dir exists
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Constants for design
    const primaryColor = '#10B981'; // 2QT Green
    const textColor = '#374151';
    const lightGray = '#F3F4F6';
    const borderGray = '#E5E7EB';

    // Top Banner
    doc.rect(0, 0, 595, 120).fill(primaryColor);
    
    // Brand & Logo Area
    doc.fillColor('#FFFFFF')
       .fontSize(36).font('Helvetica-Bold')
       .text('2QT', 50, 35)
       .fontSize(11).font('Helvetica')
       .text('Premium Food Delivery', 50, 75)
       .text('Kundanahalli Central, Bengaluru', 50, 90);

    // Invoice Title Area
    doc.fontSize(32).font('Helvetica-Bold')
       .text('INVOICE', 0, 35, { align: 'right', width: 545 })
       .fontSize(10).font('Helvetica-Bold')
       .text(`INV #${order.invoice_number || order.display_id}`, 0, 75, { align: 'right', width: 545 })
       .font('Helvetica')
       .text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 0, 90, { align: 'right', width: 545 });

    // Reset layout for content
    doc.x = 50;
    doc.y = 150;
    doc.fillColor(textColor);

    // Billing & Order Info Section
    doc.fontSize(12).font('Helvetica-Bold').text('Billed To:', 50, 160);
    doc.fontSize(10).font('Helvetica')
       .text(order.customer_name || 'Valued Customer', 50, 180)
       .text(order.customer_phone || '', 50, 195);
       
    doc.fontSize(12).font('Helvetica-Bold').text('Order Information:', 350, 160);
    doc.fontSize(10).font('Helvetica')
       .text(`Order ID:`, 350, 180).font('Helvetica-Bold').text(order.display_id, 410, 180)
       .font('Helvetica').text(`Status:`, 350, 195).font('Helvetica-Bold').text(order.status.replace(/_/g, ' ').toUpperCase(), 410, 195)
       .font('Helvetica').text(`Payment:`, 350, 210).font('Helvetica-Bold').text(order.payment_method?.toUpperCase() || 'ONLINE', 410, 210);

    // Table Header
    const tableTop = 260;
    doc.rect(50, tableTop, 495, 30).fill(lightGray);
    doc.fillColor(textColor).font('Helvetica-Bold').fontSize(10);
    doc.text('ITEM DESCRIPTION', 60, tableTop + 10);
    doc.text('QTY', 350, tableTop + 10, { width: 40, align: 'center' });
    doc.text('PRICE', 400, tableTop + 10, { width: 60, align: 'right' });
    doc.text('TOTAL', 470, tableTop + 10, { width: 65, align: 'right' });

    // Table Rows
    doc.font('Helvetica');
    let y = tableTop + 40;

    items.forEach(item => {
        // Draw bottom border
        doc.moveTo(50, y + 20).lineTo(545, y + 20).strokeColor(borderGray).lineWidth(1).stroke();
        
        doc.fillColor(textColor)
           .text(item.menu_item_name, 60, y + 5)
           .text(item.quantity.toString(), 350, y + 5, { width: 40, align: 'center' })
           .text(`Rs. ${(item.price_paise / 100).toFixed(2)}`, 400, y + 5, { width: 60, align: 'right' })
           .text(`Rs. ${((item.price_paise * item.quantity) / 100).toFixed(2)}`, 470, y + 5, { width: 65, align: 'right' });
        
        y += 30;
        
        // Basic pagination if many items
        if (y > 650) {
            doc.addPage({ margin: 0, size: 'A4' });
            y = 50;
        }
    });

    y += 20;

    // Summary Section
    const summaryX = 330;
    const summaryW = 205;

    const addSummaryRow = (label: string, value: number, isBold = false, isGreen = false) => {
        if (isBold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
        if (isGreen) doc.fillColor(primaryColor); else doc.fillColor(textColor);
        
        doc.text(label, summaryX, y);
        doc.text(`Rs. ${(value / 100).toFixed(2)}`, summaryX, y, { width: summaryW, align: 'right' });
        y += 22;
    };

    addSummaryRow('Subtotal', order.subtotal_paise);
    addSummaryRow('Delivery Fee', order.delivery_fee_paise);
    addSummaryRow('Taxes (GST)', order.cgst_paise + order.sgst_paise);
    
    if (order.discount_paise > 0) addSummaryRow('Promo Discount', -order.discount_paise, false, true);
    if (order.loyalty_discount_paise > 0) addSummaryRow('Loyalty Used', -order.loyalty_discount_paise, false, true);
    if (order.wallet_deduction_paise > 0) addSummaryRow('Wallet Used', -order.wallet_deduction_paise, false, true);

    // Total divider
    doc.moveTo(summaryX, y - 5).lineTo(summaryX + summaryW, y - 5).strokeColor(primaryColor).lineWidth(2).stroke();
    
    doc.fontSize(14).font('Helvetica-Bold').fillColor(textColor);
    doc.text('Total Amount', summaryX, y + 5);
    doc.text(`Rs. ${(order.total_amount_paise / 100).toFixed(2)}`, summaryX, y + 5, { width: summaryW, align: 'right' });

    // Footer
    doc.rect(0, 780, 595, 62).fill(lightGray);
    doc.fillColor('#6B7280').fontSize(10).font('Helvetica-Oblique');
    doc.text('Thank you for choosing 2QT! We hope you enjoyed your meal.', 0, 795, { align: 'center', width: 595 });
    doc.text('Need help? Contact support@2qt.app or call +91-8800000000', 0, 810, { align: 'center', width: 595 });

    doc.end();

    return new Promise((resolve, reject) => {
        stream.on('finish', () => {
            resolve(`/public/invoices/${fileName}`);
        });
        stream.on('error', reject);
    });
};
