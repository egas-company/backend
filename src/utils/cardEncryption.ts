import forge from "node-forge";
import { config } from "../config";
import { EncryptedCardData } from "../types/cardPayment";

interface InterswitchAuthData {
  pan: string;
  expiryDate: string;
  cvv2: string;
  pin: string;
}

const PUBLIC_MODULUS = config.interswitch.publicModulus;
const PUBLIC_EXPONENT = config.interswitch.publicExponent;

export const encryptCardData = async (
  cardData: InterswitchAuthData
): Promise<EncryptedCardData> => {
  try {
    // Validate required fields
    if (!cardData?.pan || !cardData?.expiryDate || !cardData?.cvv2) {
      throw new Error("Missing required card details");
    }

    // Clean and validate PAN
    const cleanPan = cardData.pan.replace(/\s/g, "");
    if (!/^\d{13,19}$/.test(cleanPan)) {
      throw new Error("Invalid card number");
    }

    // Validate expiry date format (YYMM)
    if (!/^\d{4}$/.test(cardData.expiryDate)) {
      throw new Error("Invalid expiry date format. Use YYMM format");
    }

    // Format auth string (version Z pan Z pin Z expiry Z cvv)
    const authString = [
      "1",
      cleanPan,
      cardData.pin || "",
      cardData.expiryDate,
      cardData.cvv2,
    ].join("Z");

    // Convert to bytes directly without hex conversion
    const clearSecureBytes = forge.util.createBuffer(authString, "utf8");

    // Create RSA public key
    const publicKey = forge.pki.rsa.setPublicKey(
      new forge.jsbn.BigInteger(PUBLIC_MODULUS || "", 16),
      new forge.jsbn.BigInteger(PUBLIC_EXPONENT || "", 16)
    );

    // Encrypt with PKCS#1 v1.5 padding
    const encrypted = publicKey.encrypt(
      clearSecureBytes.getBytes(),
      "RSAES-PKCS1-V1_5"
    );

    return {
      authData: forge.util.encode64(encrypted),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Card encryption failed: ${error.message}`);
    }
    throw error;
  }
};
