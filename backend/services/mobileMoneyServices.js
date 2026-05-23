/**
 * SERVICE ORANGE MONEY - API Orange Madagascar (WebPay)
 * Documentation: https://developer.orange.com/apis/om-webpay-mg
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const ORANGE_BASE = process.env.ORANGE_MONEY_BASE_URL || 'https://api.orange.com/orange-money-webpay/mg/v1';

class OrangeMoneyService {

  // ─── Obtenir le token d'accès ────────────────────────────
  async generateToken() {
    const response = await axios.post(
      'https://api.orange.com/oauth/v3/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': process.env.ORANGE_MONEY_AUTHORIZATION,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );
    return response.data.access_token;
  }

  // ─── Initier un paiement Web (redirection) ───────────────
  async initiateWebPayment({ amount, phoneNumber, orderId, description }) {
    const token = await this.generateToken();
    const orderRef = `MB-OM-${orderId}-${Date.now()}`;

    const payload = {
      merchant_key:   process.env.ORANGE_MONEY_MERCHANT_KEY,
      currency:       'OAV',          // Ariary malgache
      order_id:       orderRef,
      amount:         amount,
      return_url:     process.env.ORANGE_MONEY_RETURN_URL,
      cancel_url:     process.env.ORANGE_MONEY_CANCEL_URL,
      notif_url:      process.env.ORANGE_MONEY_NOTIF_URL,
      lang:           'fr',
      reference:      description || `Commande ${orderId}`
    };

    const response = await axios.post(
      `${ORANGE_BASE}/webpayment`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    return {
      success: true,
      paymentUrl:  response.data.payment_url,   // URL de redirection Orange
      payToken:    response.data.pay_token,
      orderRef,
      rawResponse: response.data
    };
  }

  // ─── Vérifier le statut d'un paiement ───────────────────
  async getPaymentStatus(orderRef) {
    const token = await this.generateToken();

    const response = await axios.get(
      `${ORANGE_BASE}/webpayment`,
      {
        params: {
          merchant_key: process.env.ORANGE_MONEY_MERCHANT_KEY,
          order_id:     orderRef
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      }
    );

    const data = response.data;
    return {
      success:    data.status === '00000',
      status:     data.status,
      message:    data.message,
      amount:     data.amount,
      txnRef:     data.txnid,
      rawResponse: data
    };
  }

  // ─── Traiter la notification (IPN) ──────────────────────
  handleNotification(notifData) {
    return {
      success:  notifData.status === '00000',
      orderId:  notifData.order_id,
      txnRef:   notifData.txnid,
      amount:   notifData.amount,
      status:   notifData.status
    };
  }
}

// ═══════════════════════════════════════════════════════════

/**
 * SERVICE AIRTEL MONEY - API Airtel Africa Madagascar
 * Documentation: https://developers.airtel.africa/documentation
 */

const AIRTEL_BASE = process.env.AIRTEL_MONEY_BASE_URL || 'https://openapi.airtel.africa';

class AirtelMoneyService {

  // ─── Obtenir le token OAuth2 ─────────────────────────────
  async generateToken() {
    const response = await axios.post(
      `${AIRTEL_BASE}/auth/oauth2/token`,
      {
        client_id:     process.env.AIRTEL_MONEY_CLIENT_ID,
        client_secret: process.env.AIRTEL_MONEY_CLIENT_SECRET,
        grant_type:    'client_credentials'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept':        '*/*'
        }
      }
    );
    return response.data.access_token;
  }

  // ─── Initier un paiement (Collections API) ───────────────
  async initiatePayment({ amount, phoneNumber, orderId, description }) {
    const token = await this.generateToken();
    const transactionId = `MB-AT-${uuidv4().substring(0, 8).toUpperCase()}`;

    const payload = {
      reference: description || `Commande ${orderId}`,
      subscriber: {
        country:  process.env.AIRTEL_MONEY_COUNTRY || 'MG',
        currency: process.env.AIRTEL_MONEY_CURRENCY || 'MGA',
        msisdn:   phoneNumber.replace(/\s+/g, '').replace(/^0/, '261')
      },
      transaction: {
        amount:   amount,
        country:  process.env.AIRTEL_MONEY_COUNTRY || 'MG',
        currency: process.env.AIRTEL_MONEY_CURRENCY || 'MGA',
        id:       transactionId
      }
    };

    const response = await axios.post(
      `${AIRTEL_BASE}/merchant/v1/payments/`,
      payload,
      {
        headers: {
          'Authorization':  `Bearer ${token}`,
          'Content-Type':   'application/json',
          'Accept':         'application/json',
          'X-Country':      'MG',
          'X-Currency':     'MGA'
        }
      }
    );

    const data = response.data;
    return {
      success:       data.status?.success,
      transactionId,
      airtelRef:     data.data?.transaction?.id,
      status:        data.status?.code,
      message:       data.status?.message,
      rawResponse:   data
    };
  }

  // ─── Vérifier le statut ──────────────────────────────────
  async getTransactionStatus(airtelTransactionId) {
    const token = await this.generateToken();

    const response = await axios.get(
      `${AIRTEL_BASE}/standard/v1/payments/${airtelTransactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept':        'application/json',
          'X-Country':     'MG',
          'X-Currency':    'MGA'
        }
      }
    );

    const data = response.data;
    return {
      success: data.status?.code === '200',
      status:  data.data?.transaction?.status,
      message: data.status?.message,
      rawResponse: data
    };
  }

  // ─── Traiter le callback ─────────────────────────────────
  handleCallback(callbackData) {
    const txn = callbackData?.transaction || {};
    return {
      success:       txn.status === 'TS',  // TS = Transaction Successful
      transactionId: txn.id,
      airtelRef:     txn.airtel_money_id,
      status:        txn.status
    };
  }
}

module.exports = {
  orangeMoneyService: new OrangeMoneyService(),
  airtelMoneyService: new AirtelMoneyService()
};
