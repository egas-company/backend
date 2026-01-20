import axios from "axios";
import { config } from "../config";

export const getAuthToken = async () => {
  try {
    const credentials = `${config.interswitch.clientId}:${config.interswitch.secretKey}`;
    const base64Credentials = Buffer.from(credentials).toString("base64");

    console.log("base64Credentials", base64Credentials);

    const response = await axios.post(
      "https://passport.k8.isw.la/passport/oauth/token?grant_type=client_credentials",
      null,
      {
        headers: {
          Authorization: `Basic ${base64Credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.log("error", error);
    // console.log(error);
    // console.error("Failed to get auth token:", {
    //   message: error.message,
    //   response: error.response?.data,
    //   status: error.response?.status,
    // });
    throw new Error("Failed to get auth token");
  }
};
