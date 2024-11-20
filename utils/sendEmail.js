const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { 
    user: 'gokulskaimal@gmail.com', // Replace with your Gmail address
    pass: 'cfpf saep eijv uhia', // Replace with your app password
  },
});

exports.sendEmail = async (to, subject, text) => {
  try {
    await transporter.sendMail({
      from: 'gokulskaimal@gmail.com',  
      to,
      subject,
      text,
    });
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error); 
    throw error; // Ensure errors are propagated         
  }
};  
  