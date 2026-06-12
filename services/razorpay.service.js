const razorpay = require('../config/razorpay');
const crypto = require('crypto');
require('dotenv').config();

const createOrder = async (amountInRupees, appointmentId) => {
    try {
        const options = {
            amount: Math.round(amountInRupees * 100), // convert to paise
            currency: 'INR',
            receipt: appointmentId.toString().length > 40 ? appointmentId.toString().substring(0, 40) : appointmentId.toString(),
            payment_capture: 1 // auto-capture payment
        };
        const order = await razorpay.orders.create(options);
        return order;
    } catch (err) {
        console.error('Razorpay Order Creation Error:', err);
        const errMsg = err.error?.description || err.message || JSON.stringify(err);
        throw new Error(`Razorpay Order creation failed: ${errMsg}`);
    }
};

const verifySignature = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    try {
        const keySecret = process.env.RAZORPAY_KEY_SECRET || 'Vx2CQK8NSd7k8wXF7NxrZMlf';
        const hmac = crypto.createHmac('sha256', keySecret);
        hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
        const generatedSignature = hmac.digest('hex');
        
        return generatedSignature === razorpaySignature;
    } catch (err) {
        console.error('Razorpay Signature Verification Error:', err);
        return false;
    }
};

module.exports = {
    createOrder,
    verifySignature
};
