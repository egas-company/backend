import { Request, Response } from "express";
import { initiatePayment, authenticateOtp } from "../services/cardPayment";
import { config } from "../config/index";

export const cardPaymentController = {
  async initiatePayment(req: Request, res: Response) {
    try {
      const paymentData = {
        customerId: req.body.customerId,
        amount: 100, //TODO: Remove
        currency: req.body.currency,
        merchantId: config.interswitch.merchantCode,
        paymentItemId: config.interswitch.paymentItemId,
        callbackUrl: config.interswitch.callbackUrl,
        cardNumber: req.body.cardNumber.replace(/\s/g, ""),
        expiryMonth: req.body.expiryMonth,
        expiryYear: req.body.expiryYear,
        cvv: req.body.cvv,
        pin: req.body.pin,
      };

      const result = await initiatePayment(paymentData as any);
      res.json({
        success: true,
        data: result,
        requiresOtp: result.responseCode === "T0",
        requires3DS: result.responseCode === "S0",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Payment failed",
      });
    }
  },

  async authenticateOtp(req: Request, res: Response) {
    try {
      const { otp, paymentId, transactionId } = req.body;

      if (!otp || !paymentId || !transactionId) {
        res.status(400).json({
          success: false,
          error: "Missing required fields",
        });
        return;
      }

      const result = await authenticateOtp({
        otp,
        paymentId,
        transactionId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Controller Error:", error);

      const errorMessage =
        error instanceof Error ? error.message : "OTP verification failed";

      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  },
};

