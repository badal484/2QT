import { Router } from 'express';
import { query } from '../db';
import pool from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { ensureRiderFundAccount, ensureKitchenFundAccount, firePayout, isAutoPayConfigured } from '../services/razorpay-payout.service';

const router = Router();
const financeAccess = authenticate, financeRole = requireRole('finance', 'super_admin');

// ─── Summary / Overview ───────────────────────────────────────────────────────

router.get('/summary', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const { date } = req.query as { date?: string };
    const targetDate = date || new Date().toISOString().split('T')[0];

    const [revenue, codPending, riderDue, kitchenDue, weekRevenue] = await Promise.all([
      // Today's revenue breakdown
      // cod_revenue_paise = COD orders collected (payment_status='paid'), not pending ones
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_count,
          COALESCE(SUM(total_amount_paise) FILTER (WHERE status = 'delivered' AND payment_status = 'paid'), 0) AS gross_revenue_paise,
          COALESCE(SUM(total_amount_paise) FILTER (WHERE status = 'delivered' AND payment_method != 'cod'), 0) AS online_revenue_paise,
          COALESCE(SUM(total_amount_paise) FILTER (WHERE status = 'delivered' AND payment_method = 'cod' AND payment_status = 'paid'), 0) AS cod_revenue_paise,
          COALESCE(SUM(total_amount_paise) FILTER (WHERE status = 'delivered' AND payment_method = 'cod' AND payment_status = 'cod_pending'), 0) AS cod_pending_revenue_paise,
          COALESCE(SUM(delivery_fee_paise) FILTER (WHERE status = 'delivered' AND payment_status = 'paid'), 0) AS delivery_fee_paise,
          COALESCE(SUM(commission_paise) FILTER (WHERE status = 'delivered'), 0) AS commission_earned_paise,
          COUNT(*) FILTER (WHERE status NOT IN ('delivered','cancelled')) AS active_orders
        FROM orders
        WHERE DATE(created_at AT TIME ZONE 'Asia/Kolkata') = $1
      `, [targetDate]),

      // COD cash in transit (delivered COD orders not yet collected)
      query(`
        SELECT
          u.id AS rider_id,
          u.name AS rider_name,
          u.phone AS rider_phone,
          COUNT(o.id) AS order_count,
          COALESCE(SUM(o.total_amount_paise), 0) AS cash_pending_paise
        FROM orders o
        JOIN users u ON o.rider_id = u.id
        WHERE o.payment_method = 'cod'
          AND o.status = 'delivered'
          AND o.cod_cash_collected = FALSE
        GROUP BY u.id, u.name, u.phone
        ORDER BY cash_pending_paise DESC
      `, []),

      // Rider payouts pending
      query(`
        SELECT COALESCE(SUM(net_amount_paise), 0) AS pending_paise, COUNT(*) AS pending_count
        FROM weekly_payouts WHERE status = 'pending'
      `, []),

      // Kitchen payouts pending
      query(`
        SELECT COALESCE(SUM(net_payout_paise), 0) AS pending_paise, COUNT(*) AS pending_count
        FROM kitchen_payouts WHERE status = 'pending'
      `, []),

      // Last 7 days revenue
      query(`
        SELECT
          DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS date,
          COALESCE(SUM(total_amount_paise) FILTER (WHERE status = 'delivered'), 0) AS revenue_paise,
          COUNT(*) FILTER (WHERE status = 'delivered') AS orders
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY date ASC
      `, []),
    ]);

    const rev = revenue.rows[0];
    res.json({
      date: targetDate,
      todayRevenue: {
        deliveredCount: parseInt(rev.delivered_count),
        activeOrders: parseInt(rev.active_orders),
        grossRevenuePaise: parseInt(rev.gross_revenue_paise),
        onlineRevenuePaise: parseInt(rev.online_revenue_paise),
        codRevenuePaise: parseInt(rev.cod_revenue_paise),
        codPendingRevenuePaise: parseInt(rev.cod_pending_revenue_paise),
        deliveryFeePaise: parseInt(rev.delivery_fee_paise),
        commissionEarnedPaise: parseInt(rev.commission_earned_paise),
      },
      codPendingRiders: codPending.rows,
      riderPayoutsDue: {
        pendingPaise: parseInt(riderDue.rows[0].pending_paise),
        pendingCount: parseInt(riderDue.rows[0].pending_count),
      },
      kitchenPayoutsDue: {
        pendingPaise: parseInt(kitchenDue.rows[0].pending_paise),
        pendingCount: parseInt(kitchenDue.rows[0].pending_count),
      },
      weeklyRevenue: weekRevenue.rows,
    });
  } catch (err) {
    console.error('[finance/summary]', err);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

// ─── COD Tracker ─────────────────────────────────────────────────────────────

router.get('/cod/pending', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(`
      SELECT
        o.id, o.display_id, o.total_amount_paise, o.created_at, o.updated_at,
        o.cash_submit_requested_at,
        u.id AS rider_id, u.name AS rider_name, u.phone AS rider_phone
      FROM orders o
      JOIN users u ON o.rider_id = u.id
      WHERE o.payment_method = 'cod'
        AND o.status = 'delivered'
        AND o.cod_cash_collected = FALSE
      ORDER BY
        o.cash_submit_requested_at DESC NULLS LAST,
        o.updated_at DESC
    `);
    res.json({ orders: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch COD pending' });
  }
});

router.post('/cod/mark-collected', financeAccess, financeRole, async (req: AuthRequest, res) => {
  const { orderIds, riderId, notes } = req.body as { orderIds: string[]; riderId: string; notes?: string };
  if (!orderIds?.length || !riderId) return res.status(400).json({ error: 'orderIds and riderId required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark orders as collected + settle payment_status to 'paid'
    const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(',');
    const { rows: updatedOrders } = await client.query(`
      UPDATE orders
      SET cod_cash_collected = TRUE,
          cod_collected_at = NOW(),
          cod_collected_by = $${orderIds.length + 1},
          payment_status = 'paid'
      WHERE id IN (${placeholders}) AND payment_method = 'cod' AND cod_cash_collected = FALSE
      RETURNING id, total_amount_paise
    `, [...orderIds, req.user!.userId]);

    const totalPaise = updatedOrders.reduce((sum: number, o: any) => sum + parseInt(o.total_amount_paise), 0);

    // Log in cod_collections
    for (const order of updatedOrders) {
      await client.query(`
        INSERT INTO cod_collections (rider_id, order_id, amount_paise, collected_by, notes)
        VALUES ($1, $2, $3, $4, $5)
      `, [riderId, order.id, order.total_amount_paise, req.user!.userId, notes || null]);
    }

    await client.query('COMMIT');
    res.json({ success: true, collectedCount: updatedOrders.length, totalPaise });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[finance/cod/mark-collected]', err);
    res.status(500).json({ error: 'Failed to mark collected' });
  } finally {
    client.release();
  }
});

router.get('/cod/history', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const { limit = '50', offset = '0' } = req.query as Record<string, string>;
    const { rows } = await query(`
      SELECT
        cc.id, cc.amount_paise, cc.notes, cc.created_at,
        u.name AS rider_name, u.phone AS rider_phone,
        cb.name AS collected_by_name,
        o.display_id AS order_display_id
      FROM cod_collections cc
      JOIN users u ON cc.rider_id = u.id
      LEFT JOIN users cb ON cc.collected_by = cb.id
      LEFT JOIN orders o ON cc.order_id = o.id
      ORDER BY cc.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    res.json({ collections: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch COD history' });
  }
});

// ─── Rider Payouts ────────────────────────────────────────────────────────────

router.get('/rider-payouts', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const { status = 'pending' } = req.query as { status?: string };
    const { rows } = await query(`
      SELECT
        wp.*,
        u.name AS rider_name, u.phone AS rider_phone,
        rde.deliveries_count AS this_week_deliveries
      FROM weekly_payouts wp
      JOIN users u ON wp.rider_id = u.id
      LEFT JOIN rider_daily_earnings rde ON rde.rider_id = wp.rider_id
        AND rde.date = wp.week_end
      WHERE wp.status = $1
      ORDER BY wp.created_at DESC
    `, [status]);
    res.json({ payouts: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rider payouts' });
  }
});

router.get('/rider-payouts/all-riders', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(`
      SELECT
        u.id, u.name, u.phone,
        COALESCE(SUM(rde.total_paise), 0) AS total_earned_paise,
        COALESCE(SUM(rde.deliveries_count), 0) AS total_deliveries,
        COALESCE(
          (SELECT SUM(net_amount_paise) FROM weekly_payouts WHERE rider_id = u.id AND status = 'paid'), 0
        ) AS total_paid_paise,
        COALESCE(
          (SELECT SUM(net_amount_paise) FROM weekly_payouts WHERE rider_id = u.id AND status = 'pending'), 0
        ) AS pending_paise
      FROM users u
      LEFT JOIN rider_daily_earnings rde ON rde.rider_id = u.id
        AND rde.date >= CURRENT_DATE - INTERVAL '7 days'
      WHERE u.role = 'rider' AND u.is_active = TRUE
      GROUP BY u.id, u.name, u.phone
      ORDER BY pending_paise DESC
    `);
    res.json({ riders: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch riders' });
  }
});

router.post('/rider-payouts/:id/mark-paid', financeAccess, financeRole, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { paymentReference, notes } = req.body as { paymentReference?: string; notes?: string };
  try {
    const { rows: payoutRows } = await query(`
      SELECT wp.*, u.name AS rider_name, u.phone AS rider_phone,
             u.upi_id, u.razorpay_contact_id, u.razorpay_fund_account_id
      FROM weekly_payouts wp
      JOIN users u ON wp.rider_id = u.id
      WHERE wp.id = $1 AND wp.status = 'pending'
    `, [id]);
    if (!payoutRows.length) return res.status(404).json({ error: 'Payout not found or already paid' });
    const payout = payoutRows[0];

    let rzpPayoutId: string | null = paymentReference || null;
    let utrNumber: string | null = null;
    let autoMode = false;

    // Auto-fire Razorpay if configured and rider has a UPI
    if (isAutoPayConfigured() && payout.upi_id) {
      try {
        const fundAccountId = await ensureRiderFundAccount({
          id: payout.rider_id, name: payout.rider_name,
          phone: payout.rider_phone, upi_id: payout.upi_id,
          razorpay_contact_id: payout.razorpay_contact_id,
          razorpay_fund_account_id: payout.razorpay_fund_account_id,
        });
        const result = await firePayout(
          fundAccountId, payout.net_amount_paise,
          `2QT Rider Payout`, `2QT-R-${id.slice(0, 8)}`
        );
        rzpPayoutId = result.payoutId;
        utrNumber = result.utr;
        autoMode = true;
      } catch (rzpErr: any) {
        console.error('[finance/rider-payout/auto-pay]', rzpErr.message);
        // Fall through — still mark paid manually
      }
    }

    const { rows } = await query(`
      UPDATE weekly_payouts
      SET status = 'paid', paid_at = NOW(), approved_by = $2,
          payment_reference = $3, notes = $4, razorpay_payout_id = $5,
          utr_number = $6, payout_mode = $7, updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, [id, req.user!.userId, rzpPayoutId, notes || null, rzpPayoutId, utrNumber, autoMode ? 'auto' : 'manual']);

    res.json({ success: true, payout: rows[0], autoTransferred: autoMode });
  } catch (err) {
    console.error('[finance/rider-payouts/mark-paid]', err);
    res.status(500).json({ error: 'Failed to mark paid' });
  }
});

// ─── Kitchen Payouts ──────────────────────────────────────────────────────────

router.get('/kitchen-payouts', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const { status = 'pending' } = req.query as { status?: string };
    const { rows } = await query(`
      SELECT kp.*, k.name AS kitchen_name, k.upi_id, k.commission_rate
      FROM kitchen_payouts kp
      JOIN kitchens k ON kp.kitchen_id = k.id
      WHERE kp.status = $1
      ORDER BY kp.created_at DESC
    `, [status]);
    res.json({ payouts: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch kitchen payouts' });
  }
});

router.post('/kitchen-payouts/generate', financeAccess, financeRole, async (req: AuthRequest, res) => {
  const { kitchenId, periodStart, periodEnd } = req.body as {
    kitchenId: string; periodStart: string; periodEnd: string;
  };
  if (!kitchenId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: 'kitchenId, periodStart, periodEnd required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: kitchenRows } = await client.query(
      'SELECT id, name, commission_rate, is_partner FROM kitchens WHERE id = $1', [kitchenId]
    );
    if (!kitchenRows.length || !kitchenRows[0].is_partner) {
      return res.status(400).json({ error: 'Kitchen not found or not a partner' });
    }
    const kitchen = kitchenRows[0];

    const { rows: orderStats } = await client.query(`
      SELECT
        COUNT(*) AS orders_count,
        COALESCE(SUM(subtotal_paise), 0) AS gross_sales_paise
      FROM orders
      WHERE kitchen_id = $1
        AND status = 'delivered'
        AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
    `, [kitchenId, periodStart, periodEnd]);

    const stats = orderStats[0];
    const grossSalesPaise = parseInt(stats.gross_sales_paise);
    const commissionRate = parseFloat(kitchen.commission_rate);
    const commissionPaise = Math.round(grossSalesPaise * commissionRate);
    const netPayoutPaise = grossSalesPaise - commissionPaise;

    const { rows: inserted } = await client.query(`
      INSERT INTO kitchen_payouts
        (kitchen_id, period_start, period_end, gross_sales_paise, commission_paise, net_payout_paise, orders_count, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *
    `, [kitchenId, periodStart, periodEnd, grossSalesPaise, commissionPaise, netPayoutPaise, parseInt(stats.orders_count)]);

    await client.query('COMMIT');
    res.json({ success: true, payout: { ...inserted[0], kitchen_name: kitchen.name } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[finance/kitchen-payouts/generate]', err);
    res.status(500).json({ error: 'Failed to generate payout' });
  } finally {
    client.release();
  }
});

router.post('/kitchen-payouts/:id/mark-paid', financeAccess, financeRole, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { upiReference, bankReference, notes } = req.body as { upiReference?: string; bankReference?: string; notes?: string };
  try {
    const { rows: kpRows } = await query(`
      SELECT kp.*, k.name AS kitchen_name, k.upi_id, k.contact_phone,
             k.razorpay_contact_id, k.razorpay_fund_account_id
      FROM kitchen_payouts kp
      JOIN kitchens k ON kp.kitchen_id = k.id
      WHERE kp.id = $1 AND kp.status IN ('pending','processing')
    `, [id]);
    if (!kpRows.length) return res.status(404).json({ error: 'Payout not found or already paid' });
    const kp = kpRows[0];

    let rzpPayoutId: string | null = upiReference || null;
    let utrNumber: string | null = null;
    let autoMode = false;

    // Auto-fire Razorpay if configured and kitchen has UPI
    if (isAutoPayConfigured() && kp.upi_id) {
      try {
        const fundAccountId = await ensureKitchenFundAccount({
          id: kp.kitchen_id, name: kp.kitchen_name,
          upi_id: kp.upi_id, contact_phone: kp.contact_phone,
          razorpay_contact_id: kp.razorpay_contact_id,
          razorpay_fund_account_id: kp.razorpay_fund_account_id,
        });
        const result = await firePayout(
          fundAccountId, kp.net_payout_paise,
          `2QT Kitchen Payout`, `2QT-K-${id.slice(0, 8)}`
        );
        rzpPayoutId = result.payoutId;
        utrNumber = result.utr;
        autoMode = true;
      } catch (rzpErr: any) {
        console.error('[finance/kitchen-payout/auto-pay]', rzpErr.message);
        // Fall through — still mark paid manually
      }
    }

    const { rows } = await query(`
      UPDATE kitchen_payouts
      SET status = 'paid', paid_at = NOW(), approved_by = $2,
          razorpay_payout_id = $3, utr_number = $4,
          payout_mode = $5, notes = $6, bank_reference = $7, updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, [id, req.user!.userId, rzpPayoutId, utrNumber, autoMode ? 'auto' : 'manual', notes || null, bankReference || null]);

    res.json({ success: true, payout: rows[0], autoTransferred: autoMode });
  } catch (err) {
    console.error('[finance/kitchen-payouts/mark-paid]', err);
    res.status(500).json({ error: 'Failed to mark paid' });
  }
});

router.get('/kitchen-payouts/summary', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(`
      SELECT
        k.id, k.name AS kitchen_name, k.commission_rate, k.upi_id, k.is_partner,
        COALESCE(
          (SELECT SUM(gross_sales_paise) FROM kitchen_payouts WHERE kitchen_id = k.id AND status = 'paid'), 0
        ) AS lifetime_gross_paise,
        COALESCE(
          (SELECT SUM(commission_paise) FROM kitchen_payouts WHERE kitchen_id = k.id AND status = 'paid'), 0
        ) AS lifetime_commission_paise,
        COALESCE(
          (SELECT SUM(net_payout_paise) FROM kitchen_payouts WHERE kitchen_id = k.id AND status = 'pending'), 0
        ) AS pending_payout_paise,
        (SELECT COUNT(*) FROM orders WHERE kitchen_id = k.id AND status = 'delivered'
          AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') >= CURRENT_DATE - 7
        ) AS orders_last_7_days
      FROM kitchens k
      WHERE k.is_partner = TRUE
      ORDER BY pending_payout_paise DESC
    `);
    res.json({ kitchens: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch kitchen payout summary' });
  }
});

// ─── Transactions (Full Ledger) ────────────────────────────────────────────────

router.get('/transactions', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const {
      startDate, endDate, paymentMethod, status,
      limit = '50', offset = '0', export: doExport
    } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (startDate) {
      const startTz = new Date(`${startDate}T00:00:00+05:30`).toISOString();
      conditions.push(`o.created_at >= $${p++}`);
      params.push(startTz);
    }
    if (endDate) {
      const endTz = new Date(`${endDate}T23:59:59.999+05:30`).toISOString();
      conditions.push(`o.created_at <= $${p++}`);
      params.push(endTz);
    }
    if (paymentMethod) { conditions.push(`o.payment_method = $${p++}`); params.push(paymentMethod); }
    if (status) { conditions.push(`o.status = $${p++}`); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    if (doExport === 'csv') {
      const { rows } = await query(`
        SELECT
          o.display_id, o.created_at, o.status, o.payment_method, o.payment_status,
          o.subtotal_paise, o.delivery_fee_paise, o.total_amount_paise,
          o.commission_paise, o.kitchen_payout_paise,
          o.cod_cash_collected,
          c.name AS customer_name, c.phone AS customer_phone,
          k.name AS kitchen_name,
          r.name AS rider_name
        FROM orders o
        LEFT JOIN users c ON o.customer_id = c.id
        LEFT JOIN kitchens k ON o.kitchen_id = k.id
        LEFT JOIN users r ON o.rider_id = r.id
        ${where}
        ORDER BY o.created_at DESC
      `, params);

      const headers = ['Order ID','Date','Status','Payment','Pay Status','Subtotal','Delivery Fee','Total','Commission','Kitchen Payout','COD Collected','Customer','Phone','Kitchen','Rider'];
      const csvRows = rows.map(r => [
        r.display_id, new Date(r.created_at).toISOString(), r.status, r.payment_method, r.payment_status,
        (r.subtotal_paise/100).toFixed(2), (r.delivery_fee_paise/100).toFixed(2), (r.total_amount_paise/100).toFixed(2),
        (r.commission_paise/100).toFixed(2), (r.kitchen_payout_paise/100).toFixed(2),
        r.cod_cash_collected ? 'Yes' : 'No',
        r.customer_name, r.customer_phone, r.kitchen_name, r.rider_name
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="transactions-${Date.now()}.csv"`);
      return res.send([headers.join(','), ...csvRows].join('\n'));
    }

    const [dataResult, countResult] = await Promise.all([
      query(`
        SELECT
          o.id, o.display_id, o.created_at, o.status, o.payment_method, o.payment_status,
          o.subtotal_paise, o.delivery_fee_paise, o.discount_paise, o.total_amount_paise,
          o.commission_paise, o.kitchen_payout_paise, o.cod_cash_collected,
          c.name AS customer_name,
          k.name AS kitchen_name,
          r.name AS rider_name
        FROM orders o
        LEFT JOIN users c ON o.customer_id = c.id
        LEFT JOIN kitchens k ON o.kitchen_id = k.id
        LEFT JOIN users r ON o.rider_id = r.id
        ${where}
        ORDER BY o.created_at DESC
        LIMIT $${p} OFFSET $${p + 1}
      `, [...params, parseInt(limit), parseInt(offset)]),
      query(`SELECT COUNT(*) FROM orders o ${where}`, params),
    ]);

    res.json({
      transactions: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('[finance/transactions]', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ─── Product Revenue ──────────────────────────────────────────────────────────

router.get('/products/revenue', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, kitchenId } = req.query as Record<string, string>;

    const conditions = [`o.status = 'delivered'`];
    const params: any[] = [];
    let p = 1;

    if (startDate) {
      const startTz = new Date(`${startDate}T00:00:00+05:30`).toISOString();
      conditions.push(`o.created_at >= $${p++}`);
      params.push(startTz);
    }
    if (endDate) {
      const endTz = new Date(`${endDate}T23:59:59.999+05:30`).toISOString();
      conditions.push(`o.created_at <= $${p++}`);
      params.push(endTz);
    }
    if (kitchenId) { conditions.push(`mi.kitchen_id = $${p++}`); params.push(kitchenId); }

    const { rows } = await query(`
      SELECT
        mi.id, mi.name, mi.image_url,
        k.name AS kitchen_name,
        COUNT(oi.id) AS units_sold,
        COALESCE(SUM(oi.quantity), 0) AS total_quantity,
        COALESCE(SUM(oi.price_paise * oi.quantity), 0) AS total_revenue_paise,
        AVG(oi.price_paise) AS avg_price_paise
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN kitchens k ON mi.kitchen_id = k.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY mi.id, mi.name, mi.image_url, k.name
      ORDER BY total_revenue_paise DESC
      LIMIT 100
    `, params);

    res.json({ products: rows });
  } catch (err) {
    console.error('[finance/products/revenue]', err);
    res.status(500).json({ error: 'Failed to fetch product revenue' });
  }
});

// ─── Partner Kitchen Management ───────────────────────────────────────────────

router.get('/partners/applications', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const { status = 'new' } = req.query as { status?: string };
    const { rows } = await query(`
      SELECT ka.*, rb.name AS reviewed_by_name
      FROM kitchen_applications ka
      LEFT JOIN users rb ON ka.reviewed_by = rb.id
      WHERE ka.status = $1
      ORDER BY ka.created_at DESC
    `, [status]);
    res.json({ applications: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

router.post('/partners/applications', async (req, res) => {
  // Public endpoint — from the website "Partner with us" form
  const { restaurantName, ownerName, phone, email, address, city, cuisineType, fssaiNumber, expectedDailyOrders, upiId } = req.body;
  if (!restaurantName || !ownerName || !phone || !email || !address || !city) {
    return res.status(400).json({ error: 'Required fields missing' });
  }
  try {
    const { rows } = await query(`
      INSERT INTO kitchen_applications
        (restaurant_name, owner_name, phone, email, address, city, cuisine_type, fssai_number, expected_daily_orders, upi_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, created_at
    `, [restaurantName, ownerName, phone, email, address, city, cuisineType || null, fssaiNumber || null, expectedDailyOrders || null, upiId || null]);
    res.json({ success: true, applicationId: rows[0].id });
  } catch (err) {
    console.error('[finance/partners/applications POST]', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

router.patch('/partners/applications/:id', financeAccess, financeRole, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status, rejectionReason, notes } = req.body as {
    status: 'reviewing' | 'approved' | 'rejected'; rejectionReason?: string; notes?: string;
  };
  try {
    const { rows } = await query(`
      UPDATE kitchen_applications
      SET status = $2, rejection_reason = $3, notes = $4, reviewed_by = $5, reviewed_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, status, rejectionReason || null, notes || null, req.user!.userId]);
    res.json({ success: true, application: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update application' });
  }
});

router.get('/partners/kitchens', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(`
      SELECT
        k.*,
        COUNT(o.id) FILTER (WHERE o.status = 'delivered' AND o.created_at >= NOW() - INTERVAL '30 days') AS orders_30d,
        COALESCE(SUM(o.subtotal_paise) FILTER (WHERE o.status = 'delivered' AND o.created_at >= NOW() - INTERVAL '30 days'), 0) AS revenue_30d_paise
      FROM kitchens k
      LEFT JOIN orders o ON o.kitchen_id = k.id
      WHERE k.is_partner = TRUE
      GROUP BY k.id
      ORDER BY revenue_30d_paise DESC
    `);
    res.json({ kitchens: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch partner kitchens' });
  }
});

router.patch('/partners/kitchens/:id', financeAccess, financeRole, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { commissionRate, upiId, bankAccount, bankName, ifsc, contactName, contactPhone, contactEmail, isPartner, partnerStatus, partnerNotes } = req.body;
  try {
    const { rows } = await query(`
      UPDATE kitchens SET
        commission_rate = COALESCE($2, commission_rate),
        upi_id = COALESCE($3, upi_id),
        bank_account = COALESCE($4, bank_account),
        bank_name = COALESCE($5, bank_name),
        ifsc = COALESCE($6, ifsc),
        contact_name = COALESCE($7, contact_name),
        contact_phone = COALESCE($8, contact_phone),
        contact_email = COALESCE($9, contact_email),
        is_partner = COALESCE($10, is_partner),
        partner_status = COALESCE($11, partner_status),
        partner_notes = COALESCE($12, partner_notes),
        partner_approved_at = CASE WHEN $10 = TRUE AND NOT is_partner THEN NOW() ELSE partner_approved_at END
      WHERE id = $1
      RETURNING *
    `, [id, commissionRate ?? null, upiId ?? null, bankAccount ?? null, bankName ?? null, ifsc ?? null,
        contactName ?? null, contactPhone ?? null, contactEmail ?? null,
        isPartner ?? null, partnerStatus ?? null, partnerNotes ?? null]);

    if (!rows.length) return res.status(404).json({ error: 'Kitchen not found' });
    res.json({ success: true, kitchen: rows[0] });
  } catch (err) {
    console.error('[finance/partners/kitchens PATCH]', err);
    res.status(500).json({ error: 'Failed to update kitchen' });
  }
});

// ─── Finance User Management ──────────────────────────────────────────────────

router.get('/me', financeAccess, financeRole, async (req: AuthRequest, res) => {
  try {
    const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user!.userId]);
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
