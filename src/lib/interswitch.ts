import axios from 'axios';
import crypto from 'crypto';

interface InterswitchConfig {
  merchantCode: string;
  clientId: string;
  clientSecret: string;
  environment: 'test' | 'production';
}

export class Interswitch {
  private baseUrl: string;
  private config: InterswitchConfig;

  constructor(config: InterswitchConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.interswitchng.com'
      : 'https://sandbox.interswitchng.com';
  }

  private generateAuthHeader() {
    const timestamp = new Date().toISOString();
    const nonce = crypto.randomBytes(32).toString('hex');
    const signature = this.generateSignature(timestamp, nonce);

    return {
      'Authorization': `InterswitchAuth ${this.config.clientId}`,
      'Timestamp': timestamp,
      'Nonce': nonce,
      'Signature': signature,
      'SignatureMethod': 'SHA256',
    };
  }

  private generateSignature(timestamp: string, nonce: string): string {
    const signatureInput = `${this.config.clientId}${timestamp}${nonce}${this.config.clientSecret}`;
    return crypto.createHash('sha256').update(signatureInput).digest('hex');
  }

  async initiateCardPayment(paymentData: any) {
    const headers = this.generateAuthHeader();
    const response = await axios.post(
      `${this.baseUrl}/api/v2/payments/card`,
      paymentData,
      { headers }
    );
    return response.data;
  }

  async initiateBankTransfer(paymentData: any) {
    const headers = this.generateAuthHeader();
    const response = await axios.post(
      `${this.baseUrl}/api/v2/payments/bank-transfer`,
      paymentData,
      { headers }
    );
    return response.data;
  }

  async verifyTransaction(reference: string) {
    const headers = this.generateAuthHeader();
    const response = await axios.get(
      `${this.baseUrl}/api/v2/transactions/${reference}/status`,
      { headers }
    );
    return response.data;
  }
} 