import { Request, Response } from "express";
import axios from "axios";
import { config } from "../config";
import { confirmPaymentAndAssign } from "../services/order";
import { logger } from "../utils/logger";

export const getPaystackPublicKey = (_: Request, res: Response) => {
  const key = config.paystack.publicKey;
  if (!key) {
    return res.status(404).json({ success: false, error: "Public key not configured" });
  }
  return res.json({ success: true, publicKey: key });
};

export const verifyPaystackPayment = async (req: Request, res: Response) => {
  const { reference, amount } = req.body;
  const secret = config.paystack.secretKey;

  if (!secret) {
    return res.status(500).json({
      success: false,
      error: "Paystack secret key not configured on server",
    });
  }

  if (!reference) {
    return res.status(400).json({
      success: false,
      error: "Missing reference",
    });
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    const verification = response.data;
    const data = verification?.data;
    const statusOk = verification?.status === true && data?.status === "success";
    const amountMatch =
      !amount || (data?.amount && Number(data.amount) === Number(amount));

    if (!statusOk || !amountMatch) {
      logger.warn("Paystack verify failed", {
        reference,
        status: data?.status,
        gatewayAmount: data?.amount,
        requestAmount: amount,
      });
      return res.status(400).json({
        success: false,
        error: "Payment verification failed",
        details: data?.status,
      });
    }

    try {
      await confirmPaymentAndAssign(reference, data.amount);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Order not found")) {
        // Allow client to continue; order will be created with this reference afterward
        logger.warn("Paystack verified but no matching order yet", {
          reference,
          amount: data.amount,
        });
        return res.json({
          success: true,
          data: {
            reference,
            amount: data.amount,
            status: data.status,
            channel: data.channel,
            orderUpdated: false,
          },
        });
      }
      logger.error("Paystack verify succeeded but order update failed", {
        reference,
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
        reference,
        amount: data.amount,
        status: data.status,
        channel: data.channel,
        orderUpdated: true,
      },
    });
  } catch (error: any) {
    logger.error("Paystack verify error", {
      reference,
      error: error?.message,
    });
    return res.status(500).json({
      success: false,
      error: "Verification error",
    });
  }
};
