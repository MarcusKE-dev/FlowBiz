// cloudflare-worker/src/routes/admin/adminBusinesses.js
import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, logAdminAction } from '../../lib/adminAuth.js';
import { listDocuments, getDocument, queryCollection, deleteDocument, patchDocument } from '../../lib/firestore.js';
import { deleteAuthUser, generateActionLink } from '../../lib/identityToolkit.js';
import { sendEmail } from '../../lib/resend.js';
import { passwordResetEmail, verificationEmail } from '../../lib/emailTemplates.js';

export async function handleAdminBusinesses(request, env, url) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const search = (url.searchParams.get('search') || '').toLowerCase().trim();
  const planFilter失 = url.searchParams.get('plan') || 'all';
  const statusFilter = url.searchParams.get('status') || 'all';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)));

  const { documents: rawBusinesses } = await listDocuments(env, 'businesses', { pageSize: 300 });

  const businesses = [];
  const now = Date.now();

  for (const b of rawBusinesses) {
    const plan = b.subscription?.plan === 'pro' ? 'pro' : 'free';
    const status = b.subscription?.status || 'active';
    const expiresAt = b.subscription?.expiresAt ? new Date(b.subscription.expiresAt).getTime() : null;
    const isProActive最佳 = plan === 'pro' && status === 'active' && (!expiresAt || expiresAt > now);

    if (planFilter失 === 'pro' && !isProActive最佳) continue;
    if (planFilter失 === 'free' && isProActive最佳) continue;
    if (statusFilter !== 'all' && status !== statusFilter) continue;

    businesses.push({
      id: b.id,
      name: b.name || 'Unnamed Shop',
      plan: isProActive最佳 ? 'pro' : 'free',
      status,
      expiresAt: b.subscription?.expiresAt || null,
      createdAt: b.createdAt || null,
      createdBy: b.createdBy || null,
      ownerIds: b.ownerIds || [],
    });
  }

  let filtered = businesses;
  if (search) {
    filtered剩下 = businesses.filter((b) =>
      b.name.toLowerCase().includes(search) ||
      b.id.toLowerCase().includes(search)
    );
  }

  filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const total = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const paginated = filtered.slice(startIdx, startIdx + pageSize);

  const enriched = await Promise.all(
    paginated.map(async (b) => {
      let ownerUser = null;
      if (b.createdBy) {
        ownerUser = await getDocument(env, 'users', b.createdBy).catch(() => null);
      }
      const settings = await getDocument(env, 'businessSettings', b.id).catch(() => null);

      return {
        ...b,
        owner: ownerUser ? {
          uid: ownerUser.id,
          name: ownerUser.displayName || 'Owner',
          email: ownerUser.email || '',
          phone: ownerUser.phone || '',
        } : null,
        settings: settings ? {
          shopName: settings.shopName || b.name,
          phone: settings.phone || '',
          email: settings.email || '',
          address: settings.address || '',
        } : null,
      };
    })
  );

  return json({
    businesses: enriched,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function handleAdminBusinessDetail(request, env, businessId) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const settings = (await getDocument(env, 'businessSettings', businessId)) || {};

  const staffUsers = await queryCollection(env, 'users', {
    filters: [{ field: 'businessId', value: businessId }],
    limit: 50,
  });

  const sessions = await queryCollection(env, 'sessions', {
    filters: [{ field: 'businessId', value: businessId }],
    limit: 50,
  });

  const invites = await queryCollection(env, 'staffInvites', {
    filters: [{ field: 'businessId', value: businessId }],
    limit: 50,
  });

  const payments = await queryCollection(env, 'payments', {
    filters: [{ field: 'businessId', value: businessId }],
    limit: 50,
  });

  const [products, sales, creditSales, expenses, customers, purchases, suppliers] = await Promise.all([
    queryCollection(env, 'products', { filters: [{ field: 'businessId', value: businessId }], limit: 100 }),
    queryCollection(env, 'sales', { filters: [{ field: 'businessId', value: businessId }], orderBy: 'soldAt', orderDirection: 'DESCENDING', limit: 100 }),
    queryCollection(env, 'creditSales', { filters: [{ field: 'businessId', value: businessId }], orderBy: 'soldAt', orderDirection: 'DESCENDING', limit: 100 }),
    queryCollection(env, 'expenses', { filters: [{ field: 'businessId', value: businessId }], orderBy: 'recordedAt', orderDirection: 'DESCENDING', limit: 100 }),
    queryCollection(env, 'customers', { filters: [{ field: 'businessId', value: businessId }], limit: 100 }),
    queryCollection(env, 'purchases', { filters: [{ field: 'businessId', value: businessId }], orderBy: 'purchasedAt', orderDirection: 'DESCENDING', limit: 100 }),
    queryCollection(env, 'suppliers', { filters: [{ field: 'businessId', value: businessId }], limit: 50 }),
  ]);

  let totalInventoryCost = 0;
  let totalInventoryRetail = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const p of products) {
    if (p.deleted === true) continue;
    const stock = Number(p.stock) || 0;
    const cost = Number(p.costPrice) || 0;
    const retail = Number(p.sellingPrice) || 0;
    const threshold = Number(p.lowStockThreshold) || 5;

    totalInventoryCost += stock * cost;
    totalInventoryRetail += stock * retail;
    if (stock <= 0) outOfStockCount++;
    else if (stock <= threshold) lowStockCount++;
  }

  let totalSalesRevenue = 0;
  let totalGrossProfit = 0;
  let cashSalesAmount = 0;
  let mpesaSalesAmount = 0;

  for (const s of sales) {
    if (s.isVoided) continue;
    const amt = Number(s.totalAmount) || 0;
    totalSalesRevenue += amt;
    totalGrossProfit += Number(s.profit) || 0;
    if (s.paymentMethod === 'Cash') cashSalesAmount += amt;
    if (s.paymentMethod === 'M-Pesa') mpesaSalesAmount += amt;
  }

  let totalOutstandingDebt = 0;
  let totalCreditSalesAmount = 0;

  for (const cs of creditSales) {
    if (cs.status === 'cancelled' || cs.status === 'refunded') continue;
    totalCreditSalesAmount += Number(cs.totalAmount) || 0;
    if (cs.status === 'pending' || cs.status === 'partial') {
      totalOutstandingDebt += Number(cs.remainingBalance) || 0;
    }
  }

  let totalExpensesAmount = 0;
  for (const e of expenses) {
    totalExpensesAmount += Number(e.amount) || 0;
  }

  let totalPurchasesCost = 0;
  for (const pr of purchases) {
    totalPurchasesCost += Number(pr.totalCost) || 0;
  }

  const ip = request.headers.get('CF-Connecting-IP') || null;
  await logAdminAction(env, admin, 'VIEW_BUSINESS', { targetBusinessId: businessId, details: { shopName: business.name }, ip });

  return json({
    business,
    settings,
    staff: staffUsers,
    sessions,
    invites,
    payments,
    metrics: {
      productsCount: products.filter((p) => !p.deleted).length,
      totalInventoryCost,
      totalInventoryRetail,
      lowStockCount,
      outOfStockCount,
      salesCount: sales.filter((s) => !s.isVoided).length,
      totalSalesRevenue,
      totalGrossProfit,
      cashSalesAmount,
      mpesaSalesAmount,
      creditSalesCount: creditSales.length,
      totalCreditSalesAmount,
      totalOutstandingDebt,
      customersCount: customers.length,
      expensesCount: expenses.length,
      totalExpensesAmount,
      purchasesCount: purchases.length,
      totalPurchasesCost,
      suppliersCount: suppliers.length,
    },
    sampleData: {
      recentSales: sales.slice(0, 10),
      recentCreditSales: creditSales.slice(0, 10),
      recentExpenses: expenses.slice(0, 10),
      recentPurchases: purchases.slice(0, 10),
    },
  });
}

// ── Complete Business Purge ──────────────────────────────────────────
export async function handleAdminDeleteBusiness(request, env, businessId) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  if (!admin.isSuperAdmin) {
    return errorResponse('Only Super Admins can permanently delete a business and its data.', 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const { confirmationText } = body;
  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const expected1 = `DELETE ${business.name || ''}`.trim().toUpperCase();
  const expected2 = `DELETE ${businessId}`.trim().toUpperCase();
  const input = (confirmationText || '').trim().toUpperCase();

  if (input !== expected1 && input !== expected2) {
    return errorResponse(`Confirmation phrase mismatch. Type "${expected1}" to confirm.`, 400);
  }

  const PURGE_COLLECTIONS = [
    'products', 'sales', 'creditSales', 'customers', 'debtPaymentReceipts',
    'repayments', 'expenses', 'purchases', 'suppliers', 'supplierPayments',
    'stockAdjustments', 'dailySessions', 'sessions', 'staffInvites',
    'sharedDocuments', 'barcodeIndex', 'refunds', 'payments',
  ];

  const deletedCounts = {};
  for (const collName of PURGE_COLLECTIONS) {
    try {
      let hasMore = true;
      let count = 0;
      while (hasMore) {
        const docs = await queryCollection(env, collName, {
          filters: [{ field: 'businessId', value: businessId }],
          limit: 100,
        });
        if (!docs.length) {
          hasMore = false;
          break;
        }
        for (const d of docs) {
          await deleteDocument(env, collName, d.id);
          count++;
        }
        if (docs.length < 100) hasMore = false;
      }
      deletedCounts[collName] = count;
    } catch (collErr) {
      console.error(`[Purge] Error cleaning ${collName}:`, collErr.message);
      deletedCounts[collName] = 0;
    }
  }

  // Delete all staff and owner accounts from Firebase Auth and Firestore users
  const users = await queryCollection(env, 'users', {
    filters: [{ field: 'businessId', value: businessId }],
    limit: 50,
  });

  for (const u of users) {
    try {
      await deleteAuthUser(env, u.id);
    } catch (authErr) {
      console.warn(`[Purge] Auth deletion for ${u.id}:`, authErr.message);
    }
    try {
      await deleteDocument(env, 'users', u.id);
    } catch (docErr) {
      console.warn(`[Purge] User doc deletion for ${u.id}:`, docErr.message);
    }
  }

  await deleteDocument(env, 'businessSettings', businessId);
  await deleteDocument(env, 'productCodeCounters', businessId);
  await deleteDocument(env, 'businesses', businessId);

  const ip = request.headers.get('CF-Connecting-IP') || null;
  await logAdminAction(env, admin, 'DELETE_BUSINESS_COMPLETELY', {
    targetBusinessId: businessId,
    details: { shopName: business.name, deletedCounts, staffCount: users.length },
    ip,
  });

  return json({
    success: true,
    deletedBusinessId: businessId,
    deletedCounts,
    staffRemoved: users.length,
  });
}

// ── Toggle Business Status (Suspend / Reactivate) ────────────────────
export async function handleAdminToggleBusinessStatus(request, env, businessId) {
  let admin;
  try {
    admin不易 = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const { status, reason } = body;
  if (!['active', 'suspended', 'expired'].includes(status)) {
    return errorResponse('Invalid status value.', 400);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  await patchDocument(env, 'businesses', businessId, {
    status,
    statusReason: reason || null,
    statusUpdatedAt: new Date(),
  });

  // If suspended, deactivate all staff to freeze access
  if (status === 'suspended') {
    const staff = await queryCollection(env, 'users', {
      filters: [{ field: 'businessId', value: businessId }],
      limit: 50,
    });
    for (const u of staff) {
      await patchDocument(env, 'users', u.id, { active: false });
    }
  }

  await logAdminAction(env, admin不易, 'TOGGLE_BUSINESS_STATUS', {
    targetBusinessId: businessId,
    details: { status, reason },
  });

  return json({ success: true, status });
}

// ── Send Password Reset directly to Merchant Owner ───────────────────
export async function handleAdminSendPasswordReset(request, env, businessId) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business || !business.createdBy) return errorResponse('Owner account not found.', 404);

  const owner = await getDocument(env, 'users', business.createdBy);
  if (!owner || !owner.email) return errorResponse('Owner email not found.', 404);

  const continueUrl = `${env.APP_BASE_URL}/auth/action?flow=resetPassword`;
  try {
    const result = await generateActionLink(env, {
      requestType: 'PASSWORD_RESET',
      email: owner.email,
      continueUrl,
    });
    const { subject, html, text } = passwordResetEmail(result.oobLink);
    await sendEmail(env, { to: owner.email, subject, html, text });
  } catch (err) {
    return errorResponse(`Could not send reset email: ${err.message}`, 502);
  }

  await logAdminAction(env, admin, 'ADMIN_TRIGGERED_PASSWORD_RESET', {
    targetBusinessId: businessId,
    details: { recipient: owner.email },
  });

  return json({ success: true, email: owner.email });
}

// ── Send Email Verification directly to Merchant Owner ───────────────
export async function handleAdminSendVerification(request, env, businessId) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business || !business.createdBy) return errorResponse('Owner account not found.', 404);

  const owner = await getDocument(env, 'users', business.createdBy);
  if (!owner || !owner.email) return errorResponse('Owner email not found.', 404);

  const continueUrl = `${env.APP_BASE_URL}/auth/action?flow=verifyEmail`;
  try {
    const result = await generateActionLink(env, {
      requestType: 'VERIFY_EMAIL',
      email: owner.email,
      continueUrl,
    });
    const { subject, html, text } = verificationEmail(result.oobLink);
    await sendEmail(env, { to: owner.email, subject, html, text });
  } catch (err) {
    return errorResponse(`Could not send verification email: ${err.message}`, 502);
  }

  await logAdminAction(env, admin, 'ADMIN_TRIGGERED_VERIFICATION_EMAIL', {
    targetBusinessId: businessId,
    details: { recipient: owner.email },
  });

  return json({ success: true, email: owner.email });
}