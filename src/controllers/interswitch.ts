import { Request, Response } from "express";
import axios from "axios";
import { config } from "../config";
import { confirmPaymentAndAssign } from "../services/order";
import { logger } from "../utils/logger";

/**
 * Prepare payload for Interswitch inline checkout (production).
 * The frontend should call this to get the txn_ref and config needed for webpayCheckout.
 */
export const createInterswitchPayment = async (req: Request, res: Response) => {
  try {
    const { amount, currency = 566, paymentReference, customerEmail, customerName } = req.body;
    if (!amount || !paymentReference) {
      return res.status(400).json({ success: false, error: "amount and paymentReference are required" });
    }

    const minorAmount = Math.round(Number(amount)); // expect caller to send minor units already

    const payload = {
      merchant_code: config.interswitch.merchantCode,
      merchant_id: config.interswitch.merchantId,
      pay_item_id: config.interswitch.paymentItemId,
      txn_ref: paymentReference,
      amount: minorAmount,
      currency,
      cust_email: customerEmail,
      cust_name: customerName,
      site_redirect_url: config.interswitch.callbackUrl,
      mode: "LIVE",
      merchant_key: config.interswitch.secretKey, // Note: sent here because SDK requires it
      inlineScript: config.interswitch.inlineScript ?? "https://newwebpay.interswitchng.com/inline-checkout.js",
    };

    return res.json({ success: true, data: payload });
  } catch (error: any) {
    logger.error("Interswitch init error", { error: error?.message });
    return res.status(500).json({ success: false, error: "Unable to initialize payment" });
  }
};

/**
 * Verify a transaction via the production collections endpoint and, if successful, mark the order paid.
 */
export const verifyInterswitchPayment = async (req: Request, res: Response) => {
  const { transactionReference, amount } = req.body;
  if (!transactionReference) {
    return res.status(400).json({ success: false, error: "transactionReference is required" });
  }
  try {
    const url = `${config.interswitch.baseUrl}/collections/api/v1/gettransaction.json`;
    const params = {
      merchantcode: config.interswitch.merchantCode,
      transactionreference: transactionReference,
      amount: amount ?? undefined,
    };

    const response = await axios.get(url, { params, timeout: 15000 });
    const data = response.data;

    const approved = data?.ResponseCode === "00";
    if (!approved) {
      logger.warn("Interswitch verify failed", {
        transactionReference,
        responseCode: data?.ResponseCode,
        description: data?.ResponseDescription,
      });
      return res.status(400).json({
        success: false,
        error: "Payment verification failed",
        details: data?.ResponseDescription || data?.ResponseCode,
      });
    }

    try {
      await confirmPaymentAndAssign(transactionReference, data?.Amount, data?.PaymentReference);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Order not found")) {
        logger.warn("Interswitch verified but no matching order yet", {
          transactionReference,
          amount: data?.Amount,
        });
        return res.json({
          success: true,
          data: {
            transactionReference,
            amount: data?.Amount,
            status: data?.ResponseDescription,
            orderUpdated: false,
          },
        });
      }
      logger.error("Interswitch verify succeeded but order update failed", {
        transactionReference,
        error: err instanceof Error ? err.message : err,
      });
      return res.status(500).json({
        success: false,
        error: "Payment verified but order not updated",
      });
    }

    return res.json({
      success: true,
      data: {
        transactionReference,
        amount: data?.Amount,
        status: data?.ResponseDescription,
        orderUpdated: true,
      },
    });
  } catch (error: any) {
    logger.error("Interswitch verify error", {
      transactionReference,
      error: error?.message,
      response: error?.response?.data,
    });
    return res.status(500).json({
      success: false,
      error: "Verification error",
    });
  }
};
