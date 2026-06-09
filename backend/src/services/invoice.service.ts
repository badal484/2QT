import PDFDocument from 'pdfkit';
import { query } from '../db';
import fs from 'fs';
import path from 'path';

export const generateInvoicePDF = async (orderId: string): Promise<string> => {
    console.log(`[SERVICE] Generating real invoice for order: ${orderId}`);

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
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `INV-${order.invoice_number || order.display_id}.pdf`;
    const publicDir = path.join(__dirname, '../../public/invoices');
    const filePath = path.join(publicDir, fileName);
    
    // Ensure public dir exists
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(20).text('VELTO FOOD PALACE', { align: 'center' });
    doc.fontSize(10).text('Kundanahalli Central, Bengaluru', { align: 'center' });
    doc.moveDown();

    // Invoice Info
    doc.fontSize(14).text(`Invoice: ${order.invoice_number || order.display_id}`, { underline: true });
    doc.fontSize(10).text(`Date: ${new Date(order.created_at).toLocaleDateString()}`);
    doc.text(`Customer: ${order.customer_name} (${order.customer_phone})`);
    doc.moveDown();

    // Table Header
    doc.font('Helvetica-Bold');
    doc.text('Item', 50, 200);
    doc.text('Qty', 300, 200);
    doc.text('Price', 400, 200);
    doc.text('Total', 500, 200);
    doc.moveDown();
    doc.font('Helvetica');

    let y = 220;
    items.forEach(item => {
        doc.text(item.menu_item_name, 50, y);
        doc.text(item.quantity.toString(), 300, y);
        doc.text(`₹${(item.price_paise / 100).toFixed(2)}`, 400, y);
        doc.text(`₹${((item.price_paise * item.quantity) / 100).toFixed(2)}`, 500, y);
        y += 20;
    });

    doc.moveDown();
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 10;

    // Totals
    doc.text('Subtotal:', 400, y);
    doc.text(`₹${(order.subtotal_paise / 100).toFixed(2)}`, 500, y);
    y += 15;
    doc.text('Delivery Fee:', 400, y);
    doc.text(`₹${(order.delivery_fee_paise / 100).toFixed(2)}`, 500, y);
    y += 15;
    doc.text('GST:', 400, y);
    doc.text(`₹${((order.cgst_paise + order.sgst_paise) / 100).toFixed(2)}`, 500, y);
    y += 15;
    if (order.discount_paise > 0) {
        doc.text('Promo Discount:', 400, y);
        doc.text(`-₹${(order.discount_paise / 100).toFixed(2)}`, 500, y);
        y += 15;
    }
    if (order.loyalty_discount_paise > 0) {
        doc.text('Loyalty Discount:', 400, y);
        doc.text(`-₹${(order.loyalty_discount_paise / 100).toFixed(2)}`, 500, y);
        y += 15;
    }
    if (order.wallet_deduction_paise > 0) {
        doc.text('Wallet Used:', 400, y);
        doc.text(`-₹${(order.wallet_deduction_paise / 100).toFixed(2)}`, 500, y);
        y += 15;
    }
    doc.font('Helvetica-Bold').text('Total:', 400, y);
    doc.text(`₹${(order.total_amount_paise / 100).toFixed(2)}`, 500, y);

    // Footer
    doc.fontSize(8).text('Thank you for ordering with VELTO!', 50, 700, { align: 'center' });

    doc.end();

    return new Promise((resolve, reject) => {
        stream.on('finish', () => {
            // Return functional relative URL
            resolve(`/public/invoices/${fileName}`);
        });
        stream.on('error', reject);
    });
};
