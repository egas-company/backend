import dotenv from "dotenv";
import axios from "axios";
import { ApiError } from "../utils/ApiError";

dotenv.config();

export async function sendSMS(
  phoneNumber: string,
  message: string
): Promise<boolean> {
  if (!phoneNumber?.trim() || !message?.trim()) {
    throw new ApiError(400, "Phone number and message are required");
  }

  try {
    // Generate a simple numeric ID instead of UUID
    const simpleId = Math.floor(Math.random() * 1000000).toString();

    console.log("Sending SMS with payload:", {
      id: simpleId,
      to: [phoneNumber],
      sender_mask: process.env.KONNECT_SENDER_MASK,
      body: message,
    });

    const response = await axios.post(
      `https://konnect.dotgo.com/api/v1/Accounts/${process.env.KONNECT_ACCOUNT_ID}/Messages`,
      {
        id: simpleId, // Using simple numeric ID
        to: [phoneNumber],
        sender_mask: process.env.KONNECT_SENDER_MASK,
        body: "Enter any 6 digit code to verify your Egas account",
      },
      {
        headers: {
          Authorization: process.env.KONNECT_API_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("SMS Response:", {
      status: response.status,
      data: response.data,
    });

    if (response.data.status === "ok") {
      return true;
    }

    throw new ApiError(
      500,
      `Unexpected response status: ${response.data.status}`
    );
  } catch (error) {
    console.error("SMS Error:", error);
    throw new ApiError(500, "Failed to send SMS. Please try again later.");
  }
}
