const express = require('express');
const router = express.Router();
const { Order } = require('../models');
const invoiceService = require('../services/invoiceService');
const auth = require('../middleware/auth');

// GET /api/invoices/:orderId/download → Télécharger la facture PDF
router.get('/:orderId/download', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('user');
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (order.user._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    if (order.payment?.status !== 'success') {
      return res.status(400).json({ success: false, message: 'Facture disponible après paiement' });
    }

    const buffer = await invoiceService.generateInvoiceBuffer(order, order.user);

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${order.invoiceNumber}.pdf"`,
      'Content-Length':      buffer.length
    });
    res.send(buffer);

  } catch (err) {
    console.error('Erreur génération PDF:', err);
    res.status(500).json({ success: false, message: 'Erreur génération facture' });
  }
});

// GET /api/invoices/:orderId/preview → Aperçu HTML
router.get('/:orderId/preview', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('user');
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const methods = { mvola: 'MVola (Telma)', orange_money: 'Orange Money', airtel_money: 'Airtel Money' };
    const fmt = (n) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
    const date = new Date(order.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facture ${order.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; }
    .invoice { max-width: 750px; margin: 20px auto; background: #fff; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
    .header { background: #1D9E75; color: white; padding: 30px; }
    .header h1 { font-size: 28px; }
    .header .inv-number { font-size: 18px; opacity: 0.9; margin-top: 5px; }
    .body { padding: 30px; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 25px; }
    .label { font-size: 11px; color: #9CA3AF; text-transform: uppercase; margin-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    thead th { background: #085041; color: white; padding: 10px; text-align: left; font-size: 13px; }
    tbody tr:nth-child(even) { background: #F9FAFB; }
    td, th { padding: 10px; font-size: 13px; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 280px; }
    .total-row td { padding: 6px 10px; font-size: 13px; }
    .total-final { background: #1D9E75; color: white; font-weight: bold; font-size: 15px; }
    .total-final td { padding: 10px; }
    .paid-badge { display: inline-flex; align-items: center; gap: 8px; background: #E1F5EE; color: #085041; padding: 8px 16px; border-radius: 30px; font-weight: bold; font-size: 13px; margin-top: 20px; }
    .footer { background: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; }
    @media print { body { background: white; } .invoice { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <h1>🛍 MadaBoutique</h1>
      <div class="inv-number">Facture ${order.invoiceNumber}</div>
      <div style="font-size:13px;opacity:0.7;margin-top:4px">${date}</div>
    </div>
    <div class="body">
      <div class="parties">
        <div>
          <div class="label">Vendeur</div>
          <strong>MadaBoutique SARL</strong><br>
          <span style="color:#6B7280;font-size:13px">Analakely, Antananarivo<br>+261 34 000 0000</span>
        </div>
        <div>
          <div class="label">Facturé à</div>
          <strong>${order.user.name}</strong><br>
          <span style="color:#6B7280;font-size:13px">${order.user.email}<br>${order.address}</span>
        </div>
      </div>
      <table>
        <thead><tr><th>Produit</th><th class="text-right">Qté</th><th class="text-right">Prix unit.</th><th class="text-right">Total</th></tr></thead>
        <tbody>
          ${order.items.map(i => `
          <tr>
            <td>${i.emoji || ''} ${i.name}</td>
            <td class="text-right">${i.qty}</td>
            <td class="text-right">${fmt(i.price)}</td>
            <td class="text-right">${fmt(i.price * i.qty)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <table class="totals">
        <tr class="total-row"><td>Sous-total</td><td class="text-right">${fmt(order.subtotal)}</td></tr>
        <tr class="total-row"><td>Livraison</td><td class="text-right">${fmt(order.delivery)}</td></tr>
        <tr class="total-final"><td>TOTAL</td><td class="text-right">${fmt(order.total)}</td></tr>
      </table>
      <div class="paid-badge">✅ Paiement confirmé — ${methods[order.payment?.method] || 'Mobile Money'}</div>
    </div>
    <div class="footer">
      Merci pour votre achat chez MadaBoutique · info@madaboutique.mg · www.madaboutique.mg
    </div>
  </div>
  <div style="text-align:center;margin:20px">
    <button onclick="window.print()" style="background:#1D9E75;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:15px">
      🖨 Imprimer / Enregistrer en PDF
    </button>
  </div>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
