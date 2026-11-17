import { Schema, model, type Types } from "mongoose";
import { TRANSACTION_STATUSES } from "../config/constants.js";

export interface TransactionDocument {
  _id: Types.ObjectId;
  appointmentId: Types.ObjectId;
  customerId: string;
  amount: number;
  currency: string;
  stripeSessionId: string;
  status: (typeof TRANSACTION_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<TransactionDocument>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      lowercase: true,
      minlength: 3,
      maxlength: 3,
    },
    stripeSessionId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      required: true,
      default: "pending",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

transactionSchema.index({ customerId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });

export const Transaction = model<TransactionDocument>(
  "Transaction",
  transactionSchema,
);
