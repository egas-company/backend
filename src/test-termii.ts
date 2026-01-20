import { generateOTP, sendOTPMessage, verifyOTP } from './utils/termii';

async function testTermii() {
    try {
        // Test phone number
        const phoneNumber = '2349061775633';  // Updated phone number

        // Generate OTP
        console.log('Generating OTP...');
        const otpResponse = await generateOTP(phoneNumber);
        console.log('OTP Response:', otpResponse);

        // Send OTP message
        console.log('\nSending OTP message...');
        const messageSent = await sendOTPMessage(phoneNumber, otpResponse.otp);
        console.log('Message sent:', messageSent);

        // Note: In a real application, you would wait for user input here
        // For testing, we'll verify immediately with the OTP we received
        console.log('\nVerifying OTP...');
        const verificationResult = await verifyOTP(otpResponse.pinId, otpResponse.otp);
        console.log('Verification result:', verificationResult);

    } catch (error) {
        console.error('Error:', error);
    }
}

testTermii(); 