export interface CardAuthData {
  pan: string;
  expiryDate: string;
  cvv2: string;
  pin: string;
}

export interface PaymentRequest {
  customerId: string;
  amount: number;
  currency: string;
  transactionRef?: string;
  authData: CardAuthData;
}

export type EncryptedCardData = {
  authData: string;
};
