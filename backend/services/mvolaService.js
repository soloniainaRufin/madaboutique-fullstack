/**
 * SERVICE MVOLA - Intégration API officielle Telma Madagascar
 * Documentation: https://developer.mvola.mg/docs
 * 
 * Flow:
 *  1. generateToken()  → obtenir le token OAuth2
 *  2. initiatePayment() → initier la transaction
 *  3. Callback webhook → confirmer via handleCallback()
 *  4. getTransactionStatus() → vérifier le statut
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const MVOLA_BASE = process.env.MVOLA_BASE_URL || 'https://devapi.mvola.mg';

class MVolaService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
  }

  // ─── Étape 1: Obtenir le token OAuth2 ───────────────────
  async generateToken() {
    // Réutiliser le token si encore valide
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    const credentials = Buffer.from(
      `${process.env.MVOLA_CONSUMER_KEY}:${process.env.MVOLA_CONSUMER_SECRET}`
    ).toString('base64');

    const response = await axios.post(
      `${MVOLA_BASE}/token`,
      'grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE',
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        }
      }
    );

    this.token = response.data.access_token;
    // Token MVola valide 3600 secondes (1h), on soustrait 5min pour sécurité
    this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
    
    return this.token;
  }

  // ─── Étape 2: Initier une transaction ───────────────────
  async initiatePayment({ amount, phoneNumber, description, orderId }) {
    const token = await this.generateToken();
    const correlationId = uuidv4();
    const transactionRef = `MB-${Date.now()}`;

    const payload = {
      amount: String(amount),
      currency: 'Ar',
      descriptionText: description || 'Achat MadaBoutique',
      requestDate: new Date().toISOString(),
      debitParty: [{ key: 'msisdn', value: phoneNumber.replace(/\s+/g, '') }],
      creditParty: [{ key: 'msisdn', value: process.env.MVOLA_MERCHANT_NUMBER }],
      metadata: [
        { key: 'partnerName', value: 'MadaBoutique' },
        { key: 'fc', value: 'USD' },
        { key: 'amountFc', value: '1' }
      ],
      requestingOrganisationTransactionReference: transactionRef,
      originalTransactionReference: orderId
    };

    const response = await axios.post(
      `${MVOLA_BASE}/mvola/mm/transactions/type/merchantpay/1.0.0/`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Version': '1.0',
          'X-CorrelationID': correlationId,
          'UserLanguage': 'FR',
          'UserAccountIdentifier': `msisdn;${process.env.MVOLA_MERCHANT_NUMBER}`,
          'partnerName': 'MadaBoutique',
          'Cache-Control': 'no-cache',
          'callbackUrl': process.env.MVOLA_CALLBACK_URL
        }
      }
    );

    return {
      success: true,
      serverCorrelationId: response.data.serverCorrelationId,
      status: response.data.status,
      correlationId,
      transactionRef,
      rawResponse: response.data
    };
  }

  // ─── Étape 3: Vérifier le statut d'une transaction ──────
  async getTransactionStatus(serverCorrelationId) {
    const token = await this.generateToken();

    const response = await axios.get(
      `${MVOLA_BASE}/mvola/mm/transactions/type/merchantpay/1.0.0/status/${serverCorrelationId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Version': '1.0',
          'X-CorrelationID': uuidv4(),
          'UserLanguage': 'FR',
          'UserAccountIdentifier': `msisdn;${process.env.MVOLA_MERCHANT_NUMBER}`,
          'partnerName': 'MadaBoutique',
          'Cache-Control': 'no-cache'
        }
      }
    );

    return {
      status: response.data.status,         // 'completed' | 'pending' | 'failed'
      transactionReference: response.data.transactionReference,
      objectReference: response.data.objectReference,
      rawResponse: response.data
    };
  }

  // ─── Étape 4: Traiter le callback webhook ───────────────
  handleCallback(callbackData) {
    const { status, serverCorrelationId, transactionReference } = callbackData;
    
    return {
      success: status === 'completed',
      serverCorrelationId,
      transactionReference,
      status
    };
  }
}

module.exports = new MVolaService();
