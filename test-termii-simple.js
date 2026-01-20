const axios = require('axios');

const termiiConfig = {
    apiKey: 'TLpnEWSQGmfrkxcuzeUndkeifbOkIYAzbPRXArSbDtQzvqfVGQeVrGxWdsPOWO',
    baseUrl: 'https://api.ng.termii.com/api',
    sender: 'N-Alert'
};

async function testTermiiAPI() {
    console.log('Testing Termii API configuration...');
    console.log('API Key:', termiiConfig.apiKey.substring(0, 10) + '...');
    console.log('Base URL:', termiiConfig.baseUrl);
    console.log('Sender:', termiiConfig.sender);
    
    try {
        // Test 1: Generate OTP
        console.log('\n1. Testing OTP generation...');
        const otpResponse = await axios.post(`${termiiConfig.baseUrl}/sms/otp/generate`, {
            api_key: termiiConfig.apiKey,
            pin_type: 'NUMERIC',
            phone_number: '2349061775633',
            pin_attempts: 3,
            pin_time_to_live: 10,
            pin_length: 6
        });
        
        console.log('OTP Generation Response:', otpResponse.data);
        
        if (otpResponse.data.status === 'error') {
            console.error('❌ OTP Generation failed:', otpResponse.data.message);
            return;
        }
        
        console.log('✅ OTP Generation successful');
        
        // Test 2: Send SMS
        console.log('\n2. Testing SMS sending...');
        const smsResponse = await axios.post(`${termiiConfig.baseUrl}/sms/send`, {
            api_key: termiiConfig.apiKey,
            to: '2349061775633',
            from: termiiConfig.sender,
            sms: 'Hello 123456 is your EGas verification code. Valid for 10 minutes',
            type: 'plain',
            channel: 'dnd'
        });
        
        console.log('SMS Response:', smsResponse.data);
        
        if (smsResponse.data.status === 'error') {
            console.error('❌ SMS sending failed:', smsResponse.data.message);
            return;
        }
        
        console.log('✅ SMS sending successful');
        
    } catch (error) {
        console.error('❌ API Test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testTermiiAPI(); 