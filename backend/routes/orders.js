const express = require('express');
const router = express.Router();
const { Order, Product } = require('../models');
const auth = require('../middleware/auth');

// POST /api/orders - Créer une commande
router.post('/', auth, async (req, res) => {
  try {
    const { items, address } = req.body;
    if (!items?.length) return res.status(400).json({ success: false, message: 'Panier vide' });

    // Récupérer les produits et calculer les prix réels (sécurité)
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) throw new Error(`Produit ${item.productId} introuvable`);
      if (product.stock < item.qty) throw new Error(`Stock insuffisant pour ${product.name}`);

      orderItems.push({
        product: product._id,
        name:    product.name,
        price:   product.price,
        qty:     item.qty,
        emoji:   product.emoji
      });
      subtotal += product.price * item.qty;

      // Décrémenter le stock
      product.stock -= item.qty;
      await product.save();
    }

    const delivery = 2000;
    const order = await Order.create({
      user:     req.user.id,
      items:    orderItems,
      subtotal,
      delivery,
      total:    subtotal + delivery,
      address
    });

    await order.populate('user');
    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/orders - Mes commandes
router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
                              .sort({ createdAt: -1 })
                              .populate('items.product', 'name emoji');
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user').populate('items.product');
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (order.user._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
