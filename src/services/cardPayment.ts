import axios from "axios";
import { randomUUID } from "crypto";
import { config } from "../config";
import { encryptCardData } from "../utils/cardEncryption";
import { getAuthToken } from "../utils/auth";
import type { PaymentRequest } from "../types/cardPayment";

interface OtpAuthData {
  otp: string;
  paymentId: string;
  transactionRef: string;
}

const api = axios.create({
  baseURL: config.interswitch.baseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

const prepareCardData = async (paymentRequest: any) => {
  try {
    const amountInKobo = Number(paymentRequest.amount) * 100;

    const authData = await encryptCardData({
      pan: paymentRequest.cardNumber,
      expiryDate: `${paymentRequest.expiryYear}${paymentRequest.expiryMonth}`,
      cvv2: paymentRequest.cvv,
      pin: paymentRequest.pin,
    });

    return {
      merchantId: config.interswitch.merchantCode,
      customerId: paymentRequest.customerId,
      amount: amountInKobo,
      currency: "NGN",
      authData: authData.authData,
      transactionRef: randomUUID(),
      paymentItem: config.interswitch.paymentItemId,
      callbackUrl: config.interswitch.callbackUrl,
    };
  } catch (error) {
    console.error("Payload:", paymentRequest);
    throw error;
  }
};

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;

const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const isRetryableError = (error: any): boolean => {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true; // Network errors are retryable

  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  return retryableStatusCodes.includes(error.response.status);
};

const formatErrorMessage = (error: any): string => {
  if (!axios.isAxiosError(error)) {
    return error.message || "An unexpected error occurred";
  }

  if (!error.response) {
    return "Network error occurred. Please check your connection.";
  }

  // Get the error message from the response if available
  const serverMessage = error.response?.data?.message;

  switch (error.response.status) {
    case 503:
      return `Service temporarily unavailable. ${
        serverMessage || "Please try again later."
      }`;
    case 429:
      return `Too many requests. ${
        serverMessage || "Please wait a moment and try again."
      }`;
    case 401:
      return `Authentication failed. ${
        serverMessage || "Please check your credentials."
      }`;
    default:
      return serverMessage || error.message || "Payment request failed";
  }
};

export const initiatePayment = async (paymentRequest: PaymentRequest) => {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const token = await getAuthToken();
      const paymentData = await prepareCardData(paymentRequest);

      const response = await api.post(
        "https://payment-service.k8.isw.la/api/v3/purchases",
        paymentData,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("payment response", response.data);

      return response.data;
    } catch (error) {
      console.log("payment error", error);
      attempt++;
      const shouldRetry = isRetryableError(error);

      // Log the error with attempt information
      console.error(`Payment attempt ${attempt} failed:`, error);

      // If it's the last attempt or not retryable, throw the error
      if (!shouldRetry || attempt === MAX_RETRIES) {
        throw new Error(formatErrorMessage(error));
      }

      // Calculate delay with exponential backoff
      const delayTime = INITIAL_DELAY * Math.pow(2, attempt - 1);
      console.log(`Retrying payment in ${delayTime}ms...`);
      await delay(delayTime);
    }
  }
};

export const generateOtpAuthData = async (
  otpData: OtpAuthData
): Promise<string> => {
  try {
    const authString = `1Z${otpData.otp}Z${otpData.paymentId}Z${otpData.transactionRef}`;

    // Use the same encryption method as card data
    const authData = await encryptCardData({
      pan: authString,
      expiryDate: "", // Not needed for OTP
      cvv2: "", // Not needed for OTP
      pin: "", // Not needed for OTP
    });

    return authData.authData;
  } catch (error) {
    throw new Error(`Failed to generate OTP auth data: ${error}`);
  }
};

interface OtpRequest {
  otp: string;
  paymentId: string;
  transactionId: string;
}

export const authenticateOtp = async (otpData: OtpRequest) => {
  try {
    const token = await getAuthToken();

    const payload = {
      paymentId: otpData.paymentId,
      transactionId: otpData.transactionId,
      otp: otpData.otp,
    };

    const response = await api.post(
      "https://payment-service.k8.isw.la/api/v3/purchases/otps/auths",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `OTP verification failed: ${
          error.response?.data?.errors?.[0]?.message || error.message
        }`
      );
    }
    throw error;
  }
};
