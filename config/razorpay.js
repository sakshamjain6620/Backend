const Razorpay = require('razorpay');
// Load env explicitly from backend directory
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SxyTETXvDZEo7l',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'Vx2CQK8NSd7k8wXF7NxrZMlf'
});
// Debug: print loaded Razorpay credentials (mask secret)
console.log('🔑 Razorpay config loaded: key_id=', razorpay.key_id);


module.exports = razorpay;
