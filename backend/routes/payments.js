/**
 * ROUTES PAIEMENTS - MVola, Orange Money, Airtel Money
 * POST /api/payments/initiate     → initier un paiement
 * GET  /api/payments/:id/status   → vérifier le statut
 * POST /api/payments/mvola/callback    → webhook MVola
 * POST /api/payments/orange/callback  → webhook Orange Money
 * POST /api/payments/airtel/callback  → webhook Airtel Money
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { Order, PaymentTransaction } = require('../models');
const mvolaService         = require('../services/mvolaService');
const { orangeMoneyService, airtelMoneyService } = require('../services/mobileMoneyServices');
const invoiceService       = require('../services/invoiceService');
const auth                 = require('../middleware/auth');

// ─── Initier un paiement ─────────────────────────────────────
router.post('/initiate', auth, [
  body('orderId').notEmpty(),
  body('method').isIn(['mvola', 'orange_money', 'airtel_money']),
  body('phoneNumber').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { orderId, method, phoneNumber } = req.body;

  try {
    const order = await Order.findById(orderId).populate('user');
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (order.user._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    if (order.payment?.status === 'success') {
      return res.status(400).json({ success: false, message: 'Commande déjà payée' });
    }

    let result;
    const paymentData = {
      amount:      order.total,
      phoneNumber,
      orderId:     order.orderNumber,
      description: `MadaBoutique - ${order.orderNumber}`
    };

    if (method === 'mvola') {
      result = await mvolaService.initiatePayment(paymentData);
    } else if (method === 'orange_money') {
      result = await orangeMoneyService.initiateWebPayment(paymentData);
    } else if (method === 'airtel_money') {
      result = await airtelMoneyService.initiatePayment(paymentData);
    }

    // Enregistrer la transaction
    const transaction = await PaymentTransaction.create({
      order:       order._id,
      user:        req.user.id,
      provider:    method,
      amount:      order.total,
      phoneNumber,
      serverCorrelationId: result.serverCorrelationId || result.payToken || result.transactionId,
      providerRef: result.transactionRef || result.orderRef || result.airtelRef,
      status:      'pending',
      rawResponse: result.rawResponse
    });

    // Mettre à jour la commande
    order.payment = { method, status: 'pending' };
    await order.save();

    res.json({
      success:       true,
      transactionId: transaction._id,
      // Orange Money redirige l'utilisateur
      paymentUrl:    result.paymentUrl || null,
      message:       method === 'mvola' || method === 'airtel_money'
                     ? 'Demande envoyée. Validez sur votre téléphone.'
                     : 'Redirection vers Orange Money...'
    });

  } catch (error) {
    console.error(`Erreur paiement [${method}]:`, error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'initiation du paiement',
      detail:  process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ─── Vérifier le statut d'un paiement ───────────────────────
router.get('/:transactionId/status', auth, async (req, res) => {
  try {
    const txn = await PaymentTransaction.findById(req.params.transactionId)
                      .populate('order');
    if (!txn) return res.status(404).json({ success: false, message: 'Transaction introuvable' });

    let statusResult;
    if (txn.provider === 'mvola' && txn.serverCorrelationId) {
      statusResult = await mvolaService.getTransactionStatus(txn.serverCorrelationId);
    } else if (txn.provider === 'orange_money') {
      statusResult = await orangeMoneyService.getPaymentStatus(txn.providerRef);
    } else if (txn.provider === 'airtel_money') {
      statusResult = await airtelMoneyService.getTransactionStatus(txn.providerRef);
    }

    // Si succès → finaliser
    const isSuccess = statusResult?.status === 'completed'
                   || statusResult?.success === true
                   || statusResult?.status === 'TS';

    if (isSuccess && txn.status !== 'success') {
      await _finalizePayment(txn, statusResult);
    }

    res.json({ success: true, status: txn.status, detail: statusResult });

  } catch (error) {
    console.error('Erreur vérification statut:', error.message);
    res.status(500).json({ success: false, message: 'Erreur vérification statut' });
  }
});

// ─── Webhook MVola ────────────────────────────────────────────
router.post('/mvola/callback', async (req, res) => {
  try {
    const result = mvolaService.handleCallback(req.body);
    const txn = await PaymentTransaction.findOne({
      serverCorrelationId: result.serverCorrelationId
    });
    if (txn && result.success) {
      await _finalizePayment(txn, result);
    }
    res.status(200).json({ status: 'received' });
  } catch (err) {
    console.error('MVola callback error:', err);
    res.status(200).json({ status: 'error' }); // Toujours 200 pour les webhooks
  }
});

// ─── Webhook Orange Money ─────────────────────────────────────
router.post('/orange/callback', async (req, res) => {
  try {
    const result = orangeMoneyService.handleNotification(req.body);
    const txn = await PaymentTransaction.findOne({ providerRef: { $regex: result.orderId } });
    if (txn && result.success) {
      await _finalizePayment(txn, result);
    }
    res.status(200).json({ status: 'received' });
  } catch (err) {
    console.error('Orange callback error:', err);
    res.status(200).json({ status: 'error' });
  }
});

// ─── Webhook Airtel Money ─────────────────────────────────────
router.post('/airtel/callback', async (req, res) => {
  try {
    const result = airtelMoneyService.handleCallback(req.body);
    const txn = await PaymentTransaction.findOne({ providerRef: result.transactionId });
    if (txn && result.success) {
      await _finalizePayment(txn, result);
    }
    res.status(200).json({ status: 'received' });
  } catch (err) {
    console.error('Airtel callback error:', err);
    res.status(200).json({ status: 'error' });
  }
});

// ─── Finalisation du paiement (commune) ──────────────────────
async function _finalizePayment(txn, statusResult) {
  const order = await Order.findById(txn.order).populate('user');
  if (!order || order.payment?.status === 'success') return;

  // Mettre à jour la transaction
  txn.status       = 'success';
  txn.callbackData = statusResult;
  await txn.save();

  // Mettre à jour la commande
  order.status            = 'paid';
  order.payment.status    = 'success';
  order.payment.paidAt    = new Date();
  order.payment.transactionId = statusResult.transactionReference
                              || statusResult.txnRef
                              || statusResult.airtelRef
                              || txn.serverCorrelationId;

  // Générer la facture PDF
  try {
    const { filePath, fileName } = await invoiceService.generateInvoice(order, order.user);
    order.invoicePath = filePath;
    console.log(`✅ Facture générée: ${fileName}`);
  } catch (invoiceErr) {
    console.error('Erreur génération facture:', invoiceErr.message);
  }

  await order.save();
}

module.exports = router;
