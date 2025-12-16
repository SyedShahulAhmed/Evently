import nodemailer from "nodemailer";
import Mailgen from "mailgen";

/** ✉ Configure Mailgen (Gmail-style template) */
const mailGenerator = new Mailgen({
    theme: "default", // or "salted" for a cleaner look
    product: {
        name: "Evently",
        link: "https://evently.app",
        logo: "https://res.cloudinary.com/demo/image/upload/v1710345812/evently-logo.png"
    }
});

/** 📬 Send Email with Mailgen Template */
export const sendEmail = async ({ to, subject, intro, instruction, outro }) => {
    
    // 1️⃣ Create the Mailgen email body
    const emailBody = {
        body: {
            name: to,
            intro: intro || "Welcome to Evently! 🎉",
            action: instruction
                ? {
                      instructions: instruction.text,
                      button: {
                          color: "#3B82F6",
                          text: instruction.buttonText,
                          link: instruction.buttonLink,
                      },
                  }
                : null,
            outro: outro || "Need help or have questions? Just reply to this email!",
        },
    };

    // 2️⃣ Generate HTML
    const emailHtml = mailGenerator.generate(emailBody);

    // 3️⃣ Generate plain text (for fallback)
    const emailText = mailGenerator.generatePlaintext(emailBody);

    // 4️⃣ Nodemailer transport
    const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
        },
    });

    // 5️⃣ Send email
    return transporter.sendMail({
        from: `"Evently" <${process.env.MAIL_USER}>`,
        to,
        subject,
        html: emailHtml,
        text: emailText,
    });
};
