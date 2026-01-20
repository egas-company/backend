import axios from "axios";

export const createAxiosInstance = () => {
  const baseURL =
    process.env.NODE_ENV === "production"
      ? "https://api.interswitchng.com"
      : "https://qa.interswitchng.com";

  return axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
    },
  });
};
