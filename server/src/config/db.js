import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`📦 MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.log("❌ MongoDB Connection Failed");
        console.error(error);
        process.exit(1);
    }
};

export default connectDB;