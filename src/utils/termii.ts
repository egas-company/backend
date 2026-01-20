import axios, { AxiosError } from 'axios';
import { termiiConfig } from '../config/termii';

interface TermiiOTPResponse {
    pinId: string;
    otp: string;
    phone_number: string;
}

interface TermiiVerifyResponse {
    verified: boolean;
    pinId: string;
    msisdn: string;
    attemptsRemaining: number;
}

interface TermiiErrorResponse {
    code: number;
    message: string;
    status: string;
}

export async function generateOTP(phoneNumber: string): Promise<TermiiOTPResponse> {
    try {
        const response = await axios.post(`${termiiConfig.baseUrl}/sms/otp/generate`, {
            api_key: termiiConfig.apiKey,
            pin_type: 'NUMERIC',
            phone_number: phoneNumber,
            pin_attempts: 3,
            pin_time_to_live: 10,
            pin_length: 6
        });

        if (response.data.status === 'error') {
            throw new Error(response.data.message || 'Failed to generate OTP');
        }

        return {
            pinId: response.data.pin_id,
            otp: response.data.otp,
            phone_number: response.data.phone_number
        };
    } catch (error) {
        if (error instanceof AxiosError) {
            const termiiError = error.response?.data as TermiiErrorResponse;
            throw new Error(termiiError?.message || 'Failed to generate OTP');
        }
        console.error('Error generating OTP:', error);
        throw new Error('Failed to generate OTP');
    }
}

export async function sendOTPMessage(phoneNumber: string, code: string): Promise<boolean> {
    try {
        const response = await axios.post(`${termiiConfig.baseUrl}/sms/send`, {
            api_key: termiiConfig.apiKey,
            to: phoneNumber,
            from: termiiConfig.sender,
            sms: `Hello ${code} is your EGas verification code. Valid for 10 minutes`,
            type: 'plain',
            channel: 'dnd'
        });

        if (response.data.status === 'error') {
            throw new Error(response.data.message || 'Failed to send OTP message');
        }

        return response.data.code === 'ok';
    } catch (error) {
        if (error instanceof AxiosError) {
            const termiiError = error.response?.data as TermiiErrorResponse;
            throw new Error(termiiError?.message || 'Failed to send OTP message');
        }
        console.error('Error sending OTP message:', error);
        throw new Error('Failed to send OTP message');
    }
}

export async function verifyOTP(pinId: string, otp: string): Promise<TermiiVerifyResponse> {
    try {
        const response = await axios.post(`${termiiConfig.baseUrl}/sms/otp/verify`, {
            api_key: termiiConfig.apiKey,
            pin_id: pinId,
            pin: otp
        });

        if (response.data.status === 'error') {
            throw new Error(response.data.message || 'Failed to verify OTP');
        }

        return {
            verified: response.data.verified,
            pinId: response.data.pin_id,
            msisdn: response.data.msisdn,
            attemptsRemaining: response.data.attempts_remaining
        };
    } catch (error) {
        if (error instanceof AxiosError) {
            const termiiError = error.response?.data as TermiiErrorResponse;
            throw new Error(termiiError?.message || 'Failed to verify OTP');
        }
        console.error('Error verifying OTP:', error);
        throw new Error('Failed to verify OTP');
    }
} 