const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────
// MODÈLE UTILISATEUR
// ─────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true, minlength: 6 },
  phone:     { type: String, required: true },
  address:   { type: String, default: '' },
  role:      { type: String, enum: ['client', 'admin'], default: 'client' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// ─────────────────────────────────────────────
// MODÈLE PRODUIT
// ─────────────────────────────────────────────
const ProductSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price:       { type: Number, required: true, min: 0 },
  category:    { type: String, required: true },
  emoji:       { type: String, default: '📦' },
  stock:       { type: Number, default: 0 },
  image:       { type: String, default: '' },
  active:      { type: Boolean, default: true }
}, { timestamps: true });

// ─────────────────────────────────────────────
// MODÈLE COMMANDE
// ─────────────────────────────────────────────
const OrderItemSchema = new mongoose.Schema({
  product:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:       { type: String, required: true },
  price:      { type: Number, required: true },
  qty:        { type: Number, required: true, min: 1 },
  emoji:      { type: String }
});

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items:       [OrderItemSchema],
  subtotal:    { type: Number, required: true },
  delivery:    { type: Number, default: 2000 },
  total:       { type: Number, required: true },
  address:     { type: String, required: true },
  status:      {
    type: String,
    enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  payment: {
    method:        { type: String, enum: ['mvola', 'orange_money', 'airtel_money'] },
    transactionId: { type: String },
    status:        { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    paidAt:        { type: Date }
  },
  invoiceNumber: { type: String },
  invoicePath:   { type: String }
}, { timestamps: true });

// Génération automatique du numéro de commande
OrderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `CMD-${String(count + 1).padStart(6, '0')}`;
  }
  if (!this.invoiceNumber) {
    this.invoiceNumber = `FAC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

// ─────────────────────────────────────────────
// MODÈLE TRANSACTION PAIEMENT
// ─────────────────────────────────────────────
const PaymentTransactionSchema = new mongoose.Schema({
  order:          { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider:       { type: String, enum: ['mvola', 'orange_money', 'airtel_money'], required: true },
  amount:         { type: Number, required: true },
  currency:       { type: String, default: 'MGA' },
  phoneNumber:    { type: String, required: true },
  // IDs externes renvoyés par les APIs
  providerRef:    { type: String },
  serverCorrelationId: { type: String },
  // Statut
  status:         { type: String, enum: ['initiated', 'pending', 'success', 'failed', 'cancelled'], default: 'initiated' },
  rawResponse:    { type: mongoose.Schema.Types.Mixed },
  callbackData:   { type: mongoose.Schema.Types.Mixed },
  errorMessage:   { type: String }
}, { timestamps: true });

module.exports = {
  User:               mongoose.model('User', UserSchema),
  Product:            mongoose.model('Product', ProductSchema),
  Order:              mongoose.model('Order', OrderSchema),
  PaymentTransaction: mongoose.model('PaymentTransaction', PaymentTransactionSchema)
};
