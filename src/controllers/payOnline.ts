import { Request, Response } from "express";
import axios from "axios";
import { config } from "../config";
import { confirmPaymentAndAssign } from "../services/order";
import { logger } from "../utils/logger";

/**
 * Verify payment using Interswitch production collections endpoint.
 */
export const verifyPayOnlinePayment = async (req: Request, res: Response) => {
  const { transactionRef, amount } = req.body;

  if (!transactionRef) {
    return res.status(400).json({ success: false, error: "transactionRef is required" });
  }

  try {
    const url = `${config.interswitch.baseUrl}/collections/api/v1/gettransaction.json`;
    const params = {
      merchantcode: config.interswitch.merchantCode,
      transactionreference: transactionRef,
      amount: amount ?? undefined,
    };

    const response = await axios.get(url, { params, timeout: 15000 });
    const data = response.data;

    if (data?.ResponseCode !== "00") {
      logger.warn("PayOnline verify failed", {
        transactionRef,
        code: data?.ResponseCode,
        description: data?.ResponseDescription,
      });
      return res.status(400).json({
        success: false,
        error: data?.ResponseDescription || "Payment verification failed",
      });
    }

    try {
      await confirmPaymentAndAssign(transactionRef, data?.Amount, data?.PaymentReference);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Order not found")) {
        logger.warn("PayOnline verified but no matching order yet", {
          transactionRef,
          amount: data?.Amount,
        });
        return res.json({
          success: true,
          pending: true,
          data: { transactionRef, amount: data?.Amount },
        });
      }
      logger.error("PayOnline verify succeeded but order update failed", {
        transactionRef,
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
        transactionRef,
        amount: data?.Amount,
        status: data?.ResponseDescription,
      },
    });
  } catch (error: any) {
    logger.error("PayOnline verify error", {
      transactionRef,
      error: error?.message,
      response: error?.response?.data,
    });
    return res.status(500).json({
      success: false,
      error: "Verification error",
    });
  }
};
