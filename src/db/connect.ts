import mongoose from "mongoose";
import { env } from "../config/env";
import { NextFunction } from "express";

export async function connectDb(next: NextFunction): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongodbUri);
  next();
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
